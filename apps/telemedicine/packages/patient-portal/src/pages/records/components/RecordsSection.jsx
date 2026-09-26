import React from "react";
import { Filter } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { RecordEntry } from "./RecordEntry";

export function RecordsSection({ records }) {
  return (
    <section>
      <SectionTitle
        action={
          <>
            Filter View <Filter size={14} style={{ verticalAlign: "-2px" }} />
          </>
        }
      >
        Records
      </SectionTitle>
      <div className="sabi-record-list">
        {records.map((record) => (
          <RecordEntry key={record.id} record={record} />
        ))}
      </div>
    </section>
  );
}

export default RecordsSection;
