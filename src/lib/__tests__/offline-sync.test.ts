import { syncOfflineDrafts, isSyncInProgress } from "@/lib/offline-sync";
import { saveOfflineDraft, getOfflineDraftById, _resetInMemoryStore } from "@/lib/offline-drafts";
import * as apiClient from "@/lib/api-client";
import * as pwaCache from "@/lib/pwa-cache";

jest.mock("@/lib/api-client");
jest.mock("@/lib/pwa-cache");

describe("offline-sync", () => {
  beforeEach(() => {
    _resetInMemoryStore();
    jest.clearAllMocks();
  });

  it("should return zeros when there are no pending drafts", async () => {
    const result = await syncOfflineDrafts();
    expect(result).toEqual({ total: 0, succeeded: 0, failed: 0, errors: [] });
    expect(isSyncInProgress()).toBe(false);
  });

  it("should skip synchronization if navigator.onLine is false", async () => {
    const originalNavigator = global.navigator;
    try {
      (global as unknown as { navigator: unknown }).navigator = {
        onLine: false,
      };

      await saveOfflineDraft({ textContent: "Draft offline" });

      const result = await syncOfflineDrafts();
      expect(result).toEqual({ total: 0, succeeded: 0, failed: 0, errors: [] });
      expect(apiClient.apiFetch).not.toHaveBeenCalled();
    } finally {
      global.navigator = originalNavigator;
    }
  });

  it("should sync a new offline draft via POST /api/posts and delete it on success", async () => {
    const draft = await saveOfflineDraft({
      textContent: "Draft baru untuk di-sync",
      targetAccountIds: ["acc-1"],
      mediaUrls: ["https://example.com/photo.jpg"],
    });

    (apiClient.apiFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { data: { id: "server-post-created-1" } },
    });

    const result = await syncOfflineDrafts();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    expect(apiClient.apiFetch).toHaveBeenCalledWith("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        textContent: "Draft baru untuk di-sync",
        mediaUrls: ["https://example.com/photo.jpg"],
        targetAccountIds: ["acc-1"],
        scheduledAt: null,
      }),
    });

    // Draft harus terhapus dari local store setelah berhasil di-sync
    const remainingDraft = await getOfflineDraftById(draft.id);
    expect(remainingDraft).toBeNull();

    // Cache posts PWA harus di-invalidate
    expect(pwaCache.invalidatePostsCache).toHaveBeenCalled();
  });

  it("should sync an edited post draft via PATCH /api/posts/:id and delete it on success", async () => {
    const draft = await saveOfflineDraft({
      postId: "server-post-999",
      textContent: "Teks yang diperbarui saat offline",
      targetAccountIds: ["acc-2"],
      mediaUrls: [],
    });

    (apiClient.apiFetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { data: { id: "server-post-999" } },
    });

    const result = await syncOfflineDrafts();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    expect(apiClient.apiFetch).toHaveBeenCalledWith("/api/posts/server-post-999", {
      method: "PATCH",
      body: JSON.stringify({
        textContent: "Teks yang diperbarui saat offline",
        mediaUrls: [],
        targetAccountIds: ["acc-2"],
        scheduledAt: null,
      }),
    });

    const remainingDraft = await getOfflineDraftById(draft.id);
    expect(remainingDraft).toBeNull();
  });

  it("should handle API failure and mark draft as failed with error details", async () => {
    const draft = await saveOfflineDraft({
      textContent: "Draft gagal",
      targetAccountIds: ["acc-1"],
    });

    (apiClient.apiFetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      data: { error: { message: "Akun target tidak valid" } },
    });

    const result = await syncOfflineDrafts();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ id: draft.id, error: "Akun target tidak valid" }]);

    const updated = await getOfflineDraftById(draft.id);
    expect(updated).not.toBeNull();
    expect(updated?.syncStatus).toBe("failed");
    expect(updated?.lastSyncError).toBe("Akun target tidak valid");
    expect(updated?.retryCount).toBe(1);
  });

  it("should handle network exceptions gracefully and retain draft for retry", async () => {
    const draft = await saveOfflineDraft({
      textContent: "Draft dengan exception",
      targetAccountIds: ["acc-1"],
    });

    (apiClient.apiFetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network timeout during fetch")
    );

    const result = await syncOfflineDrafts();

    expect(result.total).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toBe("Network timeout during fetch");

    const updated = await getOfflineDraftById(draft.id);
    expect(updated?.syncStatus).toBe("failed");
    expect(updated?.lastSyncError).toBe("Network timeout during fetch");
  });

  it("should report progress via onProgress callback", async () => {
    await saveOfflineDraft({ textContent: "Draft 1" });
    await saveOfflineDraft({ textContent: "Draft 2" });

    (apiClient.apiFetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const progressCalls: Array<[number, number]> = [];
    const onProgress = (succeeded: number, total: number) => {
      progressCalls.push([succeeded, total]);
    };

    await syncOfflineDrafts({ onProgress });

    expect(progressCalls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});
