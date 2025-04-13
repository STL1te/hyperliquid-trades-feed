import * as hl from "@nktkas/hyperliquid";

import { bot } from "./bot";
import { CHAT_ID } from "../config";
import { limiter, MAX_RETRIES, RETRY_DELAY_MS, API_DELAY_MS } from "../utils";

export interface LiquidateAction {
  type: "liquidate" | string;
  user: hl.Hex; // Address of the liquidator
  isCross: boolean;
  asset: number; // Asset identifier (might need mapping to coin symbol if used)
  isBuy: boolean;
  liquidatedUser: hl.Hex; // Address of the liquidated user
}

const transport = new hl.HttpTransport();
const client = new hl.PublicClient({ transport });

// Process a trade and send a message to Telegram
const processTrade = async (
  trade: hl.WsTrade,
  price: number,
  notionalValue: number
): Promise<void> => {
  // Use the limiter to control concurrency
  await limiter(async () => {
    let retries = 0;
    let success = false;

    while (!success && retries <= MAX_RETRIES) {
      try {
        // Add delay between API calls
        if (retries > 0) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retries - 1))
          );
        } else if (retries === 0 && API_DELAY_MS > 0) {
          // Regular delay for first attempt
          await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
        }

        // Fetch transaction details
        const txDetails = await client.txDetails({ hash: trade.hash });

        // Check if the transaction involves a liquidation
        const isLiquidation = checkIfLiquidation(txDetails);

        // Format notional value as millions (M) if over 1M, otherwise as thousands (K)
        let formattedNotional: string;
        if (notionalValue >= 1000000) {
          formattedNotional = (notionalValue / 1000000).toFixed(1) + "M";
        } else {
          formattedNotional = (notionalValue / 1000).toFixed(1) + "K";
        }

        const coin = trade.coin;
        const side = trade.side === "B" ? "Long" : "Short";
        const fixedPrice = price.toFixed(2);

        // Create transaction explorer link
        const txLink = `https://app.hyperliquid.xyz/explorer/tx/${trade.hash}`;

        let msg = "";

        if (isLiquidation) {
          msg = `${trade.side === "B" ? "🟢" : "🔴"} #${coin} Liquidated ${
            trade.side === "B" ? "LONG" : "SHORT"
          }: ${formattedNotional} at $${fixedPrice} <a href="${txLink}">link</a>`;
        } else {
          msg = `${
            trade.side === "B" ? "🟢" : "🔴"
          } ${side} #${coin} - $${formattedNotional} at $${fixedPrice} <a href="${txLink}">link</a>`;
        }

        // Send message to Telegram using HTML parse mode
        await bot.telegram
          .sendMessage(CHAT_ID!, msg, { parse_mode: "HTML" })
          .catch((error) => {
            console.error(
              `Failed to send Telegram message for trade ${trade.hash}:`,
              error
            );
          });

        // logTrade(trade, txDetails, isLiquidation);
        success = true;
      } catch (error: any) {
        retries++;

        // If it's a rate limit error and we haven't exceeded max retries
        if (error?.response?.status === 429 && retries <= MAX_RETRIES) {
          console.log(
            `Rate limit hit for trade ${trade.hash}. Retry attempt ${retries}/${MAX_RETRIES}`
          );
        } else if (retries > MAX_RETRIES) {
          console.error(`Max retries exceeded for trade ${trade.hash}:`, error);
        } else {
          // console.error(`Error processing trade ${trade.hash}:`, error);
        }
      }
    }
  });
};

// Check if a given Hyperliquid TX transaction involves a liquidation
const checkIfLiquidation = (txDetails: hl.TxDetailsResponse): boolean => {
  // Access the action object from the transaction details safely
  const action = txDetails?.tx?.action as unknown as LiquidateAction;

  // Check if the action object exists and its type is 'liquidate'
  if (action && action.type === "liquidate") {
    return true;
  }

  // If the action type is not 'liquidate', we assume it's not a liquidation event
  return false;
};

export { processTrade };
