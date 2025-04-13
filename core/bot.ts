import { Telegraf } from "telegraf";
import { BOT_TOKEN } from "../config/index.js";

const bot = new Telegraf(BOT_TOKEN);

export { bot };
