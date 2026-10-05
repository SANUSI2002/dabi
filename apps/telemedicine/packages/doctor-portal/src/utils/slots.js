// Generates the fixed daily slot grid (08:00–18:00, 30-min increments)
// and cross-references it against that day's real appointments/blocks
// so "Available" / "Booked" / "Blocked" reflects actual store state.
export function buildDaySlots(appointmentsForDay) {
  const slots = [];
  for (let h = 8; h < 18; h++) {
    for (const m of [0, 30]) {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      const label = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const match = appointmentsForDay.find((a) => a.startTime === label);
      slots.push({
        time: label,
        status: match ? (match.type === "blocked" ? "blocked" : "booked") : "available",
        patientName: match?.patientName,
        apptId: match?.id,
      });
    }
  }
  return slots;
}

export function timeToMinutes(label) {
  const d = new Date(`2000-01-01 ${label}`);
  return d.getHours() * 60 + d.getMinutes();
}
