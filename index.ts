import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import WebSocket from "ws";
import * as hl from "@nktkas/hyperliquid";
import pLimit from "p-limit";
import http from "http";

// Define an interface for the specific structure of a liquidate action
interface LiquidateAction {
  type: "liquidate" | string;
  user: hl.Hex; // Address of the liquidator
  isCross: boolean;
  asset: number; // Asset identifier (might need mapping to coin symbol if used)
  isBuy: boolean;
  liquidatedUser: hl.Hex; // Address of the liquidated user
}

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
  console.error(
    "Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in the .env file"
  );
  process.exit(1);
}

// Define the list of coins to monitor
const SUPPORTED_COINS: string[] = ["BTC"]; // Add more coin symbols here, e.g., ["BTC", "ETH"]
const MIN_NOTIONAL_VALUE = 50000;

const bot = new Telegraf(botToken);
const transport = new hl.HttpTransport(); // Using HTTP for fetching transaction details
const client = new hl.PublicClient({ transport });

const ws = new WebSocket("wss://api.hyperliquid.xyz/ws");

// Open the connection
ws.on("open", async () => {
  console.log("Connected to Hyperliquid WebSocket");

  try {
    console.log(`Subscribing to trades for: ${SUPPORTED_COINS.join(", ")}`);

    // Iterate through the defined coins and subscribe
    for (const coin of SUPPORTED_COINS) {
      const subscriptionMessage = {
        method: "subscribe",
        subscription: { type: "trades", coin: coin },
      };
      ws.send(JSON.stringify(subscriptionMessage));
      console.log(`Sent subscription request for ${coin} trades.`);
      // Optional: Add a small delay between subscriptions if needed
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } catch (error) {
    console.error("Error subscribing to trades:", error);
    // Consider closing the connection or attempting retry logic here
    ws.close();
    process.exit(1);
  }

  // Now that we're subscribed without errors, send a startup message to the channel
  bot.telegram
    .sendMessage(chatId, "Bot now up and running. Watching for liquidations...")
    .catch((err) => {
      console.error("Failed to send startup message:", err);
    });
});

// Process websocket messages
ws.on("message", async (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.channel === "trades" && message.data) {
      const trades: hl.WsTrade[] = message.data;

      for (const trade of trades) {
        // Calculate notional value
        const price = parseFloat(trade.px);
        const size = parseFloat(trade.sz);
        const notionalValue = price * size;

        // Filter trades by notional value
        if (notionalValue > MIN_NOTIONAL_VALUE) {
          // This is the log the user wants to keep:

          // Process this trade asynchronously without blocking the loop
          processTrade(trade, price, notionalValue).catch((error) => {
            // console.error(`Error processing trade ${trade.hash}:`, error);
          });
        }
      }
    } else if (message.channel && message.channel !== "trades") {
      // Log messages from other channels if they arrive
    } else if (message.ping) {
      // Handle ping messages if necessary (e.g., send pong)
      console.log("Received ping message");
      // ws.send(JSON.stringify({ pong: true })); // Example pong response if needed
    } else {
      console.log("Received unexpected message format:", message);
    }
  } catch (error) {
    console.error("Error processing WebSocket message batch:", error);
    console.error("Failed message data:", data.toString());
  }
});

// Define queue configuration
const API_CONCURRENCY = 3; // Max concurrent API requests
const API_DELAY_MS = 500; // Delay between API requests
const MAX_RETRIES = 3; // Maximum retry attempts
const RETRY_DELAY_MS = 1000; // Base delay before retrying

// Create a rate limiter
const limiter = pLimit(API_CONCURRENCY);

// Improved processTrade function with retry logic
async function processTrade(
  trade: hl.WsTrade,
  price: number,
  notionalValue: number
): Promise<void> {
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
        const notional = (notionalValue / 1000).toFixed(1) + "K";

        let msg = "";

        if (isLiquidation) {
          const coin = trade.coin;
          const side = trade.side === "B" ? "Short" : "Long";

          msg = `#${coin} Liquidated ${side}: ${notional} at $${price.toFixed(
            2
          )}`;
        } else {
          msg = `${trade.side === "B" ? "🟢" : "🔴"} ${trade.side} ${
            trade.coin
          } - $${notional} at $${price.toFixed(2)}`;
        }

        // Send message to Telegram
        await bot.telegram.sendMessage(chatId!, msg).catch((error) => {
          console.error(
            `Failed to send Telegram message for trade ${trade.hash}:`,
            error
          );
        });

        logTrade(trade, txDetails, isLiquidation);
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
}

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});

ws.on("close", () => {
  console.log(
    "Disconnected from Hyperliquid WebSocket. Attempting to reconnect..."
  );
  // Implement reconnection logic if needed
});

// Placeholder function to determine if a transaction is a liquidation
// This needs to be implemented based on the actual structure of txDetails
function checkIfLiquidation(txDetails: hl.TxDetailsResponse): boolean {
  // Access the action object from the transaction details safely
  const action = txDetails?.tx?.action as unknown as LiquidateAction;

  // Check if the action object exists and its type is 'liquidate'
  if (action && action.type === "liquidate") {
    return true;
  }

  // If the action type is not 'liquidate', it's not a liquidation event
  return false;
}

// helper function to log a trade
function logTrade(
  trade: hl.WsTrade,
  txDetails: hl.TxDetailsResponse,
  isLiquidation: boolean
) {
  console.log(
    `┌─────────── TRADE DETECTED ───────────┐
│ Hash:      ${trade.hash.substring(0, 10)}...
│ Coin:      ${trade.coin}
│ Side:      ${trade.side === "B" ? "BUY" : "SELL"}
│ Size:      ${parseFloat(trade.sz).toFixed(4)}
│ Price:     ${parseFloat(trade.px).toFixed(2)}
│ Notional:  $${(parseFloat(trade.px) * parseFloat(trade.sz)).toFixed(2)}
│ IsLiquidation: ${isLiquidation}
│ Tx Details: ${JSON.stringify(txDetails)}
│ Timestamp: ${new Date(trade.time).toLocaleString()}
└────────────────────────────────────┘`
  );
}

// Create a simple HTTP server for health check
const server = http.createServer((req, res) => {
  // Set CORS headers for broader access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // Return different responses based on the path
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

// Use the PORT environment variable or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => {
  ws.close();
  bot.stop("SIGINT");
  server.close();
});
process.once("SIGTERM", () => {
  ws.close();
  bot.stop("SIGTERM");
  server.close();
});

console.log("Telegram bot started...");
