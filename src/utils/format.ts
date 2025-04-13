/**
 * Formats a numerical value to use K (thousands) or M (millions)
 * with proper rounding to remove unnecessary zeros
 */
export function formatNotional(value: number): string {
  if (value >= 1000000) {
    // For millions
    const inMillions = value / 1000000;
    return inMillions % 1 === 0
      ? `${inMillions.toFixed(0)}M`
      : `${inMillions.toFixed(1)}M`;
  } else {
    // For thousands
    const inThousands = value / 1000;
    return inThousands % 1 === 0
      ? `${inThousands.toFixed(0)}K`
      : `${inThousands.toFixed(1)}K`;
  }
}
