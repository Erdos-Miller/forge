import { afterEach, describe, expect, test } from "bun:test";
import net from "node:net";
import { findAvailablePort } from "../src/web-port";

const servers: net.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe("web port selection", () => {
  test("uses the requested port when it is available", async () => {
    const port = await reservePort();
    await closeServer(servers.pop()!);

    await expect(findAvailablePort("127.0.0.1", port)).resolves.toBe(port);
  });

  test("falls forward when the requested port is already busy", async () => {
    const occupiedPort = await reservePort();

    await expect(findAvailablePort("127.0.0.1", occupiedPort)).resolves.toBeGreaterThan(
      occupiedPort,
    );
  });
});

function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      servers.push(server);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("reserved port has no numeric address"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
