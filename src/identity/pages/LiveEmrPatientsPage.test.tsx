import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveEmrPatientsPage from './LiveEmrPatientsPage';
import { liveApiRequest, liveSelectEmrOrganization, restoreLiveIdentity } from '../liveIdentity';

vi.mock('../liveIdentity', () => ({
  liveApiRequest: vi.fn(), liveSelectEmrOrganization: vi.fn(), restoreLiveIdentity: vi.fn(),
}));
const org = '11111111-1111-4111-8111-111111111111';
const access = { organizationId: org, facilityId: 'facility-1', organizationName: 'Synthetic Hospital', roles: ['HOSPITAL_ADMIN'], permissions: ['patient.read', 'patient.register'], clinicalApiConnected: false, patientRegistryEnabled: false };
const show = () => render(<MemoryRouter initialEntries={[`/emr/workspace/${org}/patients`]}><Routes><Route path="/emr/workspace/:organizationId/patients" element={<LiveEmrPatientsPage/>}/></Routes></MemoryRouter>);

beforeEach(() => {
  vi.mocked(restoreLiveIdentity).mockResolvedValue({ user: { id: 'user-1', email: 'synthetic@example.test', roles: [] }, organizations: [], platformAssigned: false, platform: null });
  vi.mocked(liveApiRequest).mockResolvedValue({ data: { items: [], nextPage: null } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('live EMR patient registry', () => {
  it('does not query patients when the server feature gate is closed', async () => {
    vi.mocked(liveSelectEmrOrganization).mockResolvedValue(access);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('not enabled');
    expect(liveApiRequest).not.toHaveBeenCalled();
  });

  it('queries only the selected tenant when server access is granted', async () => {
    vi.mocked(liveSelectEmrOrganization).mockResolvedValue({ ...access, patientRegistryEnabled: true });
    show();
    expect(await screen.findByText('No patients found for this organization.')).toBeInTheDocument();
    expect(liveApiRequest).toHaveBeenCalledWith(`/api/v1/emr/organizations/${org}/patients?page=1&q=`);
    expect(screen.getByText(/Synthetic patient details only/i)).toBeInTheDocument();
  });
});
