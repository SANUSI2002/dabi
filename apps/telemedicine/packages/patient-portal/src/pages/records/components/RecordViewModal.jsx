import React from "react";
import { Modal } from "./Modal";
import { DocumentList, DocumentUpload } from "./DocumentsCard";

/** Full record, plus the documents attached to it. `documents` is the page's documents loader. */
export function RecordViewModal({ record, documents, onClose }) {
  if (!record) return null;
  const attached = (documents?.data || []).filter((d) => d.medicalRecordId === record.id);

  return (
    <Modal title={record.title} onClose={onClose} wide>
      <div className="sabi-record-view">
        <div className="sabi-record-view-row">
          <span>Date</span>
          <strong>{record.date}</strong>
        </div>
        <div className="sabi-record-view-row">
          <span>Type</span>
          <strong>{record.typeLabel}</strong>
        </div>
        {record.facility && (
          <div className="sabi-record-view-row">
            <span>Facility</span>
            <strong>{record.facility}</strong>
          </div>
        )}
        {record.doctorName && (
          <div className="sabi-record-view-row">
            <span>Doctor</span>
            <strong>{record.doctorName}</strong>
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

        {documents && (
          <div className="sabi-record-view-block">
            <span>Attached documents</span>
            <DocumentList documents={attached} onChanged={documents.reload} emptyText="No documents attached to this record." />
            <DocumentUpload medicalRecordId={record.id} onUploaded={documents.reload} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default RecordViewModal;
