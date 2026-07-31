const APY_DECIMAL_PLACES = 2;
const APY_SCALE = 10 ** APY_DECIMAL_PLACES;

export function parseDisplayApy(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(APY_DECIMAL_PLACES, "0");
  const result = whole * APY_SCALE + Number(fraction || "0");
  return Number.isSafeInteger(result) ? result : null;
}

export function formatApy(apy: number): string {
  const whole = Math.trunc(apy / APY_SCALE);
  const fraction = Math.abs(apy % APY_SCALE)
    .toString()
    .padStart(APY_DECIMAL_PLACES, "0");
  return `${whole}.${fraction}%`;
}
