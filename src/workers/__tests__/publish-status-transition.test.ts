import { processPublishJob } from "../publish-worker";
import { db } from "@/lib/db";
import * as postEventsModule from "@/lib/services/post-events";
import * as cryptoModule from "@/lib/crypto";

// Mock db
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}));

describe("Publish Worker: Status Transition & Real-Time Events", () => {
  const mockPostId = "post-test-123";
  const mockUserId = "user-test-456";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should transition status to PUBLISHING and emit event when job starts, then transition to PUBLISHED when done", async () => {
    const mockPost = {
      id: mockPostId,
      userId: mockUserId,
      status: "QUEUED",
      textContent: "Hello World",
      mediaUrls: [],
      publishedAt: null,
    };

    const mockTarget = {
      id: "target-1",
      postId: mockPostId,
      connectedAccountId: "acc-1",
      platform: "META_PAGE",
      status: "PENDING",
      retryCount: 0,
    };

    const mockAccount = {
      id: "acc-1",
      userId: mockUserId,
      platform: "META_PAGE",
      platformAccountId: "fb-page-1",
      accessTokenEnc: "encrypted-token",
      status: "ACTIVE",
    };

    // Mock db.select chains
    let selectCallCount = 0;
    (db.select as jest.Mock).mockImplementation(() => ({
      from: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // posts query: returns [mockPost] via limit(1)
            return {
              limit: jest.fn().mockResolvedValue([mockPost]),
            };
          } else if (selectCallCount === 2) {
            // targets query: returns [mockTarget]
            return Promise.resolve([mockTarget]);
          } else {
            // accounts query: returns [mockAccount]
            return Promise.resolve([mockAccount]);
          }
        }),
      })),
    }));

    // Mock db.update chains
    const updateSetMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue({}),
    });
    (db.update as jest.Mock).mockReturnValue({
      set: updateSetMock,
    });

    // Mock crypto decrypt
    jest.spyOn(cryptoModule, "decrypt").mockReturnValue("decrypted-token");

    // Mock fetch for Meta API
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "fb-post-success-123" }),
    } as any);

    // Spy on publishPostEvent
    const publishEventSpy = jest
      .spyOn(postEventsModule, "publishPostEvent")
      .mockResolvedValue(undefined);

    const result = await processPublishJob({
      data: { postId: mockPostId },
    });

    // Restore fetch
    global.fetch = originalFetch;

    expect(result.postStatus).toBe("PUBLISHED");

    // Verify first update was PUBLISHING
    expect(updateSetMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "PUBLISHING",
      })
    );

    // Verify first event emitted was PUBLISHING
    expect(publishEventSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "POST_STATUS_CHANGED",
        postId: mockPostId,
        userId: mockUserId,
        status: "PUBLISHING",
      })
    );

    // Verify second event emitted was final status PUBLISHED
    expect(publishEventSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "POST_STATUS_CHANGED",
        postId: mockPostId,
        userId: mockUserId,
        status: "PUBLISHED",
      })
    );
  });
});
