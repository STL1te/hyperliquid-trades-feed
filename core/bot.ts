import { Telegraf } from "telegraf";
import { BOT_TOKEN } from "../config/index.js";

// Create the bot instance with polling configuration
const bot = new Telegraf(BOT_TOKEN);

// Configure the bot to use a shorter polling timeout to respond quicker to shutdown signals
bot.telegram.getUpdates(0, 100, 10, []); // (offset, limit, timeout, allowed_updates)

// Remove individual signal handlers
// They're now handled centrally in index.ts

export { bot };
