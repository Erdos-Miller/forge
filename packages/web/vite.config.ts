import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getTaskGraphPayload } from "./src/api";

export default defineConfig({
  plugins: [
    {
      name: "forge-api",
      configureServer(server) {
        server.middlewares.use("/api/tasks", async (_request, response) => {
          try {
            const payload = await getTaskGraphPayload(
              process.env.FORGE_START_DIR ?? process.cwd(),
            );
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify(payload));
          } catch (error) {
            response.writeHead(500, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        });
      },
    },
    react(),
  ],
});
