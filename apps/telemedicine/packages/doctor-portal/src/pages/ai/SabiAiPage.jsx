import React from 'react';
import AiWorkspace from '../../../../shared-portal/ai/AiWorkspace.jsx';
import { doctorRequest } from '../../services/doctorAuth';
import { getCurrentDoctor } from '../../store/doctorSession';
const request = (path, options = {}) => doctorRequest(path.replace(/^\/api\/v1/, ''), { ...options, cache: 'no-store', body: options.body === undefined ? undefined : JSON.stringify(options.body) });
export default function SabiAiPage() {
  const doctor = getCurrentDoctor();
  return <AiWorkspace request={request} accountName={doctor?.name || 'Professional workspace'} homeHref={`${import.meta.env.BASE_URL}dashboard`} />;
}
