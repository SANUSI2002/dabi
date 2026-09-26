import React, { useEffect, useState } from "react";
import { Card, Button } from "design-system";
import { Pill, CheckCircle2 } from "lucide-react";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { formatClock, listMedications, setMedicationTaken } from "../../../api/dashboardApi";

// The patient's daily medication list: "take" until marked as taken today.
const toMed = (m) => ({
  id: m.id,
  name: m.name,
  sub: m.isTaken ? `${formatClock(m.time)} · Taken` : m.instructions || formatClock(m.time),
  state: m.isTaken ? "taken" : "take",
});
const loadMeds = async () => (await listMedications()).map(toMed);


export function MedicationsCard() {
  const { data } = useApiData(loadMeds, []);
  const [meds, setMeds] = useState([]);
  useEffect(() => { if (data) setMeds(data); }, [data]);
  const remaining = meds.filter((m) => m.state === "take").length;

  const markTaken = async (i) => {
    try {
      const updated = toMed(await setMedicationTaken(meds[i].id, true));
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
              <span className="sabi-med-taken-icon" aria-label="Taken">
                <CheckCircle2 size={18} />
              </span>
            </div>
          )
        )}
      </div>
    </Card>
  );
}

export default MedicationsCard;