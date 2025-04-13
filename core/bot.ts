import { Telegraf } from "telegraf";
import { BOT_TOKEN } from "../config/index.js";

const bot = new Telegraf(BOT_TOKEN);

process.once("SIGINT", () => {
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
});

export { bot };
