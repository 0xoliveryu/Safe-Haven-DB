export function shortHex(value: string, start = 6, end = 4): string {
  if (!value) return "";
  if (value.length <= start + end + 2) return value;
  return `${value.slice(0, start + 2)}…${value.slice(-end)}`;
}

export function formatTimestamp(seconds: bigint): string {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString();
}

