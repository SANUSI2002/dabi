import React from "react";
import { CheckCircle2 } from "lucide-react";

export function PharmacyHeader({ prescription }) {
  return <header className="sabi-market-header"><div><h1>Select a Pharmacy</h1><p>Prescription for <strong>{prescription}</strong></p></div><span className="sabi-market-secure"><CheckCircle2 size={16} /> Verified pharmacy partners</span></header>;
}
