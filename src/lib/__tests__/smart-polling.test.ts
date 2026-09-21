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
});
