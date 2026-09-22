import React from "react";
import { FileBadge2 } from "lucide-react";
import { ComingSoonPage } from "../coming-soon/ComingSoonPage";

export function InsurancePage() {
  return (
    <ComingSoonPage
      icon={FileBadge2}
      eyebrow="Coming Soon"
      title="Insurance is coming to Sabi Health"
      description="Soon you'll be able to link your insurance provider, check plan coverage before a visit, and submit claims directly from the app."
      bullets={[
        "Link your NHIS or private insurance plan",
        "See which pharmacies and hospitals accept your cover",
        "Track claims and reimbursements in one place",
      ]}
    />
  );
}

export default InsurancePage;
