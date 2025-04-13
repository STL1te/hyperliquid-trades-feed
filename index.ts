import { healthcheck } from "./utils/index";
import { websocket } from "./core/websocket";
import { bot } from "./core/bot";

// Handle all-things websocket
websocket();

// Create a simple HTTP server for health check
healthcheck();

// Launch bot
bot.launch();

console.log("Hyperliquid liquidations bot started successfully!");
