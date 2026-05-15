import net from "node:net";

const maxPortProbeAttempts = 100;

export async function findAvailablePort(host: string, startPort: number): Promise<number> {
  for (let offset = 0; offset < maxPortProbeAttempts; offset += 1) {
    const port = startPort + offset;
    if (port > 65535) {
      break;
    }
    if (await portIsAvailable(host, port)) {
      return port;
    }
  }
  throw new Error(`no available web port found starting at ${startPort}`);
}

function portIsAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if ((error as { code?: string }).code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen({ host, port });
  });
}
