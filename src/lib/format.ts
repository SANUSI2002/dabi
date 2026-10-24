import { format, formatDistanceToNow, differenceInYears, differenceInMonths } from "date-fns";

export const naira = (n: number) =>
  n === 0 ? "Free" : "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });

/**
 * Accounting money formatter — always shows the currency and 2 dp (so ₦0.00, not
 * "Free"), negatives in accountancy parentheses. Use for ledgers, statements and
 * anything in the Accounting module.
 */
export const money = (n: number, opts?: { currency?: string; dp?: number; blankZero?: boolean }) => {
  const { currency = "₦", dp = 2, blankZero = false } = opts ?? {};
  if (blankZero && Math.abs(n) < 0.005) return "";
  const abs = Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return n < -0.005 ? `(${currency}${abs})` : `${currency}${abs}`;
};

export const signedMoney = (n: number, currency = "₦") =>
  `${n < 0 ? "-" : ""}${currency}${Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const isoDate = (d: string | Date) => format(new Date(d), "yyyy-MM-dd");

/** The first and last instant of a picked day (yyyy-MM-dd) in the hospital's own time zone, as ISO —
 *  not UTC midnight, which in Lagos (UTC+1) starts and ends every day an hour off. */
export const dayStartIso = (day: string) => new Date(`${day}T00:00:00`).toISOString();
export const dayEndIso = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();
export const shortDate = (d: string | Date) => format(new Date(d), "dd MMM yyyy");
export const dateTime = (d: string | Date) => format(new Date(d), "dd MMM yyyy, HH:mm");
export const timeAgo = (d: string | Date) => formatDistanceToNow(new Date(d), { addSuffix: true });

export function ageFromDob(dob: string | Date) {
  const years = differenceInYears(new Date(), new Date(dob));
  if (years >= 1) return `${years} yr`;
  const months = differenceInMonths(new Date(), new Date(dob));
  return `${months} mo`;
}

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export const pct = (n: number, d: number) => (d === 0 ? "0%" : Math.round((n / d) * 100) + "%");
