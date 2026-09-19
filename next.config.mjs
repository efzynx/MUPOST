import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // 1. NetworkOnly untuk mutasi (POST, PUT, PATCH, DELETE) dan /api/connect/*
      {
        urlPattern: ({ url, request }) =>
          url.pathname.startsWith("/api/connect") ||
          ["POST", "PUT", "PATCH", "DELETE"].includes(request.method),
        handler: "NetworkOnly",
      },
      // 2. NetworkFirst untuk GET /api/posts (5 menit fallback)
      {
        urlPattern: ({ url, request }) =>
          url.pathname === "/api/posts" && request.method === "GET",
        handler: "NetworkFirst",
        options: {
          cacheName: "api-posts-cache",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5 menit
          },
        },
      },
      // 3. CacheFirst untuk Media (CDN/S3 URLs) - 7 hari, max 50 entries
      {
        urlPattern: ({ url }) =>
          url.pathname.includes("/mupost-media") ||
          url.hostname.includes("s3") ||
          url.hostname.includes("minio") ||
          /\.(?:mp4|mov|webm)$/i.test(url.pathname),
        handler: "CacheFirst",
        options: {
          cacheName: "media-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 hari
          },
        },
      },
      // 4. CacheFirst untuk Static JS/CSS/icon bundle (30 hari)
      {
        urlPattern: /\.(?:js|css|ico|png|jpg|jpeg|svg|webp|woff2?)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
          },
        },
      },
      // 5. StaleWhileRevalidate untuk HTML shell (24 jam)
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "html-shell",
          expiration: {
            maxAgeSeconds: 24 * 60 * 60, // 24 jam
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "59c9-103-160-68-93.ngrok-free.app",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],
  experimental: {
    serverComponentsExternalPackages: ["bullmq", "ioredis"],
    serverActions: {
      allowedOrigins: [
        "59c9-103-160-68-93.ngrok-free.app",
        "*.ngrok-free.app",
        "*.ngrok.io",
        "*.trycloudflare.com",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:;",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const s3Endpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
    const s3Bucket = process.env.S3_BUCKET || "mupost-media";
    return [
      {
        source: `/${s3Bucket}/:path*`,
        destination: `${s3Endpoint}/${s3Bucket}/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
