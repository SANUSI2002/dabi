import React from "react";

export function MiniWave() {
  return (
    <svg width="100%" height="20" viewBox="0 0 120 20" preserveAspectRatio="none">
      <polyline
        points="0,12 10,12 16,4 22,18 28,10 34,12 44,12 50,6 56,16 62,12 72,12 78,4 84,18 90,10 96,12 120,12"
        fill="none"
        stroke="var(--sabi-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default MiniWave;
