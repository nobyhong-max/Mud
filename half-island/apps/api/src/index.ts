import Fastify from "fastify";
import cors from "@fastify/cors";
import { getDb } from "./db/client.js";
import { healthRoutes } from "./routes/health.js";
import { pairRoutes } from "./routes/pairs.js";
import { todayRoutes } from "./routes/today.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

async function main(): Promise<void> {
  // ensure DB file + schema
  getDb();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: corsOrigin.split(",").map((s) => s.trim()) });

  await app.register(healthRoutes);
  await app.register(pairRoutes);
  await app.register(todayRoutes);

  app.get("/", async () => ({
    brand: "半个岛",
    slogan: "你来了，岛才完整。",
    docs: "见 half-island/README.md",
    health: "/health",
  }));

  await app.listen({ port, host });
  console.log(`半个岛 API → http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
