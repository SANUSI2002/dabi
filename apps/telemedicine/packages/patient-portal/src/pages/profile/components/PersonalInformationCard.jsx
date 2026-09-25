import React from "react";
import { SectionCard, TextField } from "../shared";

export function PersonalInformationCard({ form, set, errors, account }) {
  return (
    <SectionCard icon="👤" title="Personal Information">
      <div className="sabi-field-grid">
        <TextField label="Full Name" value={form.fullName} onChange={(v) => set("fullName", v)} error={errors.fullName} autoComplete="name" maxLength={120} />
        <TextField label="Email" value={account.email} type="email" readOnly hint="Your sign-in email. Contact Sabi support to change it." />
        <TextField label="Phone Number" value={form.phone} onChange={(v) => set("phone", v)} type="tel" error={errors.phone} autoComplete="tel" maxLength={30} />
        <TextField
          label="Date of Birth"
          value={form.dob}
          onChange={(v) => set("dob", v)}
          type="date"
          error={errors.dob}
          max={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </SectionCard>
  );
}

export default PersonalInformationCard;
