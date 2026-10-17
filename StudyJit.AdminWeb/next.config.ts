import type { NextConfig } from "next";

// A plain static site (the `out` folder), served by nginx - see Dockerfile. It's one page; the screens are picked by
// the part after # (see src/components/AdminApp.tsx).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
