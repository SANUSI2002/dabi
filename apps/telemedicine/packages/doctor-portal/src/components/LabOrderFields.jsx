import React from "react";

export default function LabOrderFields({ orders, onChange }) {
  function update(index, patch) {
    onChange(orders.map((order, i) => i === index ? { ...order, ...patch } : order));
  }
  return <section className="dp-lab-orders">
    <div className="dp-modal-row"><h3>Lab orders</h3><button type="button" className="dp-btn dp-btn-outline dp-btn-sm" onClick={() => onChange([...orders, { test: "", instructions: "", urgency: "Routine" }])}>+ Lab Order</button></div>
    {orders.map((order, i) => <div className="dp-med-card" key={i}>
      <label className="dp-rx-field">Test requested<input value={order.test} onChange={(e) => update(i, { test: e.target.value })} placeholder="e.g. Full blood count" /></label>
      <label className="dp-rx-field">Priority<select value={order.urgency} onChange={(e) => update(i, { urgency: e.target.value })}><option>Routine</option><option>Urgent</option></select></label>
      <label className="dp-rx-field">Instructions / reason<textarea rows={2} value={order.instructions} onChange={(e) => update(i, { instructions: e.target.value })} placeholder="Clinical reason or preparation instructions" /></label>
      <button type="button" className="dp-text-btn dp-text-btn-danger" onClick={() => onChange(orders.filter((_, index) => index !== i))}>Remove lab order</button>
    </div>)}
  </section>;
}
