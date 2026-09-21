import { PostManager, PostManagerError } from "../post-manager";
import * as platformAdaptersModule from "../platform-adapters";
import * as cryptoModule from "@/lib/crypto";
import { db } from "@/lib/db";
import { getPublishQueue } from "@/lib/queue/publish-queue";

// Mock dependencies
jest.mock("@/lib/db", () => {
  return {
    db: {
      select: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  };
});

jest.mock("@/lib/queue/publish-queue", () => ({
  getPublishQueue: jest.fn(() => ({
    remove: jest.fn(),
    getJob: jest.fn(),
    getDelayed: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("@/lib/crypto", () => ({
  decrypt: jest.fn((val: string) => `decrypted-${val}`),
  encrypt: jest.fn((val: string) => `encrypted-${val}`),
}));

describe("PostManager.deletePost", () => {
  let postManager: PostManager;
  const mockedDb = db as unknown as {
    select: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  const mockedGetPublishQueue = getPublishQueue as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    postManager = new PostManager();
  });

  it("should throw 404 NOT_FOUND if post does not exist", async () => {
    // Mock getPost: select from posts returns empty
    const selectMock = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    mockedDb.select.mockReturnValueOnce(selectMock);

    await expect(postManager.deletePost("user-1", "non-existent-post")).rejects.toThrow(
      PostManagerError
    );
  });

  it("should delete post locally without deleting on platforms when deleteOnPlatforms is false", async () => {
    const deleteFromPlatformSpy = jest.spyOn(platformAdaptersModule, "deleteFromPlatform");

    // 1. Mock getPost postRow
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          id: "post-1",
          userId: "user-1",
          status: "PUBLISHED",
          textContent: "Test content",
          meta: null,
        },
      ]),
    });

    // 2. Mock getPost targets
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([
        {
          id: "target-1",
          connectedAccountId: "acc-1",
          platform: "META_PAGE",
          status: "PUBLISHED",
          platformPostId: "fb-123",
        },
      ]),
    });

    // 3. Mock mockedDb.delete
    mockedDb.delete.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "post-1" }]),
    });

    const result = await postManager.deletePost("user-1", "post-1", {
      deleteOnPlatforms: false,
    });

    expect(result.success).toBe(true);
    expect(result.deletedPostId).toBe("post-1");
    expect(result.platformResults).toBeUndefined();
    expect(deleteFromPlatformSpy).not.toHaveBeenCalled();
    expect(mockedDb.delete).toHaveBeenCalled();
  });

  it("should cancel delayed BullMQ job when deleting a SCHEDULED post", async () => {
    const mockRemove = jest.fn().mockResolvedValue(undefined);
    mockedGetPublishQueue.mockReturnValueOnce({
      remove: mockRemove,
      getJob: jest.fn(),
      getDelayed: jest.fn().mockResolvedValue([]),
    });

    // Mock getPost
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          id: "post-sched-1",
          userId: "user-1",
          status: "SCHEDULED",
          meta: { bullmq_job_id: "bull-job-99" },
        },
      ]),
    });
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    });

    mockedDb.delete.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "post-sched-1" }]),
    });

    const result = await postManager.deletePost("user-1", "post-sched-1");
    expect(result.success).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith("bull-job-99");
  });

  it("should sync deletion to platforms for PUBLISHED targets with platformPostId", async () => {
    const deleteFromPlatformSpy = jest
      .spyOn(platformAdaptersModule, "deleteFromPlatform")
      .mockImplementation(async (platform, targetId, platformPostId) => {
        if (platform === "META_PAGE") {
          return {
            targetId,
            platform: "META_PAGE",
            platformPostId,
            success: true,
          };
        }
        if (platform === "INSTAGRAM") {
          return {
            targetId,
            platform: "INSTAGRAM",
            platformPostId,
            success: true,
            alreadyDeleted: true,
            errorMessage: "Postingan sudah dihapus sebelumnya dari Instagram.",
          };
        }
        return {
          targetId,
          platform: "THREADS",
          platformPostId,
          success: true,
        };
      });

    // 1. Mock getPost postRow
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          id: "post-pub-1",
          userId: "user-1",
          status: "PUBLISHED",
          textContent: "Multi-platform post",
          meta: null,
        },
      ]),
    });

    // 2. Mock getPost targets (2 published with platformPostId, 1 failed without platformPostId)
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([
        {
          id: "target-meta",
          connectedAccountId: "acc-meta",
          platform: "META_PAGE",
          status: "PUBLISHED",
          platformPostId: "meta-post-001",
        },
        {
          id: "target-ig",
          connectedAccountId: "acc-ig",
          platform: "INSTAGRAM",
          status: "PUBLISHED",
          platformPostId: "ig-media-002",
        },
        {
          id: "target-failed",
          connectedAccountId: "acc-meta",
          platform: "META_PAGE",
          status: "FAILED",
          platformPostId: null,
        },
      ]),
    });

    // 3. Mock query connectedAccounts for eligible targets
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([
        {
          id: "acc-meta",
          platform: "META_PAGE",
          accessTokenEnc: "enc-meta-token",
        },
        {
          id: "acc-ig",
          platform: "INSTAGRAM",
          accessTokenEnc: "enc-ig-token",
        },
      ]),
    });

    // 4. Mock mockedDb.delete posts
    mockedDb.delete.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "post-pub-1" }]),
    });

    const result = await postManager.deletePost("user-1", "post-pub-1", {
      deleteOnPlatforms: true,
    });

    expect(result.success).toBe(true);
    expect(result.deletedPostId).toBe("post-pub-1");
    expect(result.platformResults).toHaveLength(2);

    const metaRes = result.platformResults?.find((r) => r.platform === "META_PAGE");
    expect(metaRes?.success).toBe(true);
    expect(metaRes?.platformPostId).toBe("meta-post-001");

    const igRes = result.platformResults?.find((r) => r.platform === "INSTAGRAM");
    expect(igRes?.success).toBe(true);
    expect(igRes?.alreadyDeleted).toBe(true);

    expect(deleteFromPlatformSpy).toHaveBeenCalledTimes(2);
    expect(cryptoModule.decrypt).toHaveBeenCalledWith("enc-meta-token");
    expect(cryptoModule.decrypt).toHaveBeenCalledWith("enc-ig-token");
  });

  it("should mark connected_accounts as NEEDS_REAUTH if platform reports token expiration", async () => {
    jest.spyOn(platformAdaptersModule, "deleteFromPlatform").mockResolvedValueOnce({
      targetId: "target-fb-exp",
      platform: "META_PAGE",
      platformPostId: "fb-exp-123",
      success: false,
      needsReauth: true,
      errorCode: "TOKEN_EXPIRED",
      errorMessage: "Session expired",
    });

    // getPost postRow
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          id: "post-exp",
          userId: "user-1",
          status: "PUBLISHED",
        },
      ]),
    });

    // getPost targets
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([
        {
          id: "target-fb-exp",
          connectedAccountId: "acc-exp-1",
          platform: "META_PAGE",
          status: "PUBLISHED",
          platformPostId: "fb-exp-123",
        },
      ]),
    });

    // query accounts
    mockedDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([
        {
          id: "acc-exp-1",
          platform: "META_PAGE",
          accessTokenEnc: "enc-tok",
        },
      ]),
    });

    // update connected_accounts
    const updateMock = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    mockedDb.update.mockReturnValueOnce(updateMock);

    // delete post
    mockedDb.delete.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "post-exp" }]),
    });

    const result = await postManager.deletePost("user-1", "post-exp", {
      deleteOnPlatforms: true,
    });

    expect(result.success).toBe(true);
    expect(result.platformResults?.[0]?.needsReauth).toBe(true);
    expect(mockedDb.update).toHaveBeenCalled();
    expect(updateMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "NEEDS_REAUTH" })
    );
  });
});
