import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LiveApplicationsPage from './LiveApplicationsPage';
import { livePlatformApplicationDetail, livePlatformApplications } from '@/registration/livePlatform';

vi.mock('@/registration/livePlatform', () => ({ livePlatformApplications: vi.fn(), livePlatformApplicationDetail: vi.fn() }));

const summary = { id: 'app-1', reference: 'SABI-APP-TEST', organizationName: 'Test Hospital', status: 'SUBMITTED', createdAt: '2026-09-24T00:00:00Z', submittedAt: '2026-09-24T00:00:00Z', packageId: 'package-1', packageVersionId: 'version-1' };
const detail = {
  ...summary, emailVerifiedAt: '2026-09-24T00:00:00Z', billingCycle: 'Monthly',
  details: {
    owner: { firstName: 'Ada', lastName: 'Tester', workEmail: 'ada@example.com', phone: '+2348000000000' },
    organization: { legalName: 'Test Hospital Limited', tradingName: 'Test Hospital', facilityType: 'Private Hospital', ownershipType: 'Private', city: 'Lagos', state: 'Lagos', country: 'Nigeria', address: 'Test Street', officialEmail: 'test@example.com', officialPhone: '+2348000000001' },
    corporate: { registrationNumber: 'RC-TEST', registeredLegalName: 'Test Hospital Limited' },
    regulatoryRegistration: { regulatorId: 'regulator', registrationNumber: 'LIC-TEST', expiryDate: '2027-01-01' },
    operatingOfficer: { fullName: 'Dr Tester', role: 'Director', regulatorId: 'professional', registrationNumber: 'REG-TEST', practisingLicenceNumber: 'PRACTICE-TEST', licenceExpiryDate: '2027-01-01' },
    facility: { facilities: 1, beds: 10 }, selectedProducts: ['emr'],
  },
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('live application review workbench', () => {
  it('loads server-owned details but does not expose approval or provisioning actions', async () => {
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [summary], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValue({ data: detail } as never);
    render(<LiveApplicationsPage/>);
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    expect((await screen.findAllByText('Test Hospital Limited')).length).toBeGreaterThan(0);
    expect(screen.getByText(/No compliance evidence has been securely uploaded/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|provision/i })).not.toBeInTheDocument();
    expect(livePlatformApplicationDetail).toHaveBeenCalledWith('app-1');
  });
});
