// How the admin site shows numbers and dates.

const locale = "en-GB";

export const number = (n: number) => n.toLocaleString(locale);

/** An instant (with a zone), shown in this browser's time zone. */
export const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

/** A day (yyyy-MM-dd), e.g. "4 Oct". */
export const day = (value: string) =>
  new Date(value + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });

export function ago(value?: string | null) {
  if (!value) return "never";
  const minutes = (Date.now() - new Date(value).getTime()) / 60_000;
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)} h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)} d ago`;
  return date(value);
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/** A quiz's generation status, as the website shows it. */
export const status = (value: string) =>
  ({ never_generated: "Never generated", queued: "Queued", pending: "Generating", success: "Generated", failed: "Failed" })[value] ?? value;

export const initials = (name: string | undefined, email: string) => {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (name?.trim() && parts[1] ? parts[1][0] : "")).toUpperCase();
};
