export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayISODate() {
  return toISO(new Date());
}

export function relativeDayLabel(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fullDateLabel(isoDate) {
  const target = new Date(`${isoDate}T00:00:00`);
  return target.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function monthYearLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
