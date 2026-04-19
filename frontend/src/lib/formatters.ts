const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const USD_FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const NUM_COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const NUM_FULL = new Intl.NumberFormat("en-US");
const PCT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

export const usdCompact = (value: number) => USD_COMPACT.format(value).replace(/\.0+([KMBT])/i, "$1");
export const usdFull = (value: number) => USD_FULL.format(value);
export const numCompact = (value: number) => NUM_COMPACT.format(value).replace(/\.0+([KMBT])/i, "$1");
export const numFull = (value: number) => NUM_FULL.format(value);
export const percent = (value: number) => PCT.format(value);

export function dataFreshnessAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const delta = Math.max(0, now - then);
  const hours = delta / (1000 * 60 * 60);
  if (hours < 1) return "less than 1 hour ago";
  if (hours < 24) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"} ago`;
  const days = hours / 24;
  return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"} ago`;
}
