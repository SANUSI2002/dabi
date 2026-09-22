import React, { useState } from "react";
import { Button } from "design-system";
import { X } from "lucide-react";
import { BOOKING_DOCTORS } from "../data";
import Calendar from "./AppointmentCalendar.jsx"; // adjust path



export function BookAppointmentModal({ onClose, onBook }) {
  const [doctorId, setDoctorId] = useState(BOOKING_DOCTORS[0].id);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Prevent selecting past dates
  const today = new Date().toISOString().split("T")[0];


  const isPastTime = () => {
    if (!date || !time) return false;

    const selectedDateTime = new Date(
      `${date}T${time}`
    );

    const now = new Date();

    return selectedDateTime < now;
  };


  const submit = (e) => {
    e.preventDefault();


    if (!date || !time) {
      alert("Please select appointment date and time");
      return;
    }


    if (isPastTime()) {
      alert("You cannot book an appointment in the past");
      return;
    }


    const doctor = BOOKING_DOCTORS.find(
      (d) => d.id === doctorId
    );


    onBook({
      doctor,
      date,
      time,
    });
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

              {BOOKING_DOCTORS.map((d)=>(
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

            <input
              type="time"
              value={time}
              onChange={(e)=>setTime(e.target.value)}
            />

          </label>




          <div className="sabi-modal-actions">

            <Button
              type="submit"
              variant="primary"
            >
              Confirm Booking
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