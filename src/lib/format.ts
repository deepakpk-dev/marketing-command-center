export const money = (value: number | null, decimals = 0) =>
  value === null
    ? "N/A"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      }).format(value);
export const number = (value: number | null) =>
  value === null
    ? "N/A"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
        value,
      );
export const percent = (value: number | null, decimals = 2) =>
  value === null ? "N/A" : `${(value * 100).toFixed(decimals)}%`;
export const multiplier = (value: number | null) =>
  value === null ? "N/A" : `${value.toFixed(2)}x`;
export const dateLabel = (date: string, year = false) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
export const timeLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
