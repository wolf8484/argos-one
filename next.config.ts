import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development-only allowlist so a tablet on the local network can load
  // Next.js scripts and HMR from the workstation's LAN address.
  allowedDevOrigins: ['192.168.1.101'],
  // Bakes the deployed commit into the client bundle so an already-open PWA
  // can tell it's running a stale build by comparing this against /api/version
  // (which reads the same env var live, per current deployment). Falls back
  // to a fixed string outside Vercel so local dev never falsely reports an
  // update.
  env: {
    NEXT_PUBLIC_BUILD_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || 'dev-local',
  },
};

export default nextConfig;
