import { Telegraf } from "telegraf";
import { BOT_TOKEN } from "../config/index.js";

// Create a unique session ID for each instance of the bot
// This helps Telegram distinguish between different instances
const sessionId = `hl_liquidations_bot_${Date.now()}`;
const bot = new Telegraf(BOT_TOKEN, {
  telegram: {
    // Set a unique session name using timestamp
    apiRoot: "https://api.telegram.org",
  },
});

// Remove individual signal handlers
// They're now handled centrally in index.ts

export { bot };
