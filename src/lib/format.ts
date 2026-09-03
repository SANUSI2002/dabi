import { format, formatDistanceToNow, differenceInYears, differenceInMonths } from "date-fns";

export const naira = (n: number) =>
  n === 0 ? "Free" : "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });

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
