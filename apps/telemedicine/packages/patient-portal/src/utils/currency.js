export function formatNaira(amount) {
  const value = Number(amount) || 0;
  // Whole naira stay whole; amounts with kobo (e.g. distance-priced delivery) show them exactly.
  const whole = Number.isInteger(value);
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}
