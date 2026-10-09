import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "design-system";
import { Pill, CheckCircle2 } from "lucide-react";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { clockLabel, dosesForDay, recordDose } from "../../../api/notificationsApi";

// Today's doses from the patient's medicine schedules: "take" until confirmed — here or
// with the Taken button on WhatsApp. Each day has its own dose records, so nothing carries over.
const toMed = (d) => ({
  id: d.id,
  name: d.medicine?.name,
  sub: d.status === "TAKEN" ? `${clockLabel(d.localTime)} · Taken${d.confirmedVia === "WHATSAPP" ? " on WhatsApp" : ""}`
    : d.status === "SKIPPED" ? `${clockLabel(d.localTime)} · Skipped`
    : [clockLabel(d.localTime), d.medicine?.instructions].filter(Boolean).join(" · "),
  state: d.status === "NOT_CONFIRMED" ? "take" : d.status === "TAKEN" ? "taken" : "skipped",
});
const loadMeds = async () => (await dosesForDay()).doses.map(toMed);


export function MedicationsCard() {
  const { data } = useApiData(loadMeds, []);
  const [meds, setMeds] = useState([]);
  useEffect(() => { if (data) setMeds(data); }, [data]);
  const remaining = meds.filter((m) => m.state === "take").length;

  const markTaken = async (i) => {
    try {
      const updated = toMed((await recordDose(meds[i].id, "TAKEN")).dose);
      setMeds((prev) => prev.map((m, idx) => (idx === i ? updated : m)));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Card className="sabi-med-card">
      {/* Header */}
      <SectionTitle action={`${remaining} remaining`}>
        Medications
      </SectionTitle>

      {/* List */}
      <div className="sabi-med-list">
        {data && !meds.length && <div className="sabi-med-sub">No medications added yet.</div>}
        {meds.map((m, i) =>
          m.state === "take" ? (
            <div className="sabi-med-featured" key={i}>
              <div className="sabi-med-featured-head">
                <div>
                  <div className="sabi-med-name">{m.name}</div>
                  <div className="sabi-med-sub">{m.sub}</div>
                </div>
                <div className="sabi-med-icon">
                  <Pill size={15} />
                </div>
              </div>
              <Button
                variant="primary"
                className="sabi-med-btn"
                onClick={() => markTaken(i)}
              >
                Mark as Taken
              </Button>
            </div>
          ) : (
            <div className="sabi-med-item" key={i}>
              <div>
                <div className="sabi-med-name">{m.name}</div>
                <div className="sabi-med-sub">{m.sub}</div>
              </div>
              {m.state === "taken" && (
                <span className="sabi-med-taken-icon" aria-label="Taken">
                  <CheckCircle2 size={18} />
                </span>
              )}
            </div>
          )
        )}
      </div>
      <Link className="sx-link" to="/medications">My Medicines</Link>
    </Card>
  );
}

export default MedicationsCard;