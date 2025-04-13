/**
 * Formats a numerical value to use K (thousands) or M (millions)
 * with proper rounding to remove unnecessary zeros
 */
export function formatNotional(value: number): string {
  if (value >= 1000000) {
    // For millions
    const inMillions = value / 1000000;
    // Check if the decimal part is significant
    return Number.isInteger(inMillions) || inMillions.toFixed(1).endsWith(".0")
      ? `${Math.floor(inMillions)}M`
      : `${inMillions.toFixed(1)}M`;
  } else {
    // For thousands
    const inThousands = value / 1000;
    // Check if the decimal part is significant
    return Number.isInteger(inThousands) ||
      inThousands.toFixed(1).endsWith(".0")
      ? `${Math.floor(inThousands)}K`
      : `${inThousands.toFixed(1)}K`;
  }
}
