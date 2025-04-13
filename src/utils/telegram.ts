import { Telegraf } from "telegraf";
import { Context } from "telegraf";
import { Update } from "telegraf/types";

import { CHAT_ID } from "../config";

export const sendTelegramMessage = async (
  msg: string,
  bot: Telegraf<Context<Update>>
) => {
  try {
    await bot.telegram.sendMessage(CHAT_ID!, msg);
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
};
