import { listApiRoutes } from "./listApiRoutes";

export function generateOpenApi() {
  const routes = listApiRoutes();
  const paths: Record<string, any> = {};
  for (const r of routes)
    paths[r.route] = Object.fromEntries(
      (r.methods.length ? r.methods : ["get"]).map((m) => [
        m.toLowerCase(),
        { responses: { 200: { description: "OK" } } },
      ])
    );
  return {
    openapi: "3.0.0",
    info: { title: "API Docs", version: "1.0.0" },
    paths,
  };
}
