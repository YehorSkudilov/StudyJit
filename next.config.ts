import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  api: {
    bodyParser: false, // Required for FormData uploads
  },
};

export default nextConfig;
