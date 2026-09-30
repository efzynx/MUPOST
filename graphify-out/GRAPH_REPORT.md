# Graph Report - mupost  (2026-09-30)

## Corpus Check
- 158 files · ~132,388 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 6, .ico 2, .woff 2)

## Summary
- 1043 nodes · 2669 edges · 48 communities (33 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3144a670`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- $
- platform-rate-limiter.ts
- devDependencies
- dependencies
- PlatformConnectorService
- next
- content-calendar-view.tsx
- edit/page.tsx
- getRedisClient
- posts/page.tsx
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
- PlatformType
- schema.ts
- token-refresh-worker.ts
- post-events.ts
- platform-connector.ts
- rules
- AGENTS.md
- CLAUDE.md
- manifest.json
- preview-engine.ts
- dev-all.sh
- smart-polling.test.ts
- next.config.mjs
- worker/index.ts
- post-delete-qa-validation.test.ts
- postcss.config.mjs
- tailwindcss
- package.json

## God Nodes (most connected - your core abstractions)
1. `next` - 48 edges
2. `cn()` - 42 edges
3. `PlatformType` - 38 edges
4. `$` - 35 edges
5. `authService` - 35 edges
6. `react` - 34 edges
7. `SESSION_COOKIE_NAME` - 28 edges
8. `EditPostPage()` - 27 edges
9. `getRedisClient()` - 27 edges
10. `scripts` - 26 edges

## Surprising Connections (you probably didn't know these)
- `TargetStatusSummary` --references--> `PlatformType`  [EXTRACTED]
  src/lib/hooks/use-post-realtime.ts → src/lib/db/schema.ts
- `TargetStatusSummary` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/post-events.ts → src/lib/db/schema.ts
- `UserTokenAlert` --references--> `PlatformType`  [EXTRACTED]
  src/lib/services/token-health-service.ts → src/lib/db/schema.ts
- `EditPostPage()` --calls--> `DeletePostModal()`  [EXTRACTED]
  src/app/(dashboard)/posts/[id]/edit/page.tsx → src/components/posts/delete-post-modal.tsx
- `EditPostPage()` --calls--> `getStatusBadge()`  [EXTRACTED]
  src/app/(dashboard)/posts/[id]/edit/page.tsx → src/components/posts/delete-post-modal.tsx

## Import Cycles
- None detected.

## Communities (48 total, 15 thin omitted)

### Community 0 - "$"
Cohesion: 0.06
Nodes (24): $, a, b, D(), deleteCacheAndMetadata(), et, F, g() (+16 more)

### Community 1 - "platform-rate-limiter.ts"
Cohesion: 0.20
Nodes (16): ioredis, calculateRateLimitBackoff(), DEFAULT_BACKOFF_CONFIG, DEFAULT_PLATFORM_RATE_LIMITS, extractRateLimitInfo(), PlatformRateLimitConfig, PlatformRateLimitError, RateLimitInfo (+8 more)

### Community 2 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, drizzle-kit, esbuild, eslint, eslint-config-next, eslint-config-prettier, fast-check, jest (+17 more)

### Community 3 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, bcrypt, bullmq, clsx, drizzle-orm (+15 more)

### Community 4 - "PlatformConnectorService"
Cohesion: 0.23
Nodes (5): decrypt(), encrypt(), getEncryptionKey(), PlatformConnectorService, PlatformError

### Community 5 - "next"
Cohesion: 0.16
Nodes (4): bullmq, next, POST(), GET()

### Community 6 - "content-calendar-view.tsx"
Cohesion: 0.17
Nodes (31): ContentCalendarView(), ContentCalendarViewProps, DayDetailModal(), DayDetailModalProps, getPlatformIcon(), getStatusBadge(), MonthCalendarGrid(), MonthCalendarGridProps (+23 more)

### Community 7 - "edit/page.tsx"
Cohesion: 0.08
Nodes (64): ConnectedAccount, EditPostPage(), PostData, PostTarget, PreviewPanel, ConnectedAccount, NewPostPage(), PreviewPanel (+56 more)

### Community 8 - "getRedisClient"
Cohesion: 0.22
Nodes (7): createPublishQueue(), PUBLISH_QUEUE_NAME, PublishJobData, publishQueue, PublishQueueOptions, getRedisClient(), PublishWorkerConfig

### Community 9 - "posts/page.tsx"
Cohesion: 0.05
Nodes (105): lucide-react, react, LoginPage(), RegisterPage(), AdminQueuesPage(), QueueMetrics, QueuesSummary, SerializedJob (+97 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "PostManagerError"
Cohesion: 0.35
Nodes (4): getPublishQueue(), publishPostEvent(), PostManagerError, PostManagerService

### Community 12 - "auth-service.ts"
Cohesion: 0.07
Nodes (20): RFC-5322, RouteParams, RouteParams, RouteParams, DELETE(), RouteParams, SESSION_COOKIE_NAME, sessions (+12 more)

### Community 13 - "scripts"
Cohesion: 0.08
Nodes (26): scripts, all, build, db:generate, db:migrate, dev, dev:all, docker:build (+18 more)

### Community 14 - "csv-processor.ts"
Cohesion: 0.09
Nodes (17): papaparse, ALLOWED_PLATFORMS, BulkCreateResult, CSV_PLATFORM_MAP, CsvParseResult, CsvPlatform, csvProcessor, CsvProcessorError (+9 more)

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
Cohesion: 0.18
Nodes (22): DEFAULT_TIMEOUT_MS, deleteFromInstagram(), deleteFromMeta(), deleteFromPlatform(), deleteFromThreads(), deleteFromTikTok(), facebookAdapter, fetchWithTimeout() (+14 more)

### Community 20 - "media-uploader.ts"
Cohesion: 0.15
Nodes (19): @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, ref_crypto, POST(), detectMimeFromBytes(), extFromMime(), FileInput (+11 more)

### Community 21 - "PlatformType"
Cohesion: 0.33
Nodes (5): PostToDelete, PlatformType, platformRateLimiter, DeleteTargetInfo, PlatformPublishResult

### Community 22 - "schema.ts"
Cohesion: 0.07
Nodes (33): accountStatusEnum, connectedAccounts, connectedAccountsRelations, NewConnectedAccount, NewPost, NewPostTarget, NewSession, NewUser (+25 more)

### Community 23 - "token-refresh-worker.ts"
Cohesion: 0.14
Nodes (14): createTokenRefreshQueue(), getTokenRefreshQueue(), TOKEN_REFRESH_QUEUE_NAME, TokenRefreshAccountJobData, TokenRefreshJobData, tokenRefreshQueue, TokenRefreshScannerJobData, queueMonitorService (+6 more)

### Community 25 - "post-events.ts"
Cohesion: 0.24
Nodes (12): ref_events, dynamic, GET(), createRedisClient(), getRedisOptions(), redis, getPostEventsChannel(), localPostEvents (+4 more)

### Community 26 - "platform-connector.ts"
Cohesion: 0.08
Nodes (27): drizzle-orm, zod, POST(), GET(), createPool(), db, getDb(), getPool() (+19 more)

### Community 27 - "rules"
Cohesion: 0.17
Nodes (11): extends, prettier, rules, no-console, no-unused-vars, prefer-const, @typescript-eslint/consistent-type-imports, @typescript-eslint/no-explicit-any (+3 more)

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

### Community 41 - "post-delete-qa-validation.test.ts"
Cohesion: 0.12
Nodes (12): ref_fs, ref_os, ref_path, @playwright/test, DeletePostModal(), formatDeleteFeedbackMessage(), formatPlatformDisplayName(), getPlatformDeletePolicyNote() (+4 more)

### Community 52 - "package.json"
Cohesion: 0.06
Nodes (34): prettier, name, private, version, bcrypt, clsx, drizzle-kit, esbuild (+26 more)

## Knowledge Gaps
- **324 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `prettier`, `no-console`, `prefer-const` (+319 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 416 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `content-calendar-view.tsx`, `edit/page.tsx`, `posts/page.tsx`, `post-delete-qa-validation.test.ts`, `auth-service.ts`, `csv-processor.ts`, `theme-toggle.tsx`, `cookies.ts`, `package.json`, `media-uploader.ts`, `schema.ts`, `post-events.ts`, `platform-connector.ts`?**
  _High betweenness centrality (0.195) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `react` connect `posts/page.tsx` to `theme-toggle.tsx`, `package.json`, `content-calendar-view.tsx`, `edit/page.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `next/typescript`, `prettier` to the rest of the system?**
  _324 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `$` be split into smaller, more focused modules?**
  _Cohesion score 0.05590386624869383 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._