import {healthcheck} from "./utils/healtcheck";
import {websocket} from "./core/websocket";
import {bot} from "./core/bot";

/**
 * This is the main entry point for the bot.
 * It will start the bot and handle all the necessary setup.
 * It will also handle the shutdown of the bot when a parent process is terminated.
 */

// Delay startup to give any previous instance time to shut down
setTimeout(() => {
    // Create HTTP server for health check
    const server = healthcheck();

    // Handle all-things websocket
    const ws = websocket();

    // Launch bot
    bot
        .launch()
        .then(() => {
            console.log("Hyperliquid trades feed bot started successfully!");
        })
        .catch((err: any) => {
            throw new Error(`Failed to start Telegram bot: ${err}`);
        });

    // Centralized shutdown handler
    const shutdown = async (signal: string) => {
        console.log(`Received ${signal}. Shutting down gracefully...`);

        // Give ongoing operations time to complete
        setTimeout(() => {
            process.exit(1);
        }, 10000); // Force exit after 10 seconds

        try {
            // Tell the health check to start failing to prevent Railway from routing new requests
            if (server) {
                server.close();
            }

            // Stop the bot - this is critical to release the Telegram webhook
            bot.stop(signal);

            // Close websocket
            if (ws) ws.close();

            // Give Telegram a moment to fully close the connection
            await new Promise((resolve) => setTimeout(resolve, 1000));

            process.exit(0);
        } catch (error) {
            process.exit(1);
        }
    };

    // Handle termination signals
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
}, 5000); // 5 second delay
