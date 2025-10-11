import { serve } from "@hono/node-server";
import { behindProxy } from "x-forwarded-fetch";
import app from "./app.tsx";
import { initializeDatabase } from "./db.ts";
import "./logging.ts";

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 初始化数据库表结构
    await initializeDatabase();
    console.log("Database initialized successfully");

    // 启动服务器
    serve(
      {
        port: 8000,
        fetch: behindProxy(app.fetch.bind(app)),
      },
      (info) =>
        console.log(`Server started at http://localhost:${info.port}`),
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
