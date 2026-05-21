import react from "@vitejs/plugin-react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { defineConfig, normalizePath } from "vite";
import { findForgeRoot } from "../core/src/index.ts";
import { getWorkspaceTaskGraphPayload } from "./src/api";

export default defineConfig({
  plugins: [
    {
      name: "forge-api",
      configureServer(server) {
        const startDir = process.env.FORGE_START_DIR ?? process.cwd();
        const repoRootPromise = findForgeRoot(startDir);

        repoRootPromise
          .then(async (repoRoot) => {
            const tasksDir = path.join(repoRoot, ".forge", "tasks");
            const realTasksDir = await fs.realpath(tasksDir).catch(() => tasksDir);
            server.watcher.add(normalizePath(realTasksDir));

            let refreshTimer: ReturnType<typeof setTimeout> | undefined;
            const broadcastTaskChange = (filePath: string) => {
              if (
                !isTaskMarkdownFile(tasksDir, filePath) &&
                !isTaskMarkdownFile(realTasksDir, filePath)
              ) {
                return;
              }

              if (refreshTimer) {
                clearTimeout(refreshTimer);
              }
              refreshTimer = setTimeout(() => {
                server.ws.send({
                  type: "custom",
                  event: "forge:tasks-changed",
                  data: { repoRoot },
                });
              }, 75);
            };

            server.watcher.on("add", broadcastTaskChange);
            server.watcher.on("change", broadcastTaskChange);
            server.watcher.on("unlink", broadcastTaskChange);
          })
          .catch((error) => {
            server.config.logger.warn(
              `Forge task watcher disabled: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });

        server.middlewares.use("/api/tasks", async (_request, response) => {
          try {
            const payload = await getWorkspaceTaskGraphPayload(startDir);
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

function isTaskMarkdownFile(tasksDir: string, filePath: string) {
  const relativePath = path.relative(tasksDir, path.normalize(filePath));
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath) &&
    filePath.endsWith(".md")
  );
}
