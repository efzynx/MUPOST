import { TokenHealthService } from "../token-health-service";
import { GET as getHealthRoute } from "@/app/api/connect/health/route";
import { POST as refreshHealthRoute } from "@/app/api/connect/health/refresh/route";
import { authService } from "@/lib/services/auth-service";
import { platformConnector } from "@/lib/services/platform-connector";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

// Mock dependencies
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock("@/lib/services/auth-service", () => ({
  authService: {
    validateSession: jest.fn(),
  },
}));

jest.mock("@/lib/services/platform-connector", () => ({
  platformConnector: {
    refreshToken: jest.fn(),
  },
}));

jest.mock("@/lib/queue/token-refresh-queue", () => ({
  getTokenRefreshQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: "job-refresh-1" }),
  })),
}));

describe("TokenHealthService and Proactive Expiration Alerts", () => {
  const service = new TokenHealthService();
  const mockedDb = db as unknown as { select: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("assessAccount", () => {
    const fixedNow = new Date("2026-09-26T12:00:00.000Z");

    it("should mark account with status NEEDS_REAUTH as CRITICAL", () => {
      const account: any = {
        id: "acc-1",
        userId: "user-1",
        platform: "META_PAGE",
        accountName: "Halaman Bisnis",
        platformAccountId: "meta-page-123",
        status: "NEEDS_REAUTH",
        tokenExpiresAt: null,
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("NEEDS_REAUTH");
      expect(result.severity).toBe("CRITICAL");
      expect(result.requiresAction).toBe(true);
      expect(result.needsReauth).toBe(true);
      expect(result.message).toContain("membutuhkan autentikasi ulang");
    });

    it("should mark account with status EXPIRED as CRITICAL", () => {
      const account: any = {
        id: "acc-2",
        userId: "user-1",
        platform: "TIKTOK",
        accountName: "TikTok Creator",
        platformAccountId: "tt-123",
        status: "EXPIRED",
        tokenExpiresAt: new Date("2026-09-20T12:00:00.000Z"),
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("EXPIRED");
      expect(result.severity).toBe("CRITICAL");
      expect(result.requiresAction).toBe(true);
      expect(result.isExpired).toBe(true);
    });

    it("should mark account whose tokenExpiresAt is in the past as EXPIRED", () => {
      const account: any = {
        id: "acc-3",
        userId: "user-1",
        platform: "THREADS",
        accountName: "Threads User",
        platformAccountId: "th-123",
        status: "ACTIVE",
        tokenExpiresAt: new Date("2026-09-25T12:00:00.000Z"), // 1 hari yang lalu
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("EXPIRED");
      expect(result.severity).toBe("CRITICAL");
      expect(result.isExpired).toBe(true);
      expect(result.daysRemaining).toBe(0);
    });

    it("should mark account expiring within 3 days as EXPIRING_SOON (WARNING)", () => {
      const account: any = {
        id: "acc-4",
        userId: "user-1",
        platform: "THREADS",
        accountName: "Threads User",
        platformAccountId: "th-456",
        status: "ACTIVE",
        tokenExpiresAt: new Date("2026-09-29T12:00:00.000Z"), // 3 hari ke depan
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("EXPIRING_SOON");
      expect(result.severity).toBe("WARNING");
      expect(result.isExpiringSoon).toBe(true);
      expect(result.requiresAction).toBe(true);
      expect(result.daysRemaining).toBe(3);
      expect(result.message).toContain("akan kedaluwarsa dalam 3 hari");
    });

    it("should mark account expiring within exactly 7 days as EXPIRING_SOON (WARNING)", () => {
      const account: any = {
        id: "acc-5",
        userId: "user-1",
        platform: "TIKTOK",
        accountName: "TikTok Creator 2",
        platformAccountId: "tt-555",
        status: "ACTIVE",
        tokenExpiresAt: new Date("2026-10-03T12:00:00.000Z"), // Tepat 7 hari ke depan
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("EXPIRING_SOON");
      expect(result.severity).toBe("WARNING");
      expect(result.daysRemaining).toBe(7);
      expect(result.requiresAction).toBe(true);
    });

    it("should mark account expiring in 14 days (> 7 days) as HEALTHY (NONE)", () => {
      const account: any = {
        id: "acc-6",
        userId: "user-1",
        platform: "THREADS",
        accountName: "Threads Brand",
        platformAccountId: "th-777",
        status: "ACTIVE",
        tokenExpiresAt: new Date("2026-10-10T12:00:00.000Z"), // 14 hari ke depan
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("HEALTHY");
      expect(result.severity).toBe("NONE");
      expect(result.requiresAction).toBe(false);
      expect(result.daysRemaining).toBe(14);
    });

    it("should mark account with null tokenExpiresAt (e.g. Meta permanent page) as HEALTHY", () => {
      const account: any = {
        id: "acc-7",
        userId: "user-1",
        platform: "META_PAGE",
        accountName: "Facebook Official Page",
        platformAccountId: "meta-page-888",
        status: "ACTIVE",
        tokenExpiresAt: null,
      };

      const result = service.assessAccount(account, fixedNow);

      expect(result.healthStatus).toBe("HEALTHY");
      expect(result.severity).toBe("NONE");
      expect(result.requiresAction).toBe(false);
      expect(result.daysRemaining).toBeNull();
    });
  });

  describe("getUserTokensHealth", () => {
    it("should aggregate health statuses and sort alerts by severity (CRITICAL before WARNING)", async () => {
      const mockAccounts = [
        {
          id: "acc-1",
          userId: "user-123",
          platform: "META_PAGE",
          accountName: "FB Page",
          platformAccountId: "fb-1",
          status: "ACTIVE",
          tokenExpiresAt: null,
        },
        {
          id: "acc-2",
          userId: "user-123",
          platform: "THREADS",
          accountName: "Threads Acc",
          platformAccountId: "th-1",
          status: "ACTIVE",
          tokenExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        },
        {
          id: "acc-3",
          userId: "user-123",
          platform: "TIKTOK",
          accountName: "TikTok Acc",
          platformAccountId: "tt-1",
          status: "NEEDS_REAUTH",
          tokenExpiresAt: null,
        },
      ];

      mockedDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockAccounts),
        }),
      });

      const summary = await service.getUserTokensHealth("user-123");

      expect(summary.totalAccounts).toBe(3);
      expect(summary.healthyCount).toBe(1);
      expect(summary.expiringSoonCount).toBe(1);
      expect(summary.needsReauthCount).toBe(1);
      expect(summary.actionRequiredCount).toBe(2);
      expect(summary.overallStatus).toBe("CRITICAL");

      // Verifikasi urutan alert: CRITICAL dulu baru WARNING
      expect(summary.alerts).toHaveLength(2);
      expect(summary.alerts[0]!.severity).toBe("CRITICAL");
      expect(summary.alerts[0]!.accountId).toBe("acc-3");
      expect(summary.alerts[1]!.severity).toBe("WARNING");
      expect(summary.alerts[1]!.accountId).toBe("acc-2");
    });
  });

  describe("API Endpoints", () => {
    it("GET /api/connect/health should reject unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/connect/health");
      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("GET /api/connect/health should return 200 with summary when authenticated", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: "user-test",
        fullName: "Test User",
      });

      mockedDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const req = new NextRequest("http://localhost:3000/api/connect/health", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-session-cookie`,
        },
      });

      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(json.data.totalAccounts).toBe(0);
      expect(json.data.overallStatus).toBe("HEALTHY");
    });

    it("POST /api/connect/health/refresh should require accountId", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: "user-test",
        fullName: "Test User",
      });

      const req = new NextRequest("http://localhost:3000/api/connect/health/refresh", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-session-cookie`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await refreshHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("POST /api/connect/health/refresh should return 200 on successful refresh", async () => {
      (authService.validateSession as jest.Mock).mockResolvedValue({
        id: "user-test",
        fullName: "Test User",
      });

      const accountData = {
        id: "acc-threads",
        userId: "user-test",
        platform: "THREADS",
        accountName: "Threads Page",
        platformAccountId: "th-1",
        status: "ACTIVE",
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };

      mockedDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([accountData]),
          }),
        }),
      });

      (platformConnector.refreshToken as jest.Mock).mockResolvedValue({
        success: true,
        newExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      });

      const req = new NextRequest("http://localhost:3000/api/connect/health/refresh", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid-session-cookie`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ accountId: "acc-threads" }),
      });

      const res = await refreshHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain("berhasil diperbarui");
    });
  });
});
