import {
  saveOfflineDraft,
  getOfflineDrafts,
  getOfflineDraftById,
  updateOfflineDraft,
  deleteOfflineDraft,
  getPendingDraftsCount,
  cacheConnectedAccounts,
  getCachedConnectedAccounts,
  cachePostsList,
  getCachedPost,
  _resetInMemoryStore,
  type CachedConnectedAccount,
  type CachedPostItem,
} from "@/lib/offline-drafts";

describe("offline-drafts", () => {
  beforeEach(() => {
    _resetInMemoryStore();
  });

  describe("saveOfflineDraft", () => {
    it("should create a new offline draft with generated ID and pending status", async () => {
      const draft = await saveOfflineDraft({
        textContent: "Ini draft offline pertama",
        targetAccountIds: ["acc-1", "acc-2"],
        mediaUrls: ["https://example.com/img.jpg"],
      });

      expect(draft.id).toBeDefined();
      expect(draft.id.startsWith("offline_")).toBe(true);
      expect(draft.textContent).toBe("Ini draft offline pertama");
      expect(draft.targetAccountIds).toEqual(["acc-1", "acc-2"]);
      expect(draft.mediaUrls).toEqual(["https://example.com/img.jpg"]);
      expect(draft.status).toBe("DRAFT");
      expect(draft.syncStatus).toBe("pending");
      expect(draft.createdAt).toBeDefined();
      expect(draft.updatedAt).toBeDefined();
    });

    it("should allow saving offline draft with custom or existing postId", async () => {
      const draft = await saveOfflineDraft({
        postId: "post-server-123",
        textContent: "Perubahan lokal untuk post server",
        targetAccountIds: ["acc-1"],
      });

      expect(draft.id).toBe("post-server-123");
      expect(draft.postId).toBe("post-server-123");
      expect(draft.textContent).toBe("Perubahan lokal untuk post server");
      expect(draft.syncStatus).toBe("pending");
    });

    it("should dispatch custom event on window when saving", async () => {
      const mockDispatch = jest.fn();
      const originalWindow = global.window;
      try {
        (global as unknown as { window: unknown }).window = {
          dispatchEvent: mockDispatch,
        };

        await saveOfflineDraft({
          textContent: "Test dispatch",
        });

        expect(mockDispatch).toHaveBeenCalled();
        const eventArg = mockDispatch.mock.calls[0]?.[0];
        expect(eventArg.type).toBe("mupost:offline-drafts-changed");
      } finally {
        global.window = originalWindow;
      }
    });
  });

  describe("getOfflineDrafts & getOfflineDraftById", () => {
    it("should retrieve all drafts sorted by createdAt descending", async () => {
      const draft1 = await saveOfflineDraft({ textContent: "Draft 1" });
      await new Promise((r) => setTimeout(r, 10));
      const draft2 = await saveOfflineDraft({ textContent: "Draft 2" });

      const all = await getOfflineDrafts();
      expect(all.length).toBe(2);
      expect(all[0]?.id).toBe(draft2.id);
      expect(all[1]?.id).toBe(draft1.id);
    });

    it("should get draft by ID or postId", async () => {
      await saveOfflineDraft({
        id: "custom-id-1",
        postId: "server-post-abc",
        textContent: "Draft targeted",
      });

      const foundById = await getOfflineDraftById("custom-id-1");
      expect(foundById).not.toBeNull();
      expect(foundById?.textContent).toBe("Draft targeted");

      const foundByPostId = await getOfflineDraftById("server-post-abc");
      expect(foundByPostId).not.toBeNull();
      expect(foundByPostId?.id).toBe("custom-id-1");

      const notFound = await getOfflineDraftById("non-existent");
      expect(notFound).toBeNull();
    });
  });

  describe("updateOfflineDraft", () => {
    it("should update specified fields and update updatedAt timestamp", async () => {
      const created = await saveOfflineDraft({
        textContent: "Teks lama",
        targetAccountIds: ["acc-1"],
      });

      const updated = await updateOfflineDraft(created.id, {
        textContent: "Teks baru yang sudah diedit",
        syncStatus: "syncing",
      });

      expect(updated).not.toBeNull();
      expect(updated?.textContent).toBe("Teks baru yang sudah diedit");
      expect(updated?.syncStatus).toBe("syncing");
      expect(updated?.targetAccountIds).toEqual(["acc-1"]);
    });

    it("should return null if draft to update does not exist", async () => {
      const result = await updateOfflineDraft("phantom-id", { textContent: "Test" });
      expect(result).toBeNull();
    });
  });

  describe("deleteOfflineDraft", () => {
    it("should delete existing draft and return true", async () => {
      const draft = await saveOfflineDraft({ textContent: "Akan dihapus" });
      expect(await getOfflineDraftById(draft.id)).not.toBeNull();

      const deleted = await deleteOfflineDraft(draft.id);
      expect(deleted).toBe(true);

      expect(await getOfflineDraftById(draft.id)).toBeNull();
    });
  });

  describe("getPendingDraftsCount", () => {
    it("should return correct count of pending and failed drafts", async () => {
      await saveOfflineDraft({ textContent: "Draft 1", syncStatus: "pending" });
      await saveOfflineDraft({ textContent: "Draft 2", syncStatus: "failed" });
      await saveOfflineDraft({ textContent: "Draft 3", syncStatus: "synced" });

      const count = await getPendingDraftsCount();
      expect(count).toBe(2);
    });
  });

  describe("cacheConnectedAccounts & getCachedConnectedAccounts", () => {
    it("should store and retrieve accounts for offline selector", async () => {
      const mockAccounts: CachedConnectedAccount[] = [
        { id: "acc-fb", platform: "META_PAGE", accountName: "My FB Page", status: "ACTIVE" },
        { id: "acc-ig", platform: "INSTAGRAM", accountName: "My IG Profile", status: "ACTIVE" },
      ];

      await cacheConnectedAccounts(mockAccounts);
      const retrieved = await getCachedConnectedAccounts();

      expect(retrieved).toHaveLength(2);
      expect(retrieved.find((a) => a.id === "acc-fb")?.accountName).toBe("My FB Page");
    });
  });

  describe("cachePostsList & getCachedPost", () => {
    it("should store and retrieve cached posts by ID", async () => {
      const mockPosts: CachedPostItem[] = [
        {
          id: "post-1",
          textContent: "Konten post 1",
          mediaUrls: null,
          status: "DRAFT",
          scheduledAt: null,
          publishedAt: null,
          createdAt: new Date().toISOString(),
          targets: [],
        },
      ];

      await cachePostsList(mockPosts);
      const post = await getCachedPost("post-1");

      expect(post).not.toBeNull();
      expect(post?.textContent).toBe("Konten post 1");
    });
  });
});
