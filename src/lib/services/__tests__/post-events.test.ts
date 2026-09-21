import {
  publishPostEvent,
  getPostEventsChannel,
  localPostEvents,
  POST_EVENTS_GLOBAL_CHANNEL,
} from "../post-events";
import * as redisModule from "@/lib/redis";

describe("post-events service", () => {
  it("should generate correct user post events channel", () => {
    const channel = getPostEventsChannel("user-123");
    expect(channel).toBe("user:user-123:posts:events");
  });

  it("should emit event to localPostEvents and publish to Redis", async () => {
    const mockPublish = jest.fn().mockResolvedValue(1);
    jest.spyOn(redisModule, "getRedisClient").mockReturnValue({
      publish: mockPublish,
    } as any);

    const receivedEvents: any[] = [];
    const listener = (event: any) => receivedEvents.push(event);
    localPostEvents.on("event", listener);

    await publishPostEvent({
      type: "POST_STATUS_CHANGED",
      postId: "post-abc",
      userId: "user-123",
      status: "PUBLISHING",
    });

    localPostEvents.off("event", listener);

    // Verify local emission
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].postId).toBe("post-abc");
    expect(receivedEvents[0].status).toBe("PUBLISHING");
    expect(receivedEvents[0].timestamp).toBeDefined();

    // Verify Redis publish
    expect(mockPublish).toHaveBeenCalledWith(
      "user:user-123:posts:events",
      expect.stringContaining('"status":"PUBLISHING"')
    );
    expect(mockPublish).toHaveBeenCalledWith(
      POST_EVENTS_GLOBAL_CHANNEL,
      expect.stringContaining('"status":"PUBLISHING"')
    );
  });

  it("should handle Redis failure gracefully without throwing", async () => {
    jest.spyOn(redisModule, "getRedisClient").mockReturnValue({
      publish: jest.fn().mockRejectedValue(new Error("Redis connection lost")),
    } as any);

    await expect(
      publishPostEvent({
        type: "POST_STATUS_CHANGED",
        postId: "post-fail",
        userId: "user-999",
        status: "FAILED",
      })
    ).resolves.not.toThrow();
  });
});
