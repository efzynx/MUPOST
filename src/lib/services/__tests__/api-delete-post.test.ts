import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/posts/[id]/route";
import { postManager, PostManagerError } from "@/lib/services/post-manager";
import { authService } from "@/lib/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

jest.mock("@/lib/services/auth-service", () => ({
  authService: {
    validateSession: jest.fn(),
  },
}));

jest.mock("@/lib/services/post-manager", () => {
  const actual = jest.requireActual("@/lib/services/post-manager");
  return {
    ...actual,
    postManager: {
      deletePost: jest.fn(),
    },
  };
});

describe("DELETE /api/posts/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if session cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/posts/post-123", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "post-123" }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 if session is invalid", async () => {
    (authService.validateSession as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/posts/post-123", {
      method: "DELETE",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=invalid-token`,
      },
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "post-123" }) });
    expect(res.status).toBe(401);
  });

  it("should parse deleteOnPlatforms query parameter and pass to postManager.deletePost", async () => {
    (authService.validateSession as jest.Mock).mockResolvedValueOnce({
      id: "user-456",
      email: "user@example.com",
    });

    (postManager.deletePost as jest.Mock).mockResolvedValueOnce({
      success: true,
      deletedPostId: "post-123",
      platformResults: [
        {
          targetId: "target-1",
          platform: "META_PAGE",
          platformPostId: "meta-001",
          success: true,
        },
      ],
    });

    const req = new NextRequest("http://localhost:3000/api/posts/post-123?deleteOnPlatforms=true", {
      method: "DELETE",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=valid-token`,
      },
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "post-123" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.platformResults).toHaveLength(1);

    expect(postManager.deletePost).toHaveBeenCalledWith("user-456", "post-123", {
      deleteOnPlatforms: true,
    });
  });

  it("should parse deleteOnPlatforms from JSON body if present", async () => {
    (authService.validateSession as jest.Mock).mockResolvedValueOnce({
      id: "user-456",
      email: "user@example.com",
    });

    (postManager.deletePost as jest.Mock).mockResolvedValueOnce({
      success: true,
      deletedPostId: "post-789",
    });

    const req = new NextRequest("http://localhost:3000/api/posts/post-789", {
      method: "DELETE",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=valid-token`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ deleteOnPlatforms: true }),
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "post-789" }) });
    expect(res.status).toBe(200);

    expect(postManager.deletePost).toHaveBeenCalledWith("user-456", "post-789", {
      deleteOnPlatforms: true,
    });
  });

  it("should handle PostManagerError properly", async () => {
    (authService.validateSession as jest.Mock).mockResolvedValueOnce({
      id: "user-456",
    });

    (postManager.deletePost as jest.Mock).mockRejectedValueOnce(
      new PostManagerError("NOT_FOUND", 404, "Post tidak ditemukan.")
    );

    const req = new NextRequest("http://localhost:3000/api/posts/post-missing", {
      method: "DELETE",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=valid-token`,
      },
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "post-missing" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});
