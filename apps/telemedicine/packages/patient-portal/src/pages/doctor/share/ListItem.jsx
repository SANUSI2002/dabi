import React from "react";

export function ListItem({ icon, title, sub, trailing, pill, showView, onView }) {
  return (
    <div className="sabi-list-item">
      <div className="sabi-list-icon">{icon}</div>
      <div className="sabi-list-body">
        <div className="sabi-list-title">{title}</div>
        <div className="sabi-list-sub">{sub}</div>
      </div>
      <div className="sabi-list-trailing">
        {showView && (
          <button className="sabi-view-pill" onClick={onView} type="button">
            view
          </button>
        )}
        {pill ? (
          <span className="sabi-pill">{trailing}</span>
        ) : (
          !showView && <span className="sabi-list-chevron">{trailing}</span>
        )}
        {showView && <span className="sabi-list-chevron">›</span>}
      </div>
    </div>
  );
}

export default ListItem;
