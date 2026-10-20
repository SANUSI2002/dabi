import React from 'react';
import { Link } from 'react-router-dom';
import AiWorkspace from '../../../../shared-portal/ai/AiWorkspace.jsx';
import { authorizedRequest, getCurrentUser } from '../../utils/sabiIdentity';
import { uploadDocument } from '../../api/recordsApi';
import { Sidebar, Topbar } from '../dashboard/components';
import { pageVars } from '../../pageVars';
import { useZoom } from '../../hooks/useZoom';
import './patient-ai.css';
const upload = (file) => uploadDocument(file, { kind: 'MEDICAL_RECORD' });
export default function SabiAiPage() {
  const user = getCurrentUser();
  const [fontScale] = useZoom();
  return <div className="sabi-dashboard sabi-patient-ai" style={{ ...pageVars, '--sabi-font-scale': fontScale }}>
    <Sidebar />
    <div className="sabi-main">
      <Topbar />
      {user?.emailVerifiedAt === null && user?.roles?.includes('PATIENT') && <aside className="sabi-patient-ai-verification" aria-label="Email verification">
        <p><strong>Confirm your email to use Sabi AI.</strong> Your account is signed in, but your email address has not been verified yet.</p>
        <Link to="/verify-email" state={{ email: user.email }}>Request a verification link</Link>
      </aside>}
      <div className="sabi-patient-ai-frame">
        <AiWorkspace key={user?.id || 'signed-out'} request={authorizedRequest} uploadDocument={upload}
          accountName={user?.fullName || user?.email || 'Your Sabi account'}
          homeHref={`${import.meta.env.BASE_URL}dashboard`} embedded />
      </div>
    </div>
  </div>;
}
