import React from "react";
import { CheckCircle2, Send, Star, TriangleAlert } from "lucide-react";

function PharmacyCard({ pharmacy, selected, onSelect }) {
  const available = pharmacy.availability === "available";
  return <article className={`sabi-market-pharmacy sabi-card ${selected ? "selected" : ""}`}><div className="sabi-market-pharmacy-head"><div><h2>{pharmacy.name}</h2><div className="sabi-market-rating"><Star size={18} fill="currentColor" /> {pharmacy.rating}<span /> {pharmacy.distance}</div></div><span className={`sabi-market-hours ${pharmacy.status.includes("24") ? "open" : ""}`}>{pharmacy.status}</span></div><div className={`sabi-market-stock ${available ? "available" : "limited"}`}>{available ? <CheckCircle2 size={20} /> : <TriangleAlert size={20} />}<span>{available ? "Lisinopril 10mg available" : "Limited stock: Lisinopril 10mg"}</span></div><button type="button" className="sabi-market-send" onClick={() => onSelect(pharmacy)}>{selected ? "Prescription Selected" : "Send Prescription"}<Send size={18} /></button></article>;
}

export function PharmacyList({ pharmacies, selectedId, onSelect }) {
  return <section className="sabi-market-list">{pharmacies.map((pharmacy) => <PharmacyCard key={pharmacy.id} pharmacy={pharmacy} selected={pharmacy.id === selectedId} onSelect={onSelect} />)}</section>;
}
