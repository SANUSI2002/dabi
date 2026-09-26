import React from "react";
import { SectionCard, TextField } from "../shared";
export function PersonalInformationCard({ form, set, account }) {
  return (
    <SectionCard icon="👤" title="Personal Information">
      <div className="sabi-field-grid">
        <TextField label="Full Name" value={form.fullName} onChange={(v) => set("fullName", v)} />
        <TextField label="Email" value={account.email} type="email" readOnly />
        <TextField label="Phone Number" value={form.phone} onChange={(v) => set("phone", v)} type="tel" />
        <TextField label="DOB" value={form.dob} onChange={(v) => set("dob", v)} type="date" />
      </div>
    </SectionCard>
  );
}

export default PersonalInformationCard;
