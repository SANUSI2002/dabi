import React from 'react';
import AiWorkspace from '../../../../shared-portal/ai/AiWorkspace.jsx';
import { authorizedRequest, getCurrentUser } from '../../utils/sabiIdentity';
import { uploadDocument } from '../../api/recordsApi';
const upload = (file) => uploadDocument(file, { kind: 'MEDICAL_RECORD' });
export default function SabiAiPage() {
  const user = getCurrentUser();
  return <AiWorkspace request={authorizedRequest} uploadDocument={upload} accountName={user?.fullName || user?.email || 'Your Sabi account'} homeHref={`${import.meta.env.BASE_URL}dashboard`} />;
}
