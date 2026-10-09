import { authorizedRequest } from '../utils/sabiIdentity';
const data = async (call) => (await call).data;
const path = '/api/v1/profile/emergency-card';
export const getEmergencyCard = () => data(authorizedRequest(path));
export const saveEmergencyCard = (body) => data(authorizedRequest(path, { method: 'PUT', body }));
export const replaceEmergencyCode = (version) => data(authorizedRequest(`${path}/replace-code`, { method: 'POST', body: { version, confirmation: 'REPLACE' } }));
export const getEmergencyResponder = () => data(authorizedRequest(`${path}/responder`));
export const lookupEmergencySummary = (body, signal) => data(authorizedRequest(`${path}/lookup`, { method: 'POST', body, signal }));
