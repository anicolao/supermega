import { defineConfig, type Plugin } from "vite";
import { normalizeBase } from "./src/base.ts";

// Public subdirectories are static artifacts, so resolve their index explicitly
// before Vite's SPA fallback in both local dev and production preview.
const reviewRoute = (): Plugin => ({
  name: "review-index",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url && /\/review\/?$/.test(request.url))
        request.url = request.url.replace(/\/review\/?$/, "/review/index.html");
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url && /\/review\/?$/.test(request.url))
        request.url = request.url.replace(/\/review\/?$/, "/review/index.html");
      next();
    });
  },
});

export default defineConfig({
  base: normalizeBase(process.env.PUBLIC_BASE_PATH || "/"),
  plugins: [reviewRoute()],
});
