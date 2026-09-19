/**
 * Preview Engine Service
 *
 * Merender pratinjau HTML simulasi feed untuk platform Facebook, Instagram, dan TikTok.
 * Menghitung batas karakter dan kebutuhan media per platform.
 */

export interface PreviewInput {
  textContent: string;
  mediaUrls?: string[];
  mediaType?: "image" | "video";
  accountName?: string;
}

export interface PreviewResult {
  html: string;
  characterCount: number;
  characterLimit: number;
  exceedsLimit: boolean;
  requiresMedia: boolean;
  hasMedia: boolean;
}

export const PLATFORM_LIMITS = {
  facebook: 63_206,
  instagram: 2_200,
  tiktok: 2_200,
  threads: 500,
} as const;

/**
 * Escape string HTML untuk mencegah XSS pada rendering pratinjau.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}

/**
 * Render simulasi feed pratinjau Facebook
 * - Limit: 63.206 karakter
 * - Media opsional
 */
export function renderFacebookPreview(data: PreviewInput): PreviewResult {
  const text = data.textContent || "";
  const characterCount = text.length;
  const characterLimit = PLATFORM_LIMITS.facebook;
  const exceedsLimit = characterCount > characterLimit;
  const hasMedia = Boolean(data.mediaUrls && data.mediaUrls.length > 0);
  const requiresMedia = false;
  const accountName = data.accountName || "Facebook Page";

  const firstMedia = hasMedia && data.mediaUrls ? data.mediaUrls[0] : null;
  const isVideo =
    data.mediaType === "video" ||
    (firstMedia ? Boolean(firstMedia.match(/\.(mp4|mov|webm)$/i)) : false);

  let mediaHtml = "";
  if (firstMedia) {
    if (isVideo) {
      mediaHtml = `
        <div class="fb-media-container" style="background:#000; border-radius:4px; overflow:hidden; margin-top:8px;">
          <video src="${escapeHtml(firstMedia)}" controls style="width:100%; max-height:400px; display:block; object-fit:contain;"></video>
        </div>
      `;
    } else {
      mediaHtml = `
        <div class="fb-media-container" style="margin-top:8px; border-radius:4px; overflow:hidden;">
          <img src="${escapeHtml(firstMedia)}" alt="Facebook post media" style="width:100%; max-height:450px; object-fit:cover; display:block;" />
        </div>
      `;
    }
  }

  const html = `
    <div class="fb-preview-card" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #050505; border: 1px solid #ced0d4; border-radius: 8px; padding: 12px; max-width: 500px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <div style="width:40px; height:40px; border-radius:50%; background:#1877f2; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:16px;">
          ${escapeHtml(accountName.charAt(0).toUpperCase())}
        </div>
        <div>
          <div style="font-weight:600; font-size:14px; color:#050505;">${escapeHtml(accountName)}</div>
          <div style="font-size:12px; color:#65676b; display:flex; align-items:center; gap:4px;">
            <span>Baru saja</span> • <span>🌐</span>
          </div>
        </div>
      </div>
      <div style="font-size:14px; line-height:1.4; color:#050505; white-space:pre-wrap; word-break:break-word;">
        ${escapeHtml(text)}
      </div>
      ${mediaHtml}
      <div style="margin-top:12px; padding-top:8px; border-top:1px solid #e4e6eb; display:flex; justify-content:space-around; font-size:13px; font-weight:600; color:#65676b;">
        <span style="display:flex; align-items:center; gap:4px;">👍 Suka</span>
        <span style="display:flex; align-items:center; gap:4px;">💬 Komentar</span>
        <span style="display:flex; align-items:center; gap:4px;">↗️ Bagikan</span>
      </div>
    </div>
  `.trim();

  return {
    html,
    characterCount,
    characterLimit,
    exceedsLimit,
    requiresMedia,
    hasMedia,
  };
}

/**
 * Render simulasi feed pratinjau Instagram
 * - Limit: 2.200 karakter
 * - Wajib ada media (gambar atau video)
 */
export function renderInstagramPreview(data: PreviewInput): PreviewResult {
  const text = data.textContent || "";
  const characterCount = text.length;
  const characterLimit = PLATFORM_LIMITS.instagram;
  const exceedsLimit = characterCount > characterLimit;
  const hasMedia = Boolean(data.mediaUrls && data.mediaUrls.length > 0);
  const requiresMedia = true;
  const accountName = data.accountName || "instagram_user";

  const firstMedia = hasMedia && data.mediaUrls ? data.mediaUrls[0] : null;
  const isVideo =
    data.mediaType === "video" ||
    (firstMedia ? Boolean(firstMedia.match(/\.(mp4|mov|webm)$/i)) : false);

  let mediaHtml = "";
  if (firstMedia) {
    if (isVideo) {
      mediaHtml = `
        <div style="position:relative; width:100%; aspect-ratio:1/1; background:#000; overflow:hidden;">
          <video src="${escapeHtml(firstMedia)}" controls style="width:100%; height:100%; object-fit:cover;"></video>
        </div>
      `;
    } else {
      mediaHtml = `
        <div style="position:relative; width:100%; aspect-ratio:1/1; background:#111; overflow:hidden;">
          <img src="${escapeHtml(firstMedia)}" alt="Instagram post" style="width:100%; height:100%; object-fit:cover; display:block;" />
        </div>
      `;
    }
  } else {
    mediaHtml = `
      <div style="width:100%; aspect-ratio:1/1; background:#f0f2f5; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#8e8e8e; gap:8px;">
        <span style="font-size:32px;">📷</span>
        <span style="font-size:13px; font-weight:500;">Instagram memerlukan media (gambar/video)</span>
      </div>
    `;
  }

  const html = `
    <div class="ig-preview-card" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#ffffff; color:#262626; border:1px solid #dbdbdb; border-radius:8px; overflow:hidden; max-width:400px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); padding:2px; display:flex; align-items:center; justify-content:center;">
            <div style="width:100%; height:100%; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; color:#262626;">
              ${escapeHtml(accountName.charAt(0).toUpperCase())}
            </div>
          </div>
          <span style="font-weight:600; font-size:13px;">${escapeHtml(accountName)}</span>
        </div>
        <span style="font-size:16px; color:#8e8e8e;">•••</span>
      </div>
      ${mediaHtml}
      <div style="padding:10px 12px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:20px;">
          <div style="display:flex; gap:12px;">
            <span>🤍</span>
            <span>💬</span>
            <span>↗️</span>
          </div>
          <span>🔖</span>
        </div>
        <div style="font-size:13px; line-height:1.4; word-break:break-word;">
          <span style="font-weight:600; margin-right:6px;">${escapeHtml(accountName)}</span>
          <span style="color:#262626;">${escapeHtml(text)}</span>
        </div>
      </div>
    </div>
  `.trim();

  return {
    html,
    characterCount,
    characterLimit,
    exceedsLimit,
    requiresMedia,
    hasMedia,
  };
}

/**
 * Render simulasi feed pratinjau TikTok
 * - Limit: 2.200 karakter
 * - Wajib ada media (video)
 */
export function renderTikTokPreview(data: PreviewInput): PreviewResult {
  const text = data.textContent || "";
  const characterCount = text.length;
  const characterLimit = PLATFORM_LIMITS.tiktok;
  const exceedsLimit = characterCount > characterLimit;
  const hasMedia = Boolean(data.mediaUrls && data.mediaUrls.length > 0);
  const requiresMedia = true;
  const accountName = data.accountName || "tiktok_creator";

  const firstMedia = hasMedia && data.mediaUrls ? data.mediaUrls[0] : null;

  let mediaHtml = "";
  if (firstMedia) {
    mediaHtml = `
      <video src="${escapeHtml(firstMedia)}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>
    `;
  } else {
    mediaHtml = `
      <div style="width:100%; height:100%; background:linear-gradient(180deg, #121212 0%, #1e1e24 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#ffffff; padding:20px; text-align:center;">
        <span style="font-size:40px; margin-bottom:10px;">🎵</span>
        <span style="font-size:14px; font-weight:600; color:#fe2c55;">TikTok memerlukan video</span>
        <span style="font-size:12px; color:#888; margin-top:4px;">Upload video untuk melihat simulasi feed vertikal</span>
      </div>
    `;
  }

  const html = `
    <div class="tiktok-preview-card" style="position:relative; width:280px; height:500px; background:#000000; border-radius:16px; overflow:hidden; font-family:'Proxima Nova', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#ffffff; box-shadow:0 8px 24px rgba(0,0,0,0.3); border:2px solid #222;">
      <div style="width:100%; height:100%; position:absolute; top:0; left:0;">
        ${mediaHtml}
      </div>
      <!-- Gradient overlay bottom -->
      <div style="position:absolute; bottom:0; left:0; right:0; height:180px; background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); pointer-events:none;"></div>
      
      <!-- Right action buttons -->
      <div style="position:absolute; right:10px; bottom:60px; display:flex; flex-direction:column; align-items:center; gap:16px; font-size:11px; z-index:2;">
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:18px;">❤️</div>
          <span style="margin-top:2px; font-weight:600;">Like</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:18px;">💬</div>
          <span style="margin-top:2px; font-weight:600;">Komentar</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:18px;">🔖</div>
          <span style="margin-top:2px; font-weight:600;">Simpan</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:18px;">↗️</div>
          <span style="margin-top:2px; font-weight:600;">Bagikan</span>
        </div>
      </div>

      <!-- Bottom metadata -->
      <div style="position:absolute; bottom:16px; left:12px; right:60px; z-index:2;">
        <div style="font-weight:700; font-size:14px; margin-bottom:6px;">@${escapeHtml(accountName)}</div>
        <div style="font-size:12px; line-height:1.3; max-height:60px; overflow:hidden; text-overflow:ellipsis; word-break:break-word; margin-bottom:8px;">
          ${escapeHtml(text)}
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size:11px; opacity:0.85;">
          <span>🎵</span>
          <span>Suara Asli - @${escapeHtml(accountName)}</span>
        </div>
      </div>
    </div>
  `.trim();

  return {
    html,
    characterCount,
    characterLimit,
    exceedsLimit,
    requiresMedia,
    hasMedia,
  };
}

/**
 * Render simulasi feed pratinjau Threads
 * - Limit: 500 karakter
 * - Media opsional (gambar atau video)
 */
export function renderThreadsPreview(data: PreviewInput): PreviewResult {
  const text = data.textContent || "";
  const characterCount = text.length;
  const characterLimit = PLATFORM_LIMITS.threads;
  const exceedsLimit = characterCount > characterLimit;
  const hasMedia = Boolean(data.mediaUrls && data.mediaUrls.length > 0);
  const requiresMedia = false;
  const accountName = data.accountName || "threads_user";

  const firstMedia = hasMedia && data.mediaUrls ? data.mediaUrls[0] : null;
  const isVideo =
    data.mediaType === "video" ||
    (firstMedia ? Boolean(firstMedia.match(/\.(mp4|mov|webm)$/i)) : false);

  let mediaHtml = "";
  if (firstMedia) {
    if (isVideo) {
      mediaHtml = `
        <div style="border-radius:12px; overflow:hidden; margin-top:10px; border:1px solid #333; background:#000;">
          <video src="${escapeHtml(firstMedia)}" controls style="width:100%; max-height:360px; object-fit:contain; display:block;"></video>
        </div>
      `;
    } else {
      mediaHtml = `
        <div style="border-radius:12px; overflow:hidden; margin-top:10px; border:1px solid #333;">
          <img src="${escapeHtml(firstMedia)}" alt="Threads post media" style="width:100%; max-height:360px; object-fit:cover; display:block;" />
        </div>
      `;
    }
  }

  const html = `
    <div class="threads-preview-card" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#101010; color:#f3f5f7; border:1px solid #282828; border-radius:16px; padding:16px; max-width:440px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
      <div style="display:flex; gap:12px;">
        <!-- Left: Avatar & Vertical line -->
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div style="width:36px; height:36px; border-radius:50%; background:#262626; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px; color:#fff; border:1px solid #3a3a3a;">
            ${escapeHtml(accountName.charAt(0).toUpperCase())}
          </div>
          <div style="width:2px; flex:1; background:#282828; margin:8px 0; min-height:30px;"></div>
        </div>

        <!-- Right: Content -->
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-weight:600; font-size:14px; color:#fff;">${escapeHtml(accountName)}</span>
              <span style="font-size:12px; color:#777;">1 mnt</span>
            </div>
            <span style="color:#777; font-size:16px;">•••</span>
          </div>

          <div style="font-size:14px; line-height:1.45; color:#f3f5f7; white-space:pre-wrap; word-break:break-word;">
            ${escapeHtml(text)}
          </div>

          ${mediaHtml}

          <!-- Actions -->
          <div style="display:flex; align-items:center; gap:16px; margin-top:14px; color:#f3f5f7; font-size:18px;">
            <span style="cursor:pointer;">🤍</span>
            <span style="cursor:pointer;">💬</span>
            <span style="cursor:pointer;">🔁</span>
            <span style="cursor:pointer;">↗️</span>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  return {
    html,
    characterCount,
    characterLimit,
    exceedsLimit,
    requiresMedia,
    hasMedia,
  };
}

export const previewEngine = {
  renderFacebookPreview,
  renderInstagramPreview,
  renderTikTokPreview,
  renderThreadsPreview,
};
