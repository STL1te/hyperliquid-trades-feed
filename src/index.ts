import { healthcheck } from "./utils/healtcheck";
import { websocket } from "./core/websocket";
import { bot } from "./core/bot";

// Short delay before starting to allow any previous instance to shut down
console.log(
  "Starting application with a short delay to allow previous instances to shut down..."
);

// Delay startup to give any previous instance time to shut down
setTimeout(() => {
  // Create HTTP server for health check
  const server = healthcheck();

  // Handle all-things websocket
  const ws = websocket();

  // Launch bot
  bot
    .launch()
    .then(() => {
      console.log("Hyperliquid liquidations bot started successfully!");
    })
    .catch((err: any) => {
      console.error("Failed to start Telegram bot:", err);
      process.exit(1);
    });

  // Centralized shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);

    // Give ongoing operations time to complete
    setTimeout(() => {
      console.error("Forceful shutdown after timeout");
      process.exit(1);
    }, 10000); // Force exit after 10 seconds

    try {
      // Tell the health check to start failing to prevent Railway from routing new requests
      if (server) {
        server.close();
        console.log("Health check server closed");
      }

      // Stop the bot - this is critical to release the Telegram webhook
      bot.stop(signal);
      console.log("Telegram bot stopped");

      // Close websocket
      if (ws) ws.close();
      console.log("WebSocket connection closed");

      // Give Telegram a moment to fully close the connection
      await new Promise((resolve) => setTimeout(resolve, 1000));

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
}, 5000); // 5 second delay
