import type { HealthResponse } from "@half-island/shared";
import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "half-island-api",
    brand: "半个岛",
    slogan: "你来了，岛才完整。",
    sloganEn: "You arrive — the island becomes whole.",
    phase: "2",
    time: new Date().toISOString(),
  }));
}
