import type { NextConfig } from "next";

// The UI only: every bit of data comes from StudyJit.Api (see src/lib/api.ts). "standalone" bundles the server with
// just the files it needs, for the Docker image (see Dockerfile).
const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Study sets and files live in courses now; the old sections' addresses go to the course list.
  async redirects() {
    return [
      { source: "/learningSpace", destination: "/courses", permanent: true },
      { source: "/files", destination: "/courses", permanent: true },
    ];
  },
};

export default nextConfig;
