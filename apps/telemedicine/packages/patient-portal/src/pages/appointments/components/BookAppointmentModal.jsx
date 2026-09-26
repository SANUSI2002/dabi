import React, { useEffect, useState } from "react";
import { Button } from "design-system";
import { X } from "lucide-react";
import { listDoctorSlots, listUiDoctors } from "../../../api/doctorsApi";

const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function BookAppointmentModal({ onClose, onBook }) {
  // Verified doctors with published open times.
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(""); // selected slot id
  const [daySlots, setDaySlots] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Prevent selecting past dates
  const today = localKey(new Date());

  useEffect(() => {
    listUiDoctors().then((items) => {
      const bookable = items.filter((d) => d.nextAvailableAt);
      setDoctors(bookable);
      if (bookable[0]) setDoctorId(bookable[0].id);
    }, () => setDoctors([]));
  }, []);

  // The doctor's open times on the chosen date.
  useEffect(() => {
    setTime("");
    setDaySlots(null);
    if (!doctorId || !date) return undefined;
    let live = true;
    listDoctorSlots(doctorId, new Date(`${date}T00:00:00`)).then(
      (items) => { if (live) setDaySlots(items.filter((slot) => localKey(new Date(slot.startsAt)) === date)); },
      () => { if (live) setDaySlots([]); },
    );
    return () => { live = false; };
  }, [doctorId, date]);

  const submit = async (e) => {
    e.preventDefault();

    if (!date || !time) {
      alert("Please select appointment date and time");
      return;
    }

    const slot = (daySlots || []).find((s) => s.id === time);
    setSubmitting(true);
    try {
      await onBook({ slotId: slot.id, consultationType: slot.consultationTypes[0] });
    } catch (err) {
      alert(err.code === "SLOT_UNAVAILABLE" ? "That time was just taken. Please choose another." : err.message);
      setSubmitting(false);
    }
  };


  return (
    <div
      className="sabi-modal-overlay"
      onClick={onClose}
    >

      <div
        className="sabi-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Book appointment"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="sabi-modal-head">

          <h3>
            Book Appointment
          </h3>


          <button
            type="button"
            className="sabi-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>

        </div>


        <form
          className="sabi-cat-form"
          onSubmit={submit}
        >


          <label>
            Doctor

            <select
              value={doctorId}
              onChange={(e)=>setDoctorId(e.target.value)}
            >

              {!doctors.length && <option value="">No doctors have open times yet</option>}
              {doctors.map((d)=>(
                <option
                  key={d.id}
                  value={d.id}
                >
                  {d.name} — {d.specialty}
                </option>
              ))}

            </select>

          </label>



          <label>
            Preferred date

            <input
              type="date"
              value={date}
              min={today}
              onChange={(e)=>setDate(e.target.value)}
            />

          </label>




          <label>
            Preferred time

            <select
              value={time}
              onChange={(e)=>setTime(e.target.value)}
              disabled={!date || !daySlots || !daySlots.length}
            >
              <option value="">
                {!date ? "Pick a date first" : !daySlots ? "Loading open times…" : daySlots.length ? "Choose an open time" : "No open times that day"}
              </option>
              {(daySlots || []).map((slot)=>(
                <option key={slot.id} value={slot.id}>
                  {new Date(slot.startsAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </option>
              ))}
            </select>

          </label>




          <div className="sabi-modal-actions">

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Confirm Booking"}
            </Button>


            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>

          </div>


        </form>


      </div>

    </div>
  );
}


export default BookAppointmentModal;