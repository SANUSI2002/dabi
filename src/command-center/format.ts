export const formatMoney = (amount: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

export const formatDate = (date?: string) => date
  ? new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date))
  : "—";

export const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - new Date("2026-09-14").getTime()) / 86_400_000);
