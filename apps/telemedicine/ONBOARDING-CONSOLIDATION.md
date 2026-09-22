# Organization onboarding consolidation

The patient/telemedicine portal no longer owns a separate healthcare-organization application form.

- Patient, caregiver, and healthcare-professional signup remain in the patient portal.
- The **Healthcare Organisation** option hands users to the shared Sabi hospital onboarding.
- Legacy `/signup/organisation/:type` and `/signup/organization/:type` URLs perform the same handoff.
- Configure the destination with `VITE_HOSPITAL_ONBOARDING_URL`.
- The default destination is `/register/organization` for a unified-domain deployment.

The canonical hospital flow owns organization drafts, compliance requirements, verification, commercial review, tenant provisioning, and application status.
