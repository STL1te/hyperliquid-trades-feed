import * as hl from "@nktkas/hyperliquid";

import { bot } from "./bot";
import { CHAT_ID } from "../config";
import { limiter, MAX_RETRIES, RETRY_DELAY_MS, API_DELAY_MS, formatNotional } from "../utils";

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

// Add new interfaces for position context
interface PositionContext {
  accountValue: number;
  positionSize: string;
  entryPrice: number;
  leverage: string;
  liquidationPrice: number;
  unrealizedPnl: number;
  positionValue: number;
  returnOnEquity: number;
  marginUsed: number;
}

interface MarketContext {
  markPrice: number;
  funding: number;
  openInterest: string;
  dayVolume: string;
}

// Add new function to get position context
const getPositionContext = async (
  address: hl.Hex,
  coin: string
): Promise<PositionContext | null> => {
  try {
    const state = await client.clearinghouseState({ user: address });
    // Find position for the given coin
    const position = state.assetPositions.find(
      (pos) => pos.type === "oneWay" && pos.position.coin === coin
    );

    if (!position) return null;

    const pos = position.position;
    return {
      accountValue: parseFloat(state.marginSummary.accountValue),
      entryPrice: parseFloat(pos.entryPx),
      positionSize: `${pos.szi} ${coin}`,
      leverage: `${pos.leverage.value}x (${pos.leverage.type})`,
      liquidationPrice: parseFloat(pos.liquidationPx ?? "N/A"),
      unrealizedPnl: parseFloat(pos.unrealizedPnl),
      positionValue: parseFloat(pos.positionValue),
      returnOnEquity: parseFloat(pos.returnOnEquity),
      marginUsed: parseFloat(pos.marginUsed)
    };
  } catch (error) {
    console.error(`Error fetching position context: ${error}`);
    return null;
  }
};

// Add new function to get market context
const getMarketContext = async (coin: string): Promise<MarketContext | null> => {
  try {
    const meta = await client.metaAndAssetCtxs();
    const assetCtx = meta[1].find((ctx: any, idx: number) => 
      meta[0].universe[idx].name === coin
    );  

    if (!assetCtx) return null;

    return {
      markPrice: parseFloat(assetCtx.markPx),
      funding: parseFloat(assetCtx.funding),
      openInterest: assetCtx.openInterest,
      dayVolume: assetCtx.dayNtlVlm
    };
  } catch (error) {
    console.error(`Error fetching market context: ${error}`);
    return null;
  }
};

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
        const trader = txDetails.tx.user;

        // Get additional context
        const state = await client.clearinghouseState({ user: trader });
        const assetPosition = state.assetPositions.find(
          (pos) => pos.type === "oneWay" && pos.position.coin === trade.coin
        );

        // Format notional value with our new helper function
        const formattedNotional = formatNotional(notionalValue);

        const coin = trade.coin;
        const side = trade.side === "B" ? "Long" : "Short";
        const fixedPrice = price.toFixed(2);

        // Create embeddable links
        const txLink = `https://app.hyperliquid.xyz/explorer/tx/${trade.hash}`;
        const traderLink = `https://hyperdash.info/trader/${trader}`;

        let msg = "";

        // Enhanced message with position and market context
        msg = `${trade.side === "B" ? "🟢" : "🔴"}  ${side} #${coin} $${formattedNotional} at $${fixedPrice} - 🔗 <a href="${txLink}">Explorer</a>`;
      

        if (assetPosition) {
          msg += `\n Account Value: $${formatNotional(parseFloat(state.marginSummary.accountValue))} - Position Size: ${parseFloat(assetPosition?.position.szi).toFixed(2)} ${assetPosition?.position.coin} - uPnL: ${parseFloat(assetPosition.position.unrealizedPnl).toFixed(0)} USD - <a href="${traderLink}">Trader</a>`;
        } else {
          msg += `\n Account Value: $${formatNotional(parseFloat(state.marginSummary.accountValue))} - <a href="${traderLink}">Trader</a>`;
        }

        // Send message to Telegram using HTML parse mode
        await bot.telegram
          .sendMessage(CHAT_ID!, msg, { parse_mode: "HTML" })
          .catch((error) => {
            throw new Error(`Something went wrong: ${error}`);
          });

        success = true;
      } catch (error: any) {
        retries++;

        // If it's a rate limit error and we haven't exceeded max retries
        if (error?.response?.status === 429 && retries <= MAX_RETRIES) {
          throw new Error(`Rate limit hit for trade ${trade.hash}: ${error}`);
        } else if (retries > MAX_RETRIES) {
          throw new Error(`Rate limit hit for trade ${trade.hash}: ${error}`);
        } else {
          throw new Error(`Error processing trade ${trade.hash}: ${error}`);
        }
      }
    }
  });
};

// (WARNING: unstable)
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

export { processTrade, getPositionContext, getMarketContext };
