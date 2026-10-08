import React from 'react';
import { authorizedRequest } from '../../utils/sabiIdentity';
import { PageShell } from '../hospitals/hospitalShared';
import ActivityLog from '../../../../shared-portal/activity/ActivityLog.jsx';

// Module-level so the log does not reload on every render.
const loadActivity = ({ category, cursor }) => authorizedRequest('/api/v1/audit/mine', { query: { ...(category ? { category } : {}), ...(cursor ? { cursor } : {}) } }).then((r) => r.data);

/** The patient's Activity log: sign-ins, who accessed their record, permissions and their own activity. */
export function ActivityLogPage() {
  return <PageShell mainClassName="sabi-main"><div className="sx-page"><ActivityLog load={loadActivity} audience="patient" /></div></PageShell>;
}

export default ActivityLogPage;
