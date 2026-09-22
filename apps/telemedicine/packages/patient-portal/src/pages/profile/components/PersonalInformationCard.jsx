import React from "react";
import { SectionCard, TextField } from "../shared";
import { PERSONAL_INFO } from "../data";

export function PersonalInformationCard() {
  return (
    <SectionCard icon="👤" title="Personal Information">
      <div className="sabi-field-grid">
        <TextField label="Full Name" defaultValue={PERSONAL_INFO.fullName} />
        <TextField label="Email" defaultValue={PERSONAL_INFO.email} type="email" />
        <TextField label="Phone Number" defaultValue={PERSONAL_INFO.phone} type="tel" />
        <TextField label="DOB" defaultValue={PERSONAL_INFO.dob} />
      </div>
    </SectionCard>
  );
}

export default PersonalInformationCard;
