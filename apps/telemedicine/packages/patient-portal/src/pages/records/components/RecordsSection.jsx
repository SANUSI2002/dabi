import React, { useState } from "react";
import { RECORD_TYPES } from "../../../api/recordsApi";
import { RecordEntry } from "./RecordEntry";
import { RecordViewModal } from "./RecordViewModal";

const PAGE = 8;

/** Timeline of every record, newest first, with a type filter. */
export function RecordsSection({ records, documents }) {
  const [type, setType] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [viewingId, setViewingId] = useState(null);

  const filtered = type ? records.filter((r) => r.recordType === type) : records;
  const viewing = records.find((r) => r.id === viewingId) || null;

  return (
    <section>
      <div className="sabi-section-title sabi-records-title">
        Records
        <label className="sabi-records-filter">
          <span className="sr-only">Filter records by type</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setShown(PAGE);
            }}
          >
            <option value="">All types</option>
            {RECORD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="sabi-card sabi-live-state">
          <h3>{records.length ? "No records of this type" : "No records yet"}</h3>
          <p>
            {records.length
              ? "Try another filter to see the rest of your history."
              : "Add past visits, test results or vaccinations with “Add Record”, or upload a document below."}
          </p>
        </div>
      ) : (
        <div className="sabi-record-list">
          {filtered.slice(0, shown).map((record) => (
            <RecordEntry
              key={record.id}
              record={record}
              attachments={(documents.data || []).filter((d) => d.medicalRecordId === record.id).length}
              onView={() => setViewingId(record.id)}
            />
          ))}
        </div>
      )}
      {filtered.length > shown && (
        <button type="button" className="sabi-records-more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, filtered.length - shown)} more
        </button>
      )}

      {viewing && <RecordViewModal record={viewing} documents={documents} onClose={() => setViewingId(null)} />}
    </section>
  );
}

export default RecordsSection;
