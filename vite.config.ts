import { defineConfig, type Plugin } from "vite";

// Public subdirectories are static artifacts, so resolve their index explicitly
// before Vite's SPA fallback in both local dev and production preview.
const reviewRoute = (): Plugin => ({
  name: "review-index",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === "/review" || request.url === "/review/")
        request.url = "/review/index.html";
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === "/review" || request.url === "/review/")
        request.url = "/review/index.html";
      next();
    });
  },
});

export default defineConfig({ plugins: [reviewRoute()] });
