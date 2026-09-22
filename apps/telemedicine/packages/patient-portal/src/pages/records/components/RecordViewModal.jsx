import React from "react";
import { Modal } from "./Modal";

export function RecordViewModal({ record, onClose }) {
  if (!record) return null;
  const TagIcon = record.tagIcon;

  return (
    <Modal title={record.title} onClose={onClose}>
      <div className="sabi-record-view">
        <div className="sabi-record-view-row">
          <span>Date</span>
          <strong>{record.date}</strong>
        </div>
        {record.meta && (
          <div className="sabi-record-view-row">
            <span>Details</span>
            <strong>{record.meta}</strong>
          </div>
        )}
        {record.tag && (
          <div className="sabi-record-view-row">
            <span>Category Tag</span>
            <strong>{TagIcon && <TagIcon size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />}{record.tag}</strong>
          </div>
        )}
        {record.diagnosis && (
          <div className="sabi-record-view-block">
            <span>Diagnosis</span>
            <p>{record.diagnosis}</p>
          </div>
        )}
        {record.treatment && (
          <div className="sabi-record-view-block">
            <span>Treatment</span>
            <p>{record.treatment}</p>
          </div>
        )}
        {record.notes && (
          <div className="sabi-record-view-block">
            <span>Notes</span>
            <p>{record.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default RecordViewModal;
