import fs from "fs";
import path from "path";

/**
 * Recursively scans all API routes in the project under "@/app/api"
 */
export function listApiRoutes() {
  // Resolve "@/app/api" → absolute filesystem path
  const baseDir = path.join(process.cwd(), "app/api");

  const routes: { route: string; file: string }[] = [];

  function walk(dir: string, prefix = "") {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, path.join(prefix, file));
      } else if (file === "route.ts" || file === "route.js") {
        const routePath = "/api" + prefix.replace(/\\/g, "/");
        routes.push({
          route: routePath,
          file: `@/app/api${prefix ? "/" + prefix : ""}/route.ts`,
        });
      }
    }
  }

  walk(baseDir);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}
