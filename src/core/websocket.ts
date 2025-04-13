import WebSocket from "ws";
import * as hl from "@nktkas/hyperliquid";
import { SUPPORTED_COINS, MIN_NOTIONAL_VALUE } from "../config";
import { processTrade } from "./hyperliquid";

// Create a single WebSocket instance to be used throughout the application
let ws: WebSocket;

// Initialize WebSocket with all event handlers
export const websocket = () => {
  ws = new WebSocket("wss://api.hyperliquid.xyz/ws");

  // Set up all event handlers
  setupOpenHandler();
  setupMessageHandler();
  setupErrorHandler();
  setupCloseHandler();

  return ws;
};

// Handle connection opening
const setupOpenHandler = () => {
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
        // Optional: Add a small delay between subscriptions if needed
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error("Error subscribing to trades:", error);
      ws.close();
      // Use setTimeout to allow time for cleanup before exit
      setTimeout(() => process.exit(1), 1000);
    }
  });
};

// Handle incoming messages
const setupMessageHandler = () => {
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
            // Process this trade asynchronously without blocking the loop
            processTrade(trade, price, notionalValue).catch((error) => {
              console.error(`Error processing trade ${trade.hash}:`, error);
            });
          }
        }
      } else if (message.channel && message.channel !== "trades") {
        // Log messages from other channels if they arrive
      } else if (message.ping) {
        console.log("Received ping message");
        ws.send(JSON.stringify({ pong: true })); // Send pong response
      } else {
        console.log("Received unexpected message format:", message);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });
};

// Handle errors
const setupErrorHandler = () => {
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
};

// Handle connection closing with reconnection logic
const setupCloseHandler = () => {
  ws.on("close", () => {
    console.log(
      "Disconnected from Hyperliquid WebSocket. Attempting to reconnect..."
    );

    // Reconnection logic with exponential backoff
    let reconnectAttempt = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 1000; // 1 second

    const reconnect = () => {
      if (reconnectAttempt < maxReconnectAttempts) {
        reconnectAttempt++;
        const delay = baseDelay * Math.pow(1.5, reconnectAttempt - 1);
        console.log(
          `Reconnect attempt ${reconnectAttempt}/${maxReconnectAttempts} in ${delay}ms`
        );

        setTimeout(() => {
          console.log(
            `Attempting to reconnect (${reconnectAttempt}/${maxReconnectAttempts})...`
          );
          // Create a new WebSocket without calling the full websocket() function
          ws = new WebSocket("wss://api.hyperliquid.xyz/ws");
          // Re-setup the handlers on the new instance
          setupOpenHandler();
          setupMessageHandler();
          setupErrorHandler();
          setupCloseHandler();
        }, delay);
      } else {
        console.error("Max reconnection attempts reached. Exiting...");
        process.exit(1);
      }
    };

    reconnect();
  });
};

// Export WebSocket instance for external use if needed
export const getWebSocket = () => ws;
