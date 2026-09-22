import React from "react";

export function MiniBars({ heights = [8, 14, 10, 18, 12, 16, 9] }) {
  return (
    <div className="sabi-mini-bars">
      {heights.map((h, i) => (
        <i key={i} style={{ height: h }} />
      ))}
    </div>
  );
}

export default MiniBars;
