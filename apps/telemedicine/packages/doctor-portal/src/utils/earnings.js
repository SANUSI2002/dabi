import { toISO } from "./dateFormat.js";
const RATES = { virtual: 10000, physical: 20000 };
export function earningsRows(appointments) {
  return appointments.filter((a) => a.type !== "blocked" && a.status !== "needs-response").map((a) => {
    const fee = (RATES[a.type] || 0) + (a.bookingSource === "affiliate" ? 5000 : 0);
    const status = ["declined", "cancelled"].includes(a.status) ? "Refunded" : a.paymentStatus || (a.status === "past" ? "Paid" : "Payable");
    return { ...a, amount: status === "Refunded" ? -fee : fee, status, billingNote: a.bookingSource === "affiliate" ? "Hospital Managed" : "Direct Payout" };
  }).sort((a, b) => b.date.localeCompare(a.date));
}
export function earningsSummary(rows, today = new Date()) {
  const todayISO = toISO(today);
  const since = (days) => { const day = new Date(today); day.setDate(day.getDate() - days); return toISO(day); };
  const sum = (days) => rows.filter((r) => r.date >= since(days) && r.date <= todayISO && r.amount > 0).reduce((total, r) => total + r.amount, 0);
  return { thisWeek: sum(7), thisMonth: sum(30), pendingPayout: rows.filter((r) => r.status === "Payable").reduce((total, r) => total + r.amount, 0) };
}
