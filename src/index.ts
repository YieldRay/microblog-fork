import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";
import app from "./app.tsx";
import { initializeDatabase } from "./db.ts";
import { logger } from "./logging.ts";

const fetch = behindProxy(app.fetch.bind(app));

export default fetch;

async function startServer() {
  try {
    await initializeDatabase();
    logger.info("Database initialized successfully");

    serve(
      {
        port: 3000,
        fetch,
      },
      (info) => logger.info(`Server started at http://localhost:${info.port}`),
    );
  } catch (error) {
    logger.error("Failed to start server: {error}", { error });
    process.exit(1);
  }
}

if (import.meta.main) {
  startServer();
}
