import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";
import app from "./app.tsx";
import { initializeDatabase } from "./db.ts";
import { logger } from "./logging.ts";

async function startServer() {
  try {
    await initializeDatabase();
    logger.info("Database initialized successfully");

    serve(
      {
        port: 8000,
        fetch: behindProxy(app.fetch.bind(app)),
      },
      (info) => logger.info(`Server started at http://localhost:${info.port}`),
    );
  } catch (error) {
    logger.error("Failed to start server:", { error });
    process.exit(1);
  }
}

startServer();
