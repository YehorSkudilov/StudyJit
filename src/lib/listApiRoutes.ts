import fs from "fs";
import path from "path";

export function listApiRoutes() {
  const candidateDirs = [
    path.join(process.cwd(), "api"),
    path.join(process.cwd(), "app/api"),
    path.join(process.cwd(), "src/app/api"),
    path.join(process.cwd(), ".next/server/app/api"),
  ];

  const baseDir = candidateDirs.find((dir) => fs.existsSync(dir));
  if (!baseDir) return [];

  const routes: { route: string; file: string; methods: string[] }[] = [];

  function walk(dir: string, prefix = "") {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full, path.join(prefix, file));
      else if (file.match(/^route\.(t|j|m)js$/)) {
        const text = fs.readFileSync(full, "utf8");
        const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
          text.match(new RegExp(`export\\s+(const|async\\s+function)\\s+${m}`, "i"))
        );
        routes.push({
          route: "/api" + prefix.replace(/\\/g, "/"),
          file: full.replace(process.cwd(), "").replace(/\\/g, "/"),
          methods,
        });
      }
    }
  }

  walk(baseDir);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}
