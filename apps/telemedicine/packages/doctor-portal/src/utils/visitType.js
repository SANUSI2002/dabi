// Visit type is only ever "virtual" or "physical" — a hospital visit is
// still a physical visit, just one assigned by an affiliated hospital
// rather than booked directly by the patient. `bookingSource` carries
// that distinction separately so it can be shown as its own badge.
export function visitTypeLabel(appt) {
  return appt.type === "virtual" ? "Virtual" : "Physical";
}

export function bookingSourceLabel(appt) {
  if (appt.type !== "physical") return null;
  if (appt.bookingSource === "affiliate") {
    return appt.hospitalName ? `Affiliate: ${appt.hospitalName}` : "Affiliate hospital";
  }
  return "Direct booking";
}
