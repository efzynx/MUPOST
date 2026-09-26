import {
  getMonthDays,
  getWeekDays,
  getMondayOfWeek,
  getNextMonth,
  getPrevMonth,
  getNextWeek,
  getPrevWeek,
  formatMonthYear,
  formatWeekRange,
  formatTime,
  toDateKey,
  isSameDay,
  type CalendarPostItem,
} from "@/lib/calendar-utils";

describe("Calendar Utilities", () => {
  const mockPosts: CalendarPostItem[] = [
    {
      id: "post-1",
      textContent: "Post scheduled on 15 March 2026",
      mediaUrls: null,
      status: "SCHEDULED",
      scheduledAt: "2026-03-15T10:30:00.000Z",
      publishedAt: null,
      createdAt: "2026-03-01T08:00:00.000Z",
      targets: [
        {
          id: "t1",
          connectedAccountId: "acc1",
          platform: "THREADS",
          status: "PENDING",
        },
      ],
    },
    {
      id: "post-2",
      textContent: "Post published on 15 March 2026 afternoon",
      mediaUrls: ["https://example.com/pic.jpg"],
      status: "PUBLISHED",
      scheduledAt: "2026-03-15T14:00:00.000Z",
      publishedAt: "2026-03-15T14:00:00.000Z",
      createdAt: "2026-03-01T08:00:00.000Z",
      targets: [
        {
          id: "t2",
          connectedAccountId: "acc2",
          platform: "INSTAGRAM",
          status: "PUBLISHED",
        },
      ],
    },
    {
      id: "post-3",
      textContent: "Post scheduled on 20 March 2026",
      mediaUrls: ["https://example.com/video.mp4"],
      status: "SCHEDULED",
      scheduledAt: "2026-03-20T09:00:00.000Z",
      publishedAt: null,
      createdAt: "2026-03-01T08:00:00.000Z",
      targets: [
        {
          id: "t3",
          connectedAccountId: "acc3",
          platform: "TIKTOK",
          status: "PENDING",
        },
      ],
    },
  ];

  describe("toDateKey and isSameDay", () => {
    it("formats date to YYYY-MM-DD", () => {
      const d = new Date(2026, 2, 15); // Month 2 is March
      expect(toDateKey(d)).toBe("2026-03-15");
    });

    it("accurately compares if two dates are on the same day", () => {
      const d1 = new Date(2026, 2, 15, 10, 0, 0);
      const d2 = new Date(2026, 2, 15, 23, 59, 59);
      const d3 = new Date(2026, 2, 16, 0, 0, 0);
      expect(isSameDay(d1, d2)).toBe(true);
      expect(isSameDay(d1, d3)).toBe(false);
    });
  });

  describe("formatMonthYear and formatWeekRange", () => {
    it("formats Indonesian month and year", () => {
      const d = new Date(2026, 2, 1);
      expect(formatMonthYear(d)).toBe("Maret 2026");
    });

    it("formats week range within the same month", () => {
      const start = new Date(2026, 2, 16);
      const end = new Date(2026, 2, 22);
      expect(formatWeekRange(start, end)).toBe("16 – 22 Maret 2026");
    });

    it("formats week range across months", () => {
      const start = new Date(2026, 2, 30);
      const end = new Date(2026, 3, 5); // April
      expect(formatWeekRange(start, end)).toBe("30 Maret – 5 April 2026");
    });
  });

  describe("getMondayOfWeek", () => {
    it("returns Monday when given a Sunday", () => {
      // 15 March 2026 is Sunday
      const sun = new Date(2026, 2, 15);
      const mon = getMondayOfWeek(sun);
      expect(mon.getDay()).toBe(1); // 1 = Monday
      expect(mon.getDate()).toBe(9); // Monday was 9 March 2026
    });

    it("returns Monday when given a Wednesday", () => {
      const wed = new Date(2026, 2, 18);
      const mon = getMondayOfWeek(wed);
      expect(mon.getDay()).toBe(1);
      expect(mon.getDate()).toBe(16);
    });
  });

  describe("getMonthDays matrix", () => {
    it("generates a complete month grid of 35 or 42 cells starting on Monday", () => {
      const march2026 = new Date(2026, 2, 1);
      const days = getMonthDays(march2026, mockPosts);

      expect(days.length % 7).toBe(0);
      expect(days[0]?.date.getDay()).toBe(1); // Starts on Monday

      // March 15th should have 2 posts
      const day15 = days.find((d) => d.dateString === "2026-03-15");
      expect(day15).toBeDefined();
      expect(day15?.posts).toHaveLength(2);
      expect(day15?.posts[0]?.id).toBe("post-1");
      expect(day15?.posts[1]?.id).toBe("post-2");

      // March 20th should have 1 post
      const day20 = days.find((d) => d.dateString === "2026-03-20");
      expect(day20).toBeDefined();
      expect(day20?.posts).toHaveLength(1);
      expect(day20?.posts[0]?.id).toBe("post-3");
    });
  });

  describe("getWeekDays matrix", () => {
    it("generates 7 consecutive days starting on Monday with matching posts", () => {
      const targetDate = new Date(2026, 2, 15); // Week containing March 15
      const week = getWeekDays(targetDate, mockPosts);

      expect(week).toHaveLength(7);
      expect(week[0]?.date.getDay()).toBe(1); // Monday
      expect(week[6]?.date.getDay()).toBe(0); // Sunday

      const sunday = week[6];
      expect(sunday?.dateString).toBe("2026-03-15");
      expect(sunday?.posts).toHaveLength(2);
    });
  });

  describe("Period navigation", () => {
    it("moves forward and backward by month", () => {
      const base = new Date(2026, 2, 15);
      const next = getNextMonth(base);
      expect(next.getMonth()).toBe(3); // April
      const prev = getPrevMonth(base);
      expect(prev.getMonth()).toBe(1); // February
    });

    it("moves forward and backward by week", () => {
      const base = new Date(2026, 2, 15);
      const nextW = getNextWeek(base);
      expect(nextW.getDate()).toBe(22);
      const prevW = getPrevWeek(base);
      expect(prevW.getDate()).toBe(8);
    });
  });

  describe("formatTime", () => {
    it("returns formatted time or fallback", () => {
      expect(formatTime(null)).toBe("--:--");
      expect(formatTime("invalid-date")).toBe("--:--");
      const formatted = formatTime("2026-03-15T14:30:00.000Z");
      expect(formatted).toMatch(/\d{2}[:.]\d{2}/);
    });
  });
});
