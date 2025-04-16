import pLimit from "p-limit";

// Define queue configuration
export const API_CONCURRENCY = 3; // Max concurrent API requests
export const API_DELAY_MS = 500; // Delay between API requests
export const MAX_RETRIES = 3; // Maximum retry attempts
export const RETRY_DELAY_MS = 1000; // Base delay before retrying

// Create a rate limiter instance
export const limiter = pLimit(API_CONCURRENCY);
