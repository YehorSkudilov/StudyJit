import fs from "fs";
import path from "path";

export function listApiRoutes(baseDir = path.join(process.cwd(), "app/api")) {
  const routes: { route: string; file: string }[] = [];

  function walk(dir: string, prefix = "") {
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
          file: fullPath.replace(process.cwd(), ""),
        });
      }
    }
  }

  if (fs.existsSync(baseDir)) walk(baseDir);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}
