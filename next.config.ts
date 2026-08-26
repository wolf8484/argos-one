import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Development-only allowlist so a tablet on the local network can load
  // Next.js scripts and HMR from the workstation's LAN address.
  allowedDevOrigins: ['192.168.1.101'],
};

export default nextConfig;
