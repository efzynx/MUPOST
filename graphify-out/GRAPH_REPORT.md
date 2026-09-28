# Graph Report - mupost  (2026-09-29)

## Corpus Check
- 157 files · ~128,568 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 6, .ico 2, .woff 2)

## Summary
- 1040 nodes · 2648 edges · 51 communities (36 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `74ab6933`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- $
- publish-worker.ts
- devDependencies
- dependencies
- new/page.tsx
- post-manager.ts
- content-calendar-view.tsx
- edit/page.tsx
- platform-connector.ts
- cn
- compilerOptions
- posts/page.tsx
- auth-service.ts
- scripts
- csv-processor.ts
- README.md
- app/layout.tsx
- cookies.ts
- 0000_vengeful_thunderball.sql
- apiFetch
- media-uploader.ts
- PlatformType
- schema.ts
- token-refresh-worker.ts
- next
- delete-post-modal.tsx
- SESSION_COOKIE_NAME
- rules
- platform-constraints.ts
- db/index.ts
- AGENTS.md
- CLAUDE.md
- manifest.json
- preview-engine.ts
- dev-all.sh
- smart-polling.test.ts
- next.config.mjs
- worker/index.ts
- @playwright/test
- postcss.config.mjs
- tailwindcss
- package.json

## God Nodes (most connected - your core abstractions)
1. `next` - 48 edges
2. `cn()` - 42 edges
3. `PlatformType` - 37 edges
4. `$` - 35 edges
5. `authService` - 35 edges
6. `react` - 34 edges
7. `SESSION_COOKIE_NAME` - 28 edges
8. `getRedisClient()` - 27 edges
9. `scripts` - 26 edges
10. `EditPostPage()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `UserTokenAlert` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/token-health-service.ts → src/lib/db/schema.ts
- `LoginPage()` --calls--> `ThemeToggle()`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → src/components/theme-toggle.tsx
- `RegisterPage()` --calls--> `ThemeToggle()`  [EXTRACTED]
  src/app/(auth)/register/page.tsx → src/components/theme-toggle.tsx
- `AdminQueuesPage()` --calls--> `Badge()`  [EXTRACTED]
  src/app/(dashboard)/admin/queues/page.tsx → src/components/ui/badge.tsx
- `DashboardPage()` --calls--> `Button`  [EXTRACTED]
  src/app/(dashboard)/dashboard/page.tsx → src/components/ui/button.tsx

## Import Cycles
- None detected.

## Communities (51 total, 15 thin omitted)

### Community 0 - "$"
Cohesion: 0.06
Nodes (24): $, a, b, D(), deleteCacheAndMetadata(), et, F, g() (+16 more)

### Community 1 - "publish-worker.ts"
Cohesion: 0.05
Nodes (63): ref_events, ioredis, dynamic, GET(), decrypt(), encrypt(), getEncryptionKey(), calculateRateLimitBackoff() (+55 more)

### Community 2 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, drizzle-kit, esbuild, eslint, eslint-config-next, eslint-config-prettier, fast-check, jest (+17 more)

### Community 3 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, bcrypt, bullmq, clsx, drizzle-orm (+15 more)

### Community 4 - "new/page.tsx"
Cohesion: 0.13
Nodes (37): lucide-react, react, getPlatformIcon(), PreviewPanel, ConnectedAccount, NewPostPage(), PreviewPanel, getPlatformIcon() (+29 more)

### Community 5 - "post-manager.ts"
Cohesion: 0.10
Nodes (15): RouteParams, RouteParams, RouteParams, DELETE(), RouteParams, db, PlatformDeleteResult, CreatePostInput (+7 more)

### Community 6 - "content-calendar-view.tsx"
Cohesion: 0.17
Nodes (31): ContentCalendarView(), ContentCalendarViewProps, DayDetailModal(), DayDetailModalProps, getPlatformIcon(), getStatusBadge(), MonthCalendarGrid(), MonthCalendarGridProps (+23 more)

### Community 7 - "edit/page.tsx"
Cohesion: 0.12
Nodes (41): ConnectedAccount, EditPostPage(), PostData, PostTarget, useOnlineStatus(), useOfflineDraftSync(), calculateProportionalDimensions(), canvasToBlob() (+33 more)

### Community 8 - "platform-connector.ts"
Cohesion: 0.13
Nodes (5): ref_crypto, platformConnector, PlatformErrorCode, TikTokTokenApiResponse, TokenRefreshResult

### Community 9 - "cn"
Cohesion: 0.18
Nodes (29): LoginPage(), RegisterPage(), AdminQueuesPage(), QueueMetrics, QueuesSummary, SerializedJob, CsvImportPage(), CsvRowError (+21 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "posts/page.tsx"
Cohesion: 0.11
Nodes (29): ConnectedAccount, DashboardData, DashboardPage(), DashboardStats, formatDate(), getStatusBadge(), PostItem, PostTarget (+21 more)

### Community 12 - "auth-service.ts"
Cohesion: 0.12
Nodes (12): RFC-5322, User, users, authService, getJwtSecret(), hashToken(), LoginInput, RateLimitResult (+4 more)

### Community 13 - "scripts"
Cohesion: 0.08
Nodes (26): scripts, all, build, db:generate, db:migrate, dev, dev:all, docker:build (+18 more)

### Community 14 - "csv-processor.ts"
Cohesion: 0.09
Nodes (18): papaparse, Post, ALLOWED_PLATFORMS, BulkCreateResult, CSV_PLATFORM_MAP, CsvParseResult, CsvPlatform, csvProcessor (+10 more)

### Community 15 - "README.md"
Cohesion: 0.04
Nodes (47): 1. Buat Database, 1. Clone Repository, 1. Salin File `.env.example`, 2. Edit File `.env`, 2. Instal Dependensi, 2. Jalankan Migrasi, 3. Generate Kunci Enkripsi (jika belum ada), 3. (Opsional) Buat Bucket MinIO (+39 more)

### Community 16 - "app/layout.tsx"
Cohesion: 0.14
Nodes (18): next-themes, src_app_globals, geistMono, geistSans, metadata, RootLayout(), viewport, ThemeProvider() (+10 more)

### Community 17 - "cookies.ts"
Cohesion: 0.19
Nodes (15): POST(), POST(), CookieOptions, CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS, CSRF_HEADER_NAME, SESSION_COOKIE_OPTIONS, generateCsrfToken() (+7 more)

### Community 18 - "0000_vengeful_thunderball.sql"
Cohesion: 0.18
Nodes (18): "connected_accounts", idx_connected_accounts_expires, idx_connected_accounts_user_id, idx_post_targets_pending, idx_post_targets_post_id, idx_posts_scheduled, idx_posts_status, idx_posts_user_id (+10 more)

### Community 19 - "apiFetch"
Cohesion: 0.25
Nodes (12): DashboardLayout(), DashboardSidebar(), MobileBottomNav(), MobileHeader(), NAV_ITEMS, NavItem, OfflineBanner(), THEME_ICONS (+4 more)

### Community 20 - "media-uploader.ts"
Cohesion: 0.16
Nodes (18): @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, POST(), detectMimeFromBytes(), extFromMime(), FileInput, generatePresignedUrl() (+10 more)

### Community 21 - "PlatformType"
Cohesion: 0.16
Nodes (14): LiveSyncIndicatorProps, TransitionToastProps, PlatformType, PostStatus, ConnectionMode, PostRealtimeOptions, PostStatusEvent, StatusTransition (+6 more)

### Community 22 - "schema.ts"
Cohesion: 0.08
Nodes (25): accountStatusEnum, connectedAccounts, connectedAccountsRelations, NewConnectedAccount, NewPost, NewPostTarget, NewSession, NewUser (+17 more)

### Community 23 - "token-refresh-worker.ts"
Cohesion: 0.15
Nodes (15): bullmq, createTokenRefreshQueue(), getTokenRefreshQueue(), TOKEN_REFRESH_QUEUE_NAME, TokenRefreshAccountJobData, TokenRefreshJobData, tokenRefreshQueue, TokenRefreshScannerJobData (+7 more)

### Community 24 - "next"
Cohesion: 0.17
Nodes (3): next, POST(), GET()

### Community 25 - "delete-post-modal.tsx"
Cohesion: 0.19
Nodes (16): DeletePostApiResponse, DeletePostModal(), DeletePostModalProps, getStatusBadge(), PostToDelete, getClientCookie(), invalidatePostsCache(), POSTS_CACHE_NAME (+8 more)

### Community 26 - "SESSION_COOKIE_NAME"
Cohesion: 0.14
Nodes (14): POST(), GET(), SESSION_COOKIE_NAME, AccountStatus, ConnectedAccount, ConnectedAccountItem, AccountTokenHealth, AlertSeverity (+6 more)

### Community 27 - "rules"
Cohesion: 0.17
Nodes (11): extends, prettier, rules, no-console, no-unused-vars, prefer-const, @typescript-eslint/consistent-type-imports, @typescript-eslint/no-explicit-any (+3 more)

### Community 28 - "platform-constraints.ts"
Cohesion: 0.29
Nodes (8): CharStatus, isVideoUrl(), MediaStatus, MultiPlatformValidationSummary, PLATFORM_SPECS, PlatformSpec, PlatformValidationResult, validatePlatformConstraints()

### Community 29 - "db/index.ts"
Cohesion: 0.20
Nodes (10): drizzle-orm, pg, zod, createPool(), getDb(), getPool(), pool, runMigrations() (+2 more)

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
Cohesion: 0.40
Nodes (3): nextConfig, withPWA, @ducanh2912/next-pwa

### Community 41 - "@playwright/test"
Cohesion: 0.12
Nodes (4): ref_fs, ref_os, ref_path, @playwright/test

### Community 52 - "package.json"
Cohesion: 0.06
Nodes (33): prettier, name, private, version, bcrypt, clsx, drizzle-kit, esbuild (+25 more)

## Knowledge Gaps
- **324 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `prettier`, `no-console`, `prefer-const` (+319 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 417 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `publish-worker.ts`, `new/page.tsx`, `post-manager.ts`, `content-calendar-view.tsx`, `edit/page.tsx`, `platform-connector.ts`, `cn`, `posts/page.tsx`, `auth-service.ts`, `csv-processor.ts`, `app/layout.tsx`, `cookies.ts`, `apiFetch`, `package.json`, `media-uploader.ts`, `schema.ts`, `SESSION_COOKIE_NAME`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `react` connect `new/page.tsx` to `content-calendar-view.tsx`, `edit/page.tsx`, `cn`, `posts/page.tsx`, `app/layout.tsx`, `apiFetch`, `package.json`, `PlatformType`, `delete-post-modal.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `prettier` to the rest of the system?**
  _324 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `$` be split into smaller, more focused modules?**
  _Cohesion score 0.05590386624869383 - nodes in this community are weakly interconnected._
- **Should `publish-worker.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050494159928122194 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._