import fs from "fs";
import path from "path";

export function listApiRoutes() {
  // Check both source and compiled locations
  const candidateDirs = [
    path.join(process.cwd(), "api"),
    path.join(process.cwd(), "app/api"),
    path.join(process.cwd(), "src/app/api"),
    path.join(process.cwd(), ".next/server/app/api"), // ✅ production build
  ];

  const baseDir = candidateDirs.find((dir) => fs.existsSync(dir));

  console.log("🔍 CWD:", process.cwd());
  console.log("🔍 Candidate dirs:", candidateDirs);
  console.log("📂 Selected:", baseDir);

  if (!baseDir) {
    console.warn("⚠️  No API directory found");
    return [];
  }

  const routes: { route: string; file: string }[] = [];

  function walk(dir: string, prefix = "") {
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, path.join(prefix, file));
      } else if (
        file === "route.ts" ||
        file === "route.js" ||
        file === "route.mjs"
      ) {
        const routePath = "/api" + prefix.replace(/\\/g, "/");
        routes.push({
          route: routePath,
          file: fullPath.replace(process.cwd(), "").replace(/\\/g, "/"),
        });
      }
    }
  }

  walk(baseDir);
  console.log("✅ Found routes:", routes.length);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}
