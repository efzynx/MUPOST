# Graph Report - mupost  (2026-09-29)

## Corpus Check
- 157 files · ~128,615 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1036 nodes · 2500 edges · 78 communities (51 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `441c8718`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- $
- publish-worker.ts
- devDependencies
- dependencies
- edit/page.tsx
- post-delete-qa-validation.test.ts
- content-calendar-view.tsx
- offline-drafts.ts
- SESSION_COOKIE_NAME
- cn
- compilerOptions
- dashboard/page.tsx
- auth-service.ts
- scripts
- schema.ts
- README.md
- theme-toggle.tsx
- cookies.ts
- 0000_vengeful_thunderball.sql
- apiFetch
- post-events.ts
- PostManagerError
- post-manager.ts
- platform-connector.ts
- posts/page.tsx
- image-compressor.ts
- rules
- platform-constraints.ts
- preview/route.ts
- AGENTS.md
- CLAUDE.md
- manifest.json
- preview-engine.ts
- dev-all.sh
- smart-polling.test.ts
- drizzle-kit
- worker/index.ts
- eslint
- postcss.config.mjs
- eslint-config-next
- tailwind.config.ts
- ts-jest
- eslint-config-prettier
- fast-check
- jest
- playwright
- @playwright/test
- postcss
- prettier
- tailwindcss
- testcontainers
- @types/bcrypt
- @types/jest
- @types/papaparse
- @types/pg
- @types/react
- @types/react-dom
- @types/supertest
- typescript

## God Nodes (most connected - your core abstractions)
1. `cn()` - 42 edges
2. `PlatformType` - 37 edges
3. `$` - 35 edges
4. `authService` - 35 edges
5. `SESSION_COOKIE_NAME` - 28 edges
6. `getRedisClient()` - 27 edges
7. `scripts` - 26 edges
8. `EditPostPage()` - 26 edges
9. `Button` - 25 edges
10. `PostsListContent()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `PublishQueueOptions` --references--> `getRedisClient()`  [EXTRACTED]
  src/lib/queue/publish-queue.ts → src/lib/redis.ts
- `TargetStatusSummary` --references--> `PlatformType`  [EXTRACTED]
  src/lib/hooks/use-post-realtime.ts → src/lib/db/schema.ts
- `TargetStatusSummary` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/post-events.ts → src/lib/db/schema.ts
- `UserTokenAlert` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/token-health-service.ts → src/lib/db/schema.ts
- `PostStatusEvent` --references--> `PostStatus`  [EXTRACTED]
  src/lib/services/post-events.ts → src/lib/db/schema.ts

## Import Cycles
- None detected.

## Communities (78 total, 27 thin omitted)

### Community 0 - "$"
Cohesion: 0.06
Nodes (24): $, a, b, D(), deleteCacheAndMetadata(), et, F, g() (+16 more)

### Community 1 - "publish-worker.ts"
Cohesion: 0.07
Nodes (49): ref_fs, ref_os, ref_path, createPool(), db, getDb(), getPool(), pool (+41 more)

### Community 2 - "devDependencies"
Cohesion: 0.29
Nodes (7): esbuild, devDependencies, esbuild, supertest, @types/node, supertest, @types/node

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (47): @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, bcrypt, bullmq, clsx, drizzle-orm, @ducanh2912/next-pwa (+39 more)

### Community 4 - "edit/page.tsx"
Cohesion: 0.11
Nodes (42): ConnectedAccount, EditPostPage(), PostData, PostTarget, PreviewPanel, ConnectedAccount, NewPostPage(), PreviewPanel (+34 more)

### Community 5 - "post-delete-qa-validation.test.ts"
Cohesion: 0.25
Nodes (4): RouteParams, DELETE(), RouteParams, postManager

### Community 6 - "content-calendar-view.tsx"
Cohesion: 0.17
Nodes (31): ContentCalendarView(), ContentCalendarViewProps, DayDetailModal(), DayDetailModalProps, getPlatformIcon(), getStatusBadge(), MonthCalendarGrid(), MonthCalendarGridProps (+23 more)

### Community 7 - "offline-drafts.ts"
Cohesion: 0.20
Nodes (27): useOfflineDraftSync(), cacheConnectedAccounts(), CachedConnectedAccount, CachedPostItem, cachePostsList(), deleteOfflineDraft(), dispatchEvent(), getCachedConnectedAccounts() (+19 more)

### Community 8 - "SESSION_COOKIE_NAME"
Cohesion: 0.17
Nodes (5): POST(), GET(), SESSION_COOKIE_NAME, platformConnector, tokenHealthService

### Community 9 - "cn"
Cohesion: 0.22
Nodes (25): LoginPage(), RegisterPage(), AdminQueuesPage(), QueueMetrics, QueuesSummary, SerializedJob, CsvImportPage(), CsvRowError (+17 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "dashboard/page.tsx"
Cohesion: 0.12
Nodes (24): ConnectedAccount, DashboardData, DashboardPage(), DashboardStats, formatDate(), getPlatformIcon(), getStatusBadge(), PostItem (+16 more)

### Community 12 - "auth-service.ts"
Cohesion: 0.12
Nodes (12): RFC-5322, RouteParams, User, authService, getJwtSecret(), hashToken(), LoginInput, RateLimitResult (+4 more)

### Community 13 - "scripts"
Cohesion: 0.07
Nodes (29): name, private, scripts, all, build, db:generate, db:migrate, dev (+21 more)

### Community 14 - "schema.ts"
Cohesion: 0.05
Nodes (37): accountStatusEnum, connectedAccounts, connectedAccountsRelations, NewConnectedAccount, NewPost, NewPostTarget, NewSession, NewUser (+29 more)

### Community 15 - "README.md"
Cohesion: 0.04
Nodes (47): 1. Buat Database, 1. Clone Repository, 1. Salin File `.env.example`, 2. Edit File `.env`, 2. Instal Dependensi, 2. Jalankan Migrasi, 3. Generate Kunci Enkripsi (jika belum ada), 3. (Opsional) Buat Bucket MinIO (+39 more)

### Community 16 - "theme-toggle.tsx"
Cohesion: 0.13
Nodes (20): src_app_globals, geistMono, geistSans, metadata, RootLayout(), viewport, ThemeProvider(), THEME_ICONS (+12 more)

### Community 17 - "cookies.ts"
Cohesion: 0.20
Nodes (14): POST(), POST(), CookieOptions, CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS, SESSION_COOKIE_OPTIONS, generateCsrfToken(), validateCsrfToken() (+6 more)

### Community 18 - "0000_vengeful_thunderball.sql"
Cohesion: 0.18
Nodes (18): "connected_accounts", idx_connected_accounts_expires, idx_connected_accounts_user_id, idx_post_targets_pending, idx_post_targets_post_id, idx_posts_scheduled, idx_posts_status, idx_posts_user_id (+10 more)

### Community 19 - "apiFetch"
Cohesion: 0.20
Nodes (16): DashboardLayout(), DashboardSidebar(), MobileBottomNav(), MobileHeader(), NAV_ITEMS, NavItem, OfflineBanner(), ThemeToggle() (+8 more)

### Community 20 - "post-events.ts"
Cohesion: 0.09
Nodes (29): ref_events, POST(), dynamic, GET(), env, envSchema, createRedisClient(), getRedisOptions() (+21 more)

### Community 21 - "PostManagerError"
Cohesion: 0.35
Nodes (4): getPublishQueue(), publishPostEvent(), PostManagerError, PostManagerService

### Community 22 - "post-manager.ts"
Cohesion: 0.10
Nodes (21): POST(), GET(), posts, PostStatus, postTargets, createPublishQueue(), PUBLISH_QUEUE_NAME, PublishJobData (+13 more)

### Community 23 - "platform-connector.ts"
Cohesion: 0.05
Nodes (35): ref_crypto, decrypt(), encrypt(), getEncryptionKey(), AccountStatus, ConnectedAccount, createTokenRefreshQueue(), getTokenRefreshQueue() (+27 more)

### Community 25 - "posts/page.tsx"
Cohesion: 0.13
Nodes (26): formatDate(), getPlatformIcon(), getStatusBadge(), ListResponse, PLATFORM_OPTIONS, PlatformFilter, PostItem, PostsListContent() (+18 more)

### Community 26 - "image-compressor.ts"
Cohesion: 0.31
Nodes (8): calculateProportionalDimensions(), canvasToBlob(), compressImage(), ImageCompressionOptions, ImageDimensions, loadImageFromFile(), resolveOutputFormat(), MockImage

### Community 27 - "rules"
Cohesion: 0.17
Nodes (11): extends, prettier, rules, no-console, no-unused-vars, prefer-const, @typescript-eslint/consistent-type-imports, @typescript-eslint/no-explicit-any (+3 more)

### Community 28 - "platform-constraints.ts"
Cohesion: 0.29
Nodes (8): CharStatus, isVideoUrl(), MediaStatus, MultiPlatformValidationSummary, PLATFORM_SPECS, PlatformSpec, PlatformValidationResult, validatePlatformConstraints()

### Community 29 - "preview/route.ts"
Cohesion: 0.40
Nodes (3): RouteParams, previewEngine, PreviewResult

### Community 32 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 33 - "preview-engine.ts"
Cohesion: 0.39
Nodes (7): escapeHtml(), PLATFORM_LIMITS, PreviewInput, renderFacebookPreview(), renderInstagramPreview(), renderThreadsPreview(), renderTikTokPreview()

### Community 35 - "dev-all.sh"
Cohesion: 0.52
Nodes (6): cleanup(), err(), info(), log(), PORT, dev-all.sh script

## Knowledge Gaps
- **297 isolated node(s):** `graphify`, `graphify`, `Daftar Isi`, `Fitur Utama`, `Arsitektur Teknis` (+292 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PlatformType` connect `publish-worker.ts` to `posts/route.ts`, `dashboard/page.tsx`, `schema.ts`, `post-events.ts`, `post-manager.ts`, `platform-connector.ts`, `posts/page.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `edit/page.tsx`, `content-calendar-view.tsx`, `dashboard/page.tsx`, `theme-toggle.tsx`, `apiFetch`, `posts/page.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `getRedisClient()` connect `platform-connector.ts` to `publish-worker.ts`, `auth-service.ts`, `post-events.ts`, `PostManagerError`, `post-manager.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `graphify`, `graphify`, `Daftar Isi` to the rest of the system?**
  _297 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `$` be split into smaller, more focused modules?**
  _Cohesion score 0.056948798328108674 - nodes in this community are weakly interconnected._
- **Should `publish-worker.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07228070175438596 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._