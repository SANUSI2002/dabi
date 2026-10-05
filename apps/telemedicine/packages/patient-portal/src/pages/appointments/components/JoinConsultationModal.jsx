import React from "react";
import DailyConsultation from '../../../../../shared-video/DailyConsultation';
import { videoConfig, joinVideoSession, checkVideoSession } from '../../../api/doctorsApi';

export function JoinConsultationModal({ appointment, onClose }) {
  return <DailyConsultation key={appointment.id} appointmentId={appointment.id} title={`Consultation with ${appointment.doctor}`}
    getConfig={videoConfig} joinSession={joinVideoSession} checkSession={checkVideoSession} onClose={onClose} />;
}

export default JoinConsultationModal;
