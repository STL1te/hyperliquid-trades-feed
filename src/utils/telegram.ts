import {Telegraf} from "telegraf";
import {Context} from "telegraf";
import {Update} from "telegraf/types";

import {CHAT_ID} from "../config";

/**
 * Send a message to the Telegram channel
 * @param msg - The message to send
 * @param bot - The Telegram bot instance
 * @returns {Promise<void>}
 */
export const sendTelegramMessage = async (
    msg: string,
    bot: Telegraf<Context<Update>>
): Promise<void> => {
    try {
        await bot.telegram.sendMessage(CHAT_ID!, msg);
    } catch (error) {
        throw new Error(`Error sending Telegram message: ${error}`);
    }
};
