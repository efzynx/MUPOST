/**
 * Test suite untuk verifikasi dynamic interval logic dan deteksi transisi status postingan real-time.
 */

describe("Live Status Update & Dynamic Polling Logic", () => {
  describe("Interval selection logic", () => {
    function getDynamicInterval(
      hasActiveJobs: boolean,
      activeInterval = 3000,
      idleInterval = 15000
    ) {
      return hasActiveJobs ? activeInterval : idleInterval;
    }

    it("should use fast interval (3000ms) when there are active jobs in QUEUED or PUBLISHING status", () => {
      const posts = [
        { id: "1", status: "PUBLISHED" },
        { id: "2", status: "QUEUED" },
        { id: "3", status: "DRAFT" },
      ];

      const hasActive = posts.some(
        (p) => p.status === "QUEUED" || p.status === "PUBLISHING"
      );
      expect(hasActive).toBe(true);
      expect(getDynamicInterval(hasActive)).toBe(3000);
    });

    it("should use idle interval (15000ms) when all posts are settled", () => {
      const posts = [
        { id: "1", status: "PUBLISHED" },
        { id: "2", status: "FAILED" },
        { id: "3", status: "DRAFT" },
        { id: "4", status: "SCHEDULED" },
      ];

      const hasActive = posts.some(
        (p) => p.status === "QUEUED" || p.status === "PUBLISHING"
      );
      expect(hasActive).toBe(false);
      expect(getDynamicInterval(hasActive)).toBe(15000);
    });

    it("should detect active jobs when targets are still PENDING", () => {
      const post = {
        id: "1",
        status: "SCHEDULED",
        targets: [
          { id: "t1", status: "PUBLISHED" },
          { id: "t2", status: "PENDING" },
        ],
      };

      const hasActive =
        post.status === "QUEUED" ||
        post.status === "PUBLISHING" ||
        post.targets.some((t) => t.status === "PENDING");

      expect(hasActive).toBe(true);
      expect(getDynamicInterval(hasActive)).toBe(3000);
    });
  });

  describe("Status transition detection", () => {
    function detectStatusTransitions(
      prevItems: Array<{ id: string; status: string; textContent?: string }>,
      nextItems: Array<{ id: string; status: string; textContent?: string }>
    ) {
      const prevMap = new Map(prevItems.map((item) => [item.id, item.status]));
      const transitions: Array<{
        postId: string;
        oldStatus: string;
        newStatus: string;
      }> = [];

      for (const item of nextItems) {
        if (prevMap.has(item.id)) {
          const oldStatus = prevMap.get(item.id)!;
          if (oldStatus !== item.status) {
            transitions.push({
              postId: item.id,
              oldStatus,
              newStatus: item.status,
            });
          }
        }
      }

      return transitions;
    }

    it("should detect automatic transition from QUEUED to PUBLISHED", () => {
      const previous = [{ id: "post-1", status: "QUEUED" }];
      const current = [{ id: "post-1", status: "PUBLISHED" }];

      const transitions = detectStatusTransitions(previous, current);

      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        postId: "post-1",
        oldStatus: "QUEUED",
        newStatus: "PUBLISHED",
      });
    });

    it("should detect automatic transition from QUEUED to FAILED", () => {
      const previous = [{ id: "post-2", status: "QUEUED" }];
      const current = [{ id: "post-2", status: "FAILED" }];

      const transitions = detectStatusTransitions(previous, current);

      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        postId: "post-2",
        oldStatus: "QUEUED",
        newStatus: "FAILED",
      });
    });

    it("should detect transition from SCHEDULED -> PUBLISHING -> PUBLISHED", () => {
      const t1 = detectStatusTransitions(
        [{ id: "p3", status: "SCHEDULED" }],
        [{ id: "p3", status: "PUBLISHING" }]
      );
      expect(t1[0]).toEqual({
        postId: "p3",
        oldStatus: "SCHEDULED",
        newStatus: "PUBLISHING",
      });

      const t2 = detectStatusTransitions(
        [{ id: "p3", status: "PUBLISHING" }],
        [{ id: "p3", status: "PUBLISHED" }]
      );
      expect(t2[0]).toEqual({
        postId: "p3",
        oldStatus: "PUBLISHING",
        newStatus: "PUBLISHED",
      });
    });

    it("should return empty array if no status changed", () => {
      const previous = [
        { id: "p1", status: "PUBLISHED" },
        { id: "p2", status: "DRAFT" },
      ];
      const current = [
        { id: "p1", status: "PUBLISHED" },
        { id: "p2", status: "DRAFT" },
      ];

      const transitions = detectStatusTransitions(previous, current);
      expect(transitions).toHaveLength(0);
    });
  });

  describe("Real-time SSE event consumption & local state merge", () => {
    interface MockTarget {
      id: string;
      platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
      status: string;
      errorCode?: string | null;
      errorMessage?: string | null;
    }

    interface MockPost {
      id: string;
      status: string;
      publishedAt: string | null;
      targets: MockTarget[];
    }

    function applyPostStatusEvent(
      posts: MockPost[],
      event: {
        postId: string;
        status: string;
        publishedAt?: string | null;
        targets?: Array<{
          id: string;
          platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
          status: string;
          errorCode?: string | null;
          errorMessage?: string | null;
        }>;
      }
    ): MockPost[] {
      return posts.map((post) => {
        if (post.id !== event.postId) return post;
        return {
          ...post,
          status: event.status,
          publishedAt: event.publishedAt ?? post.publishedAt,
          targets: event.targets
            ? post.targets.map((t) => {
                const matched = event.targets?.find(
                  (et) => et.id === t.id || et.platform === t.platform
                );
                if (matched) {
                  return {
                    ...t,
                    status: matched.status,
                    errorCode: matched.errorCode ?? t.errorCode,
                    errorMessage: matched.errorMessage ?? t.errorMessage,
                  };
                }
                return t;
              })
            : post.targets,
        };
      });
    }

    it("should immediately update post status from QUEUED to PUBLISHING upon SSE event", () => {
      const initialPosts: MockPost[] = [
        {
          id: "post-100",
          status: "QUEUED",
          publishedAt: null,
          targets: [{ id: "t1", platform: "META_PAGE", status: "PENDING" }],
        },
      ];

      const updated = applyPostStatusEvent(initialPosts, {
        postId: "post-100",
        status: "PUBLISHING",
      });

      expect(updated[0].status).toBe("PUBLISHING");
      expect(updated[0].targets[0].status).toBe("PENDING");
    });

    it("should update post and all targets upon final PUBLISHED event", () => {
      const initialPosts: MockPost[] = [
        {
          id: "post-100",
          status: "PUBLISHING",
          publishedAt: null,
          targets: [
            { id: "t1", platform: "META_PAGE", status: "PENDING" },
            { id: "t2", platform: "INSTAGRAM", status: "PENDING" },
          ],
        },
      ];

      const publishTimestamp = "2026-09-21T09:30:00.000Z";
      const updated = applyPostStatusEvent(initialPosts, {
        postId: "post-100",
        status: "PUBLISHED",
        publishedAt: publishTimestamp,
        targets: [
          { id: "t1", platform: "META_PAGE", status: "PUBLISHED" },
          { id: "t2", platform: "INSTAGRAM", status: "PUBLISHED" },
        ],
      });

      expect(updated[0].status).toBe("PUBLISHED");
      expect(updated[0].publishedAt).toBe(publishTimestamp);
      expect(updated[0].targets[0].status).toBe("PUBLISHED");
      expect(updated[0].targets[1].status).toBe("PUBLISHED");
    });

    it("should handle partial failures with specific error codes", () => {
      const initialPosts: MockPost[] = [
        {
          id: "post-101",
          status: "PUBLISHING",
          publishedAt: null,
          targets: [
            { id: "t1", platform: "META_PAGE", status: "PENDING" },
            { id: "t2", platform: "TIKTOK", status: "PENDING" },
          ],
        },
      ];

      const updated = applyPostStatusEvent(initialPosts, {
        postId: "post-101",
        status: "PARTIAL",
        targets: [
          { id: "t1", platform: "META_PAGE", status: "PUBLISHED" },
          {
            id: "t2",
            platform: "TIKTOK",
            status: "FAILED",
            errorCode: "NETWORK_ERROR",
            errorMessage: "Connection reset",
          },
        ],
      });

      expect(updated[0].status).toBe("PARTIAL");
      expect(updated[0].targets[0].status).toBe("PUBLISHED");
      expect(updated[0].targets[1].status).toBe("FAILED");
      expect(updated[0].targets[1].errorCode).toBe("NETWORK_ERROR");
      expect(updated[0].targets[1].errorMessage).toBe("Connection reset");
    });
  });

  describe("Hybrid SSE & Polling Strategy", () => {
    function determineNextSyncInterval(options: {
      isSseConnected: boolean;
      hasActiveJobs: boolean;
      activeInterval?: number;
      idleInterval?: number;
      sseReconcileInterval?: number;
    }) {
      const {
        isSseConnected,
        hasActiveJobs,
        activeInterval = 3000,
        idleInterval = 15000,
        sseReconcileInterval = 30000,
      } = options;

      if (isSseConnected) {
        return sseReconcileInterval;
      }
      return hasActiveJobs ? activeInterval : idleInterval;
    }

    it("should use gentle reconcile interval (30000ms) when SSE is open and healthy", () => {
      const interval = determineNextSyncInterval({
        isSseConnected: true,
        hasActiveJobs: true,
      });
      expect(interval).toBe(30000);
    });

    it("should fall back to fast polling (3000ms) when SSE is disconnected and jobs are active", () => {
      const interval = determineNextSyncInterval({
        isSseConnected: false,
        hasActiveJobs: true,
      });
      expect(interval).toBe(3000);
    });

    it("should fall back to idle polling (15000ms) when SSE is disconnected and no jobs are active", () => {
      const interval = determineNextSyncInterval({
        isSseConnected: false,
        hasActiveJobs: false,
      });
      expect(interval).toBe(15000);
    });
  });
});
