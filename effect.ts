import dotenv from "dotenv";
dotenv.config(); // Load .env file into process.env

import { Telegraf } from "telegraf";
import WebSocket from "ws";
import * as hl from "@nktkas/hyperliquid";
import {
  Effect,
  Layer,
  Context,
  Config,
  ConfigError,
  Redacted,
  Secret,
  Stream,
  Schedule,
  Duration,
  Cause,
  Option,
  Chunk,
  Scope,
  Data,
} from "effect";

// --- Configuration ---

// Interface holds Redacted values for secrets
interface AppConfig {
  readonly telegramBotToken: Redacted.Redacted;
  readonly telegramChatId: Redacted.Redacted;
  readonly supportedCoins: ReadonlyArray<string>;
  readonly minNotionalValue: number;
}

const AppConfig = Context.GenericTag<AppConfig>("AppConfig");

const AppConfigLive = Layer.effect(
  AppConfig,
  Effect.all({
    // Use Config.redacted() directly
    telegramBotToken: Config.redacted("TELEGRAM_BOT_TOKEN"),
    telegramChatId: Config.redacted("TELEGRAM_CHAT_ID"),
    supportedCoins: Config.string("SUPPORTED_COINS").pipe(
      Config.map((s) => s.split(",").map((c) => c.trim())),
      Config.withDefault(["BTC"])
    ),
    minNotionalValue: Config.number("MIN_NOTIONAL_VALUE").pipe(
      Config.withDefault(50000)
    ),
  })
);

// --- Services ---

// Telegraf Service Interface
interface TelegrafService {
  // Takes plain string chat ID, as it's resolved in the layer
  readonly sendMessage: (
    chatId: string,
    text: string
  ) => Effect.Effect<void, Error>;
}
const TelegrafService = Context.GenericTag<TelegrafService>("TelegrafService");

const TelegrafLive = Layer.scoped(
  TelegrafService,
  Effect.gen(function* (_) {
    const config = yield* _(AppConfig);
    // Use Redacted.value() to get the actual string
    const tokenValue = Redacted.value(config.telegramBotToken);
    const chatIdValue = Redacted.value(config.telegramChatId);

    const bot = new Telegraf(tokenValue);

    yield* _(Effect.addFinalizer(() => Effect.sync(() => bot.stop("SIGTERM"))));
    yield* _(Effect.logInfo("Initializing Telegraf..."));
    yield* _(
      Effect.sync(() => {
        console.log("Telegraf bot initialized (not launched).");
      })
    );

    // sendMessage now uses the resolved chatIdValue
    const sendMessage = (
      chatId: string,
      text: string
    ): Effect.Effect<void, Error> =>
      Effect.tryPromise({
        try: () => bot.telegram.sendMessage(chatId, text),
        catch: (unknownError) =>
          new Error(`Failed to send Telegram message: ${String(unknownError)}`),
      }).pipe(Effect.asVoid);

    // Provide the implementation that uses the resolved chatId
    return TelegrafService.of({
      sendMessage: (_, text) => sendMessage(chatIdValue, text),
    });
  })
);

// Hyperliquid Public Client Service
interface HyperliquidPublicService extends hl.PublicClient {}
const HyperliquidPublicClient = Context.GenericTag<HyperliquidPublicService>(
  "HyperliquidPublicClient"
);
const HyperliquidPublicClientLive = Layer.succeed(
  HyperliquidPublicClient,
  new hl.PublicClient({ transport: new hl.HttpTransport() })
);

// --- WebSocket Handling ---

class WebSocketError extends Data.TaggedError("WebSocketError")<{
  readonly error: unknown;
}> {}
class WebSocketCloseError extends Data.TaggedError("WebSocketCloseError")<{
  readonly code: number;
  readonly reason: string;
}> {}
class JsonParseError extends Data.TaggedError("JsonParseError")<{
  readonly error: unknown;
}> {}

const makeWebSocketStream = (
  url: string,
  subscriptions: ReadonlyArray<unknown>
): Stream.Stream<string, WebSocketError | WebSocketCloseError, Scope.Scope> =>
  Stream.unwrapScoped(
    Effect.gen(function* (_) {
      const ws = yield* _(
        Effect.acquireRelease(
          Effect.async<WebSocket, WebSocketError>((resume) => {
            Effect.logInfo(`Connecting to WebSocket: ${url}`);
            const ws = new WebSocket(url);
            ws.on("open", () => {
              Effect.logInfo("WebSocket connection opened.");
              resume(Effect.succeed(ws));
            });
            ws.on("error", (error) => {
              Effect.logError(
                "WebSocket error during connection",
                Cause.fail(error)
              );
              if (ws.readyState === WebSocket.CONNECTING) {
                resume(Effect.fail(new WebSocketError({ error })));
              }
            });
          }),
          (ws, exit) =>
            Effect.sync(() => {
              Effect.logInfo(
                `Closing WebSocket connection (exit: ${exit._tag})`
              );
              if (
                ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING
              ) {
                ws.close();
              }
            })
        )
      );

      // Yield the Effect.forEach directly
      yield* _(
        Effect.forEach(
          subscriptions,
          (sub) =>
            Effect.try({
              try: () => ws.send(JSON.stringify(sub)),
              catch: (error) => new WebSocketError({ error }),
            }),
          { concurrency: "inherit" }
        ).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logWarning("Failed to send one or more subscriptions", cause)
          )
        )
      );

      const stream = Stream.async<string, WebSocketError | WebSocketCloseError>(
        (emit) => {
          ws.on("message", (data) => {
            emit(Effect.succeed(Chunk.of(data.toString())));
          });
          ws.on("close", (code, reason) => {
            Effect.logInfo(`WebSocket connection closed: ${code}`);
            emit(
              Effect.fail(
                Option.some(
                  new WebSocketCloseError({ code, reason: reason.toString() })
                )
              )
            );
          });
          ws.on("error", (error) => {
            Effect.logError(
              "WebSocket error after connection",
              Cause.fail(error)
            );
          });
        },
        1 // Buffer size
      );
      // Return the stream - type inference should work if async types are correct
      return stream;
    })
  );

// --- Domain Logic ---

interface ProcessedTrade {
  readonly coin: string;
  readonly side: "Long" | "Short";
  readonly notionalValue: number;
  readonly formattedNotional: string;
  readonly price: number;
  readonly hash: string;
}

const checkIfLiquidation = (
  txDetails: hl.TxDetailsResponse
): Effect.Effect<boolean, never> =>
  Effect.sync(() => {
    console.log(
      "Checking txDetails (Placeholder):",
      JSON.stringify(txDetails).substring(0, 200) + "..."
    );
    const txInfo = (txDetails as any).tx;
    return txInfo?.fills?.some((fill: any) => fill.liquidation) ?? false;
  });

const processTrade = (
  trade: hl.WsTrade
): Effect.Effect<
  Option.Option<ProcessedTrade>,
  Error,
  AppConfig | HyperliquidPublicService
> =>
  Effect.gen(function* (_) {
    const config = yield* _(AppConfig);
    const price = parseFloat(trade.px);
    const size = parseFloat(trade.sz);
    if (isNaN(price) || isNaN(size)) {
      yield* _(Effect.logWarning(`Invalid price/size in trade: ${trade.hash}`));
      return Option.none<ProcessedTrade>();
    }
    const notionalValue = price * size;

    if (notionalValue <= config.minNotionalValue) {
      return Option.none<ProcessedTrade>();
    }

    yield* _(
      Effect.logDebug(
        `Processing high-value trade: ${trade.hash} ($${notionalValue.toFixed(
          0
        )})`
      )
    );
    const publicClient = yield* _(HyperliquidPublicClient);

    const txDetails = yield* _(
      Effect.tryPromise({
        try: () => publicClient.txDetails({ hash: trade.hash }),
        catch: (unknownError) =>
          new Error(`Failed to fetch txDetails: ${String(unknownError)}`),
      })
    );

    const isLiquidation = yield* _(checkIfLiquidation(txDetails));

    if (!isLiquidation) {
      return Option.none<ProcessedTrade>();
    }

    const side = trade.side === "B" ? "Long" : "Short";
    const formattedNotional = (notionalValue / 1000).toFixed(1) + "K";

    return Option.some({
      coin: trade.coin,
      side,
      notionalValue,
      formattedNotional,
      price,
      hash: trade.hash,
    });
  });

const formatNotification = (trade: ProcessedTrade): string =>
  `🔴 #${trade.coin} Liquidated ${trade.side}: $${
    trade.formattedNotional
  } at $${trade.price.toFixed(2)}`;

// --- Main Application Logic ---

const streamPipelineEffect = Effect.gen(function* (_) {
  const config = yield* _(AppConfig);
  const telegraf = yield* _(TelegrafService);
  const chatId = Redacted.value(config.telegramChatId); // Resolve chat ID here

  const subscriptionMessages = config.supportedCoins.map((coin) => ({
    method: "subscribe",
    subscription: { type: "trades", coin: coin },
  }));

  const webSocketUrl = "wss://api.hyperliquid.xyz/ws";

  const stream = makeWebSocketStream(webSocketUrl, subscriptionMessages).pipe(
    Stream.mapEffect((data) =>
      Effect.try({
        try: () => JSON.parse(data) as unknown,
        catch: (error) => new JsonParseError({ error }),
      })
    ),
    Stream.filterMap(
      (msg): Option.Option<{ channel: "trades"; data: hl.WsTrade[] }> => {
        if (
          typeof msg === "object" &&
          msg !== null &&
          (msg as any).channel === "trades" &&
          Array.isArray((msg as any).data)
        ) {
          return Option.some(msg as { channel: "trades"; data: hl.WsTrade[] });
        }
        return Option.none();
      }
    ),
    Stream.tap((msg) =>
      Effect.logDebug(`Received batch of ${msg.data.length} trades.`)
    ),
    Stream.mapConcatChunk((msg) => Chunk.fromIterable(msg.data)),
    Stream.mapEffect(processTrade, { concurrency: 5 }),
    Stream.filter((opt): opt is Option.Some<ProcessedTrade> =>
      Option.isSome(opt)
    ),
    Stream.map((opt) => opt.value),
    Stream.tap((trade) =>
      Effect.logInfo(
        `Liquidation detected: ${formatNotification(trade)} Hash: ${trade.hash}`
      )
    ),
    Stream.map(formatNotification),
    Stream.runForEach((messageText) =>
      telegraf.sendMessage(chatId, messageText).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError("Failed to send Telegram message", cause)
        ),
        Effect.forkDaemon
      )
    )
  );

  yield* _(Stream.runDrain(stream));
});

// --- Application Composition and Execution ---

// Remove the explicit Layer definition merging AppConfig, Telegraf, and HL.
// We will provide them sequentially to the main effect.

// Program requires Scope (from WS stream) + Services
const program = streamPipelineEffect.pipe(
  // Provide AppConfigLive first, as TelegrafLive depends on it.
  Effect.provide(AppConfigLive),
  // Provide TelegrafLive. It can now access AppConfig from the context.
  Effect.provide(TelegrafLive),
  // Provide HyperliquidPublicClientLive. It has no dependencies here.
  Effect.provide(HyperliquidPublicClientLive)
  // The final effect now only requires Scope, which runFork provides.
);

// Handle ConfigError, then provide Scope via runFork implicitly
const main = program.pipe(
  Effect.catchTag("ConfigError", (e) => {
    console.error("Configuration Error:", e);
    // Exit gracefully on config error
    return Effect.logFatal("Configuration Error", Cause.fail(e));
  }),
  // Catch any other unhandled errors
  Effect.catchAllCause((cause) => {
    console.error("Unhandled application error:", Cause.pretty(cause));
    return Effect.logFatal("Unhandled application error", cause);
  })
);

// runFork provides the necessary Scope and Runtime.
// The final effect should be Effect<void, never, never>
// @ts-ignore
Effect.runFork(main);

console.log("Effect application started...");

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down...");
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down...");
});
