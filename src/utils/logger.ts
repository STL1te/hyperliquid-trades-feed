import * as hl from "@nktkas/hyperliquid";

// Helper function to log a trade
export const logTrade = (
  trade: hl.WsTrade,
  tx: hl.TxDetailsResponse,
  isLiquidation: boolean
) => {
  console.log(
    `┌─────────── TRADE DETECTED ───────────┐
  │ Hash:      ${trade.hash.substring(0, 10)}...
  │ Coin:      ${trade.coin}
  │ Side:      ${trade.side === "B" ? "BUY" : "SELL"}
  │ Size:      ${parseFloat(trade.sz).toFixed(4)}
  │ Price:     ${parseFloat(trade.px).toFixed(2)}
  │ Notional:  $${(parseFloat(trade.px) * parseFloat(trade.sz)).toFixed(2)}
  │ IsLiquidation: ${isLiquidation}
  │ Tx Details: ${JSON.stringify(tx)}
  │ Timestamp: ${new Date(trade.time).toLocaleString()}
  └────────────────────────────────────┘`
  );
};
