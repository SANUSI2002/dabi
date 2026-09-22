import React from "react";

export function ZoomControl() {
  return (
    <div 
      className="sabi-zoom-control" 
      role="group" 
      aria-label="Page zoom"
    >
      <button
        type="button"
        className="sabi-zoom-btn active"
        disabled
      >
        85%
      </button>
    </div>
  );
}

export default ZoomControl;