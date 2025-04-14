import dotenv from "dotenv";

dotenv.config();

// Define the list of coins to monitor
const SUPPORTED_COINS: string[] = ["BTC", "ETH", "SOL", "HYPE"]; // Add more coin symbols here, e.g., ["BTC", "ETH"]
const MIN_NOTIONAL_VALUE = 1000000;

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID as string;

if (!BOT_TOKEN || !CHAT_ID) throw new Error("Missing required variables.");

export { BOT_TOKEN, CHAT_ID, SUPPORTED_COINS, MIN_NOTIONAL_VALUE };
