import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@half-island/shared";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "half-island-api",
    brand: "半个岛",
    slogan: "你来了，岛才完整。",
    phase: "0",
    time: new Date().toISOString(),
  }));
}
