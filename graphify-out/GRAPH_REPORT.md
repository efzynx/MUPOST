# Graph Report - mupost  (2026-09-30)

## Corpus Check
- 158 files · ~132,388 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1039 nodes · 2590 edges · 58 communities (49 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e2951e22`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- $
- edit/page.tsx
- devDependencies
- dependencies
- getRedisClient
- next
- content-calendar-view.tsx
- offline-drafts.ts
- queue-monitor-service.ts
- cn
- compilerOptions
- PostManagerError
- auth-service.ts
- scripts
- csv-processor.ts
- README.md
- theme-toggle.tsx
- cookies.ts
- 0000_vengeful_thunderball.sql
- publish-worker.ts
- media-uploader.ts
- dashboard/page.tsx
- schema.ts
- token-refresh-worker.ts
- platform-connector.ts
- post-events.ts
- token-health-service.ts
- rules
- apiFetch
- posts/page.tsx
- AGENTS.md
- CLAUDE.md
- manifest.json
- preview-engine.ts
- dev-all.sh
- smart-polling.test.ts
- next.config.mjs
- post-manager.ts
- image-compressor.ts
- worker/index.ts
- delete-post-modal.tsx
- platform-constraints.ts
- db/index.ts
- queueMonitorService
- env.ts
- drizzle-kit
- postcss.config.mjs
- tailwindcss
- package.json

## God Nodes (most connected - your core abstractions)
1. `next` - 44 edges
2. `cn()` - 40 edges
3. `$` - 35 edges
4. `authService` - 35 edges
5. `PlatformType` - 34 edges
6. `react` - 34 edges
7. `SESSION_COOKIE_NAME` - 28 edges
8. `scripts` - 26 edges
9. `getRedisClient()` - 25 edges
10. `Button` - 22 edges

## Surprising Connections (you probably didn't know these)
- `TargetStatusSummary` --references--> `PlatformType`  [EXTRACTED]
  src/lib/hooks/use-post-realtime.ts → src/lib/db/schema.ts
- `TargetStatusSummary` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/post-events.ts → src/lib/db/schema.ts
- `UserTokenAlert` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/token-health-service.ts → src/lib/db/schema.ts
- `PublishQueueOptions` --references--> `getRedisClient()`  [EXTRACTED]
  src/lib/queue/publish-queue.ts → src/lib/redis.ts
- `PostsListContent()` --calls--> `formatDeleteFeedbackMessage()`  [EXTRACTED]
  src/app/(dashboard)/posts/page.tsx → src/lib/services/post-delete-helpers.ts

## Import Cycles
- None detected.

## Communities (58 total, 9 thin omitted)

### Community 0 - "$"
Cohesion: 0.06
Nodes (24): $, a, b, D(), deleteCacheAndMetadata(), et, F, g() (+16 more)

### Community 1 - "edit/page.tsx"
Cohesion: 0.12
Nodes (40): lucide-react, react, DashboardPage(), getPlatformIcon(), ConnectedAccount, PostData, PostTarget, PreviewPanel (+32 more)

### Community 2 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, drizzle-kit, esbuild, eslint, eslint-config-next, eslint-config-prettier, fast-check, jest (+17 more)

### Community 3 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, bcrypt, bullmq, clsx, drizzle-orm (+15 more)

### Community 4 - "getRedisClient"
Cohesion: 0.21
Nodes (6): decrypt(), encrypt(), getEncryptionKey(), getRedisClient(), PlatformConnectorService, PlatformError

### Community 5 - "next"
Cohesion: 0.08
Nodes (8): next, RouteParams, RouteParams, RouteParams, DELETE(), RouteParams, SESSION_COOKIE_NAME, postManager

### Community 6 - "content-calendar-view.tsx"
Cohesion: 0.17
Nodes (31): ContentCalendarView(), ContentCalendarViewProps, DayDetailModal(), DayDetailModalProps, getPlatformIcon(), getStatusBadge(), MonthCalendarGrid(), MonthCalendarGridProps (+23 more)

### Community 7 - "offline-drafts.ts"
Cohesion: 0.20
Nodes (27): useOfflineDraftSync(), cacheConnectedAccounts(), CachedConnectedAccount, CachedPostItem, cachePostsList(), deleteOfflineDraft(), dispatchEvent(), getCachedConnectedAccounts() (+19 more)

### Community 8 - "queue-monitor-service.ts"
Cohesion: 0.13
Nodes (13): POST(), GET(), connectedAccounts, posts, createPublishQueue(), PUBLISH_QUEUE_NAME, PublishJobData, publishQueue (+5 more)

### Community 9 - "cn"
Cohesion: 0.21
Nodes (26): LoginPage(), RegisterPage(), AdminQueuesPage(), QueueMetrics, QueuesSummary, SerializedJob, CsvImportPage(), CsvRowError (+18 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "PostManagerError"
Cohesion: 0.37
Nodes (4): getPublishQueue(), publishPostEvent(), PostManagerError, PostManagerService

### Community 12 - "auth-service.ts"
Cohesion: 0.14
Nodes (11): RFC-5322, User, authService, getJwtSecret(), hashToken(), LoginInput, RateLimitResult, RegisterInput (+3 more)

### Community 13 - "scripts"
Cohesion: 0.08
Nodes (26): scripts, all, build, db:generate, db:migrate, dev, dev:all, docker:build (+18 more)

### Community 14 - "csv-processor.ts"
Cohesion: 0.09
Nodes (15): papaparse, ALLOWED_PLATFORMS, CSV_PLATFORM_MAP, CsvParseResult, CsvPlatform, csvProcessor, CsvProcessorError, CsvProcessorService (+7 more)

### Community 15 - "README.md"
Cohesion: 0.04
Nodes (47): 1. Buat Database, 1. Clone Repository, 1. Salin File `.env.example`, 2. Edit File `.env`, 2. Instal Dependensi, 2. Jalankan Migrasi, 3. Generate Kunci Enkripsi (jika belum ada), 3. (Opsional) Buat Bucket MinIO (+39 more)

### Community 16 - "theme-toggle.tsx"
Cohesion: 0.13
Nodes (21): next-themes, src_app_globals, geistMono, geistSans, metadata, RootLayout(), viewport, ThemeProvider() (+13 more)

### Community 17 - "cookies.ts"
Cohesion: 0.19
Nodes (15): POST(), POST(), CookieOptions, CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS, CSRF_HEADER_NAME, SESSION_COOKIE_OPTIONS, generateCsrfToken() (+7 more)

### Community 18 - "0000_vengeful_thunderball.sql"
Cohesion: 0.18
Nodes (18): "connected_accounts", idx_connected_accounts_expires, idx_connected_accounts_user_id, idx_post_targets_pending, idx_post_targets_post_id, idx_posts_scheduled, idx_posts_status, idx_posts_user_id (+10 more)

### Community 19 - "publish-worker.ts"
Cohesion: 0.09
Nodes (41): ioredis, db, PlatformType, calculateRateLimitBackoff(), DEFAULT_BACKOFF_CONFIG, DEFAULT_PLATFORM_RATE_LIMITS, extractRateLimitInfo(), PlatformRateLimitConfig (+33 more)

### Community 20 - "media-uploader.ts"
Cohesion: 0.18
Nodes (18): @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, POST(), detectMimeFromBytes(), extFromMime(), FileInput, generatePresignedUrl() (+10 more)

### Community 21 - "dashboard/page.tsx"
Cohesion: 0.12
Nodes (22): ConnectedAccount, DashboardData, DashboardStats, formatDate(), getStatusBadge(), PostItem, PostTarget, TokenAlert (+14 more)

### Community 22 - "schema.ts"
Cohesion: 0.10
Nodes (19): accountStatusEnum, connectedAccountsRelations, NewConnectedAccount, NewPost, NewPostTarget, NewSession, NewUser, platformTypeEnum (+11 more)

### Community 23 - "token-refresh-worker.ts"
Cohesion: 0.22
Nodes (14): bullmq, createTokenRefreshQueue(), getTokenRefreshQueue(), TOKEN_REFRESH_QUEUE_NAME, TokenRefreshAccountJobData, TokenRefreshJobData, tokenRefreshQueue, TokenRefreshScannerJobData (+6 more)

### Community 24 - "platform-connector.ts"
Cohesion: 0.12
Nodes (6): ref_crypto, env, platformConnector, PlatformErrorCode, TikTokTokenApiResponse, TokenRefreshResult

### Community 25 - "post-events.ts"
Cohesion: 0.20
Nodes (14): ref_events, dynamic, GET(), PostStatus, createRedisClient(), getRedisOptions(), redis, getPostEventsChannel() (+6 more)

### Community 26 - "token-health-service.ts"
Cohesion: 0.15
Nodes (13): POST(), GET(), AccountStatus, ConnectedAccount, ConnectedAccountItem, AccountTokenHealth, AlertSeverity, EXPIRATION_WARNING_DAYS (+5 more)

### Community 27 - "rules"
Cohesion: 0.17
Nodes (11): extends, prettier, rules, no-console, no-unused-vars, prefer-const, @typescript-eslint/consistent-type-imports, @typescript-eslint/no-explicit-any (+3 more)

### Community 28 - "apiFetch"
Cohesion: 0.22
Nodes (15): DashboardLayout(), DashboardSidebar(), MobileBottomNav(), MobileHeader(), NAV_ITEMS, NavItem, OfflineBanner(), ThemeToggle() (+7 more)

### Community 29 - "posts/page.tsx"
Cohesion: 0.15
Nodes (15): formatDate(), getPlatformIcon(), getStatusBadge(), ListResponse, PLATFORM_OPTIONS, PlatformFilter, PostItem, PostsListContent() (+7 more)

### Community 32 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 33 - "preview-engine.ts"
Cohesion: 0.29
Nodes (9): escapeHtml(), PLATFORM_LIMITS, previewEngine, PreviewInput, PreviewResult, renderFacebookPreview(), renderInstagramPreview(), renderThreadsPreview() (+1 more)

### Community 35 - "dev-all.sh"
Cohesion: 0.52
Nodes (6): cleanup(), err(), info(), log(), PORT, dev-all.sh script

### Community 37 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): nextConfig, withPWA, @ducanh2912/next-pwa

### Community 38 - "post-manager.ts"
Cohesion: 0.18
Nodes (12): Post, postTargets, BulkCreateResult, PlatformDeleteResult, CreatePostInput, DeletePostOptions, DeletePostResult, IMMUTABLE_STATUSES (+4 more)

### Community 39 - "image-compressor.ts"
Cohesion: 0.30
Nodes (9): calculateProportionalDimensions(), canvasToBlob(), compressImage(), ImageCompressionOptions, ImageDimensions, isCompressibleImage(), loadImageFromFile(), resolveOutputFormat() (+1 more)

### Community 41 - "delete-post-modal.tsx"
Cohesion: 0.10
Nodes (20): ref_fs, ref_os, ref_path, @playwright/test, EditPostPage(), DeletePostApiResponse, DeletePostModal(), DeletePostModalProps (+12 more)

### Community 42 - "platform-constraints.ts"
Cohesion: 0.29
Nodes (8): CharStatus, isVideoUrl(), MediaStatus, MultiPlatformValidationSummary, PLATFORM_SPECS, PlatformSpec, PlatformValidationResult, validatePlatformConstraints()

### Community 43 - "db/index.ts"
Cohesion: 0.39
Nodes (7): drizzle-orm, pg, createPool(), getDb(), getPool(), pool, runMigrations()

### Community 52 - "package.json"
Cohesion: 0.06
Nodes (32): prettier, name, private, version, bcrypt, clsx, esbuild, eslint (+24 more)

## Knowledge Gaps
- **327 isolated node(s):** `ConnectedAccount`, `PostTarget`, `PostData`, `PreviewPanel`, `PostTarget` (+322 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `edit/page.tsx`, `content-calendar-view.tsx`, `queue-monitor-service.ts`, `cn`, `auth-service.ts`, `csv-processor.ts`, `theme-toggle.tsx`, `cookies.ts`, `package.json`, `media-uploader.ts`, `dashboard/page.tsx`, `platform-connector.ts`, `post-events.ts`, `token-health-service.ts`, `apiFetch`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `react` connect `edit/page.tsx` to `content-calendar-view.tsx`, `offline-drafts.ts`, `cn`, `delete-post-modal.tsx`, `theme-toggle.tsx`, `package.json`, `dashboard/page.tsx`, `apiFetch`, `posts/page.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `PlatformType` connect `publish-worker.ts` to `next`, `post-manager.ts`, `delete-post-modal.tsx`, `csv-processor.ts`, `dashboard/page.tsx`, `schema.ts`, `platform-connector.ts`, `post-events.ts`, `token-health-service.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `ConnectedAccount`, `PostTarget`, `PostData` to the rest of the system?**
  _327 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `$` be split into smaller, more focused modules?**
  _Cohesion score 0.056948798328108674 - nodes in this community are weakly interconnected._
- **Should `edit/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12141779788838612 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._