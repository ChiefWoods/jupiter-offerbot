export function formatMint(mint: string, symbol: string | null): string {
  return `${mint}${symbol ? ` (${symbol})` : ""}`;
}

export function formatShortMint(mint: string): string {
  return mint.length <= 8 ? mint : `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export function formatSubscriptionAsset(mint: string, symbol: string | null): string {
  const shortMint = formatShortMint(mint);
  return symbol ? `${symbol} (${shortMint})` : shortMint;
}
