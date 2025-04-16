import dotenv from "dotenv";

dotenv.config();

// Add more coin symbols here, e.g., ["BTC", "ETH"]
const SUPPORTED_COINS: string[] = ["BTC", "ETH", "SOL", "HYPE"];
// Define the minimum notional value for a trade to go trough the filter
const MIN_NOTIONAL_VALUE = 1000000;

// Required environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID as string;

if (!BOT_TOKEN || !CHAT_ID) throw new Error("Missing required variables.");

export { BOT_TOKEN, CHAT_ID, SUPPORTED_COINS, MIN_NOTIONAL_VALUE };
