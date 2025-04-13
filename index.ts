import { healthcheck } from "./utils/index.js";
import { websocket } from "./core/websocket.js";
import { bot } from "./core/bot.js";

// Handle all-things websocket
websocket();

// Create a simple HTTP server for health check
healthcheck();

// Launch bot
bot.launch();

console.log("Hyperliquid liquidations bot started successfully!");
