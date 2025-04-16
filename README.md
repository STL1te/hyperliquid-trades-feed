# Hyperliquid Trades Feed Bot

This bot monitors Hyperliquid trades and sends notifications to a Telegram channel when significant trades occur.

## Prerequisites

Before you begin, make sure you have the following installed:
- [Node.js](https://nodejs.org/) (version 22.4.0 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/) (for cloning the repository)

## Step-by-Step Setup Guide

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/hl-liquidations.git
cd hl-liquidations
```

### 2. Create Your Telegram Bot
1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Start a chat with BotFather and send `/newbot`
3. Follow the instructions to create your bot
4. **Save the API token** that BotFather gives you - you'll need it later
5. Start a chat with your new bot by clicking the link BotFather provides

### 3. Get Your Telegram Chat ID
1. Create a new Telegram channel where you want to receive notifications
2. Add your bot to the channel as an administrator
3. Forward any message from your channel to [@userinfobot](https://t.me/userinfobot)
4. The bot will reply with information including the chat ID (it will look like `-100xxxxxxxxxx`)

### 4. Set Up Environment Variables
1. Create a file named `.env` in the project root directory
2. Copy the contents from `.env.example` into `.env`
3. Fill in your Telegram bot token and chat ID

### 5. Install Dependencies
```bash
npm install
```

### 6. Build the Project
```bash
npm run build
```

### 7. Start the Bot
```bash
npm start
```

For development, you can use:
```bash
npm run dev
```

## Configuration

You can customize the bot by modifying the following in `src/config/index.ts`:
- `SUPPORTED_COINS`: List of cryptocurrencies to monitor
- `MIN_NOTIONAL_VALUE`: Minimum trade value to trigger notifications (default: 1,000,000)

## Features

- Real-time trade monitoring on Hyperliquid
- Automatic notifications for large trades and liquidations
- Support for multiple cryptocurrencies
- Automatic reconnection on connection loss
- Health check endpoint

## Troubleshooting

1. **Bot not sending messages:**
   - Verify your bot token and chat ID in `.env`
   - Ensure the bot is an administrator in your channel
   - Check if the bot has permission to send messages

2. **Connection issues:**
   - Check your internet connection
   - Verify that the Hyperliquid API is accessible
   - Check the console logs for error messages

3. **Node.js version error:**
   - Ensure you have Node.js version 22.4.0 or higher installed
   - Run `node -v` to check your version
   - If needed, update Node.js using [nvm](https://github.com/nvm-sh/nvm)

## Health Check

The bot includes a health check endpoint running on port 3000. You can access it at the root path `/`:
```bash
http://localhost:3000/
```

## Support

If you encounter any issues or need help, please open an issue on the GitHub repository.
