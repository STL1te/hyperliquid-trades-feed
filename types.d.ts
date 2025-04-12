import * as hl from "@nktkas/hyperliquid";

export interface LiquidateAction {
  type: "liquidate" | string;
  user: hl.Hex; // Address of the liquidator
  isCross: boolean;
  asset: number; // Asset identifier (might need mapping to coin symbol if used)
  isBuy: boolean;
  liquidatedUser: hl.Hex; // Address of the liquidated user
}
