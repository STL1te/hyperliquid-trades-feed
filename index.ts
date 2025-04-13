import { healthcheck } from "./utils/index";
import { websocket } from "./core/websocket";
import { bot } from "./core/bot";

// Create HTTP server for health check
const server = healthcheck();

// Handle all-things websocket
const ws = websocket();

// Launch bot
bot.launch();

console.log("Hyperliquid liquidations bot started successfully!");

// Centralized shutdown handler
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  // Give ongoing operations time to complete
  setTimeout(() => {
    console.error("Forceful shutdown after timeout");
    process.exit(1);
  }, 10000); // Force exit after 10 seconds

  try {
    // Stop the bot
    bot.stop(signal);
    console.log("Telegram bot stopped");

    // Close websocket
    if (ws) ws.close();
    console.log("WebSocket connection closed");

    // Close health check server
    if (server) server.close();
    console.log("Health check server closed");

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle termination signals
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
