import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveApplicationsPage from './LiveApplicationsPage';
import { liveAcceptUnscannedException, liveAddReviewNote, liveApprovalReadiness, liveApproveEmr, liveEvidencePreview, livePlatformApplicationDetail, livePlatformApplications, livePlatformEvidence, liveReviewEvidence, liveReviewNotes, liveStartApplicationReview, liveUnscannedEvidenceDownload } from '@/registration/livePlatform';

vi.mock('@/registration/livePlatform', () => ({ livePlatformApplications: vi.fn(), livePlatformApplicationDetail: vi.fn(), liveApprovalReadiness: vi.fn(), liveStartApplicationReview: vi.fn(), liveReviewNotes: vi.fn(), liveAddReviewNote: vi.fn(), livePlatformEvidence: vi.fn(), liveEvidencePreview: vi.fn(), liveUnscannedEvidenceDownload: vi.fn(), liveAcceptUnscannedException: vi.fn(), liveReviewEvidence: vi.fn(), liveApproveEmr: vi.fn(), liveResendEmrSetup: vi.fn() }));

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
beforeEach(() => { vi.mocked(livePlatformEvidence).mockResolvedValue({ data: { items: [], previewAvailable: false, unscannedExceptionAvailable: false } }); });

describe('live application review workbench', () => {
  it('loads server-owned details but does not expose approval or provisioning actions', async () => {
    vi.mocked(liveReviewNotes).mockResolvedValue({ data: { items: [] } });
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [summary], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValue({ data: detail } as never);
    vi.mocked(liveApprovalReadiness).mockResolvedValue({ data: { ready: false, requiredEvidence: ['OFFICER_LICENCE'], blockers: ['MISSING_DOCUMENT:OFFICER_LICENCE', 'SECURE_DOCUMENT_WORKFLOW_NOT_CONNECTED'] } });
    render(<LiveApplicationsPage canApprove/>);
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    expect((await screen.findAllByText('Test Hospital Limited')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Evidence may be present in private quarantine/)).toBeInTheDocument();
    expect(await screen.findByText(/2 approval requirements outstanding/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve for EMR' })).not.toBeInTheDocument();
    expect(livePlatformApplicationDetail).toHaveBeenCalledWith('app-1');
  });

  it('requires an explicit confirmation to begin review and updates the status from the server', async () => {
    vi.mocked(liveReviewNotes).mockResolvedValue({ data: { items: [] } });
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [summary], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValue({ data: detail } as never);
    vi.mocked(liveApprovalReadiness).mockResolvedValue({ data: { ready: false, requiredEvidence: [], blockers: ['SECURE_DOCUMENT_WORKFLOW_NOT_CONNECTED'] } });
    vi.mocked(liveStartApplicationReview).mockResolvedValue({ data: { ...detail, status: 'UNDER_REVIEW' } } as never);
    render(<LiveApplicationsPage canApprove/>);
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Begin review' }));
    expect(liveStartApplicationReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm start review' }));
    expect(await screen.findByText('UNDER_REVIEW')).toBeInTheDocument();
    expect(liveStartApplicationReview).toHaveBeenCalledWith('app-1');
    expect(screen.queryByRole('button', { name: 'Begin review' })).not.toBeInTheDocument();
  });

  it('records a reviewer observation without claiming evidence verification', async () => {
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [{ ...summary, status: 'UNDER_REVIEW' }], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValue({ data: { ...detail, status: 'UNDER_REVIEW' } } as never);
    vi.mocked(liveApprovalReadiness).mockResolvedValue({ data: { ready: false, requiredEvidence: ['OFFICER_LICENCE'], blockers: ['MISSING_DOCUMENT:OFFICER_LICENCE'] } });
    vi.mocked(liveReviewNotes).mockResolvedValue({ data: { items: [] } });
    vi.mocked(liveAddReviewNote).mockResolvedValue({ data: { id: 'note-1', reviewerId: 'reviewer-1', note: 'Licence details require an independent check.', createdAt: '2026-09-24T12:00:00Z' } });
    render(<LiveApplicationsPage canApprove/>);
    fireEvent.click(screen.getByRole('button', { name: 'UNDER REVIEW' }));
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    fireEvent.change(await screen.findByLabelText('Reviewer observation'), { target: { value: 'Licence details require an independent check.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Licence details require an independent check.')).toBeInTheDocument();
    expect(liveAddReviewNote).toHaveBeenCalledWith('app-1', 'Licence details require an independent check.');
    expect(screen.getByRole('button', { name: 'Approve for EMR' })).toBeDisabled();
  });

  it('requires confirmation after server readiness before approving an EMR tenant', async () => {
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [{ ...summary, status: 'UNDER_REVIEW' }], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValueOnce({ data: { ...detail, status: 'UNDER_REVIEW' } } as never)
      .mockResolvedValueOnce({ data: { ...detail, status: 'APPROVED', setupDeadlineAt: '2026-10-24T00:00:00Z', setupCompletedAt: null } } as never);
    vi.mocked(liveApprovalReadiness).mockResolvedValue({ data: { ready: true, requiredEvidence: ['OFFICER_LICENCE'], blockers: [] } });
    vi.mocked(liveReviewNotes).mockResolvedValue({ data: { items: [] } });
    vi.mocked(liveApproveEmr).mockResolvedValue({ data: { id: 'app-1', status: 'APPROVED', organizationId: 'org-1', setupDeadlineAt: '2026-10-24T00:00:00Z', emailSent: true } });
    render(<LiveApplicationsPage canApprove/>);
    fireEvent.click(screen.getByRole('button', { name: 'UNDER REVIEW' }));
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    await screen.findByText('All checks passed. Approval may now be confirmed.');
    fireEvent.click(screen.getByRole('button', { name: 'Approve for EMR' }));
    expect(liveApproveEmr).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm EMR approval' }));
    expect(await screen.findByText(/A one-time EMR account setup link was emailed/)).toBeInTheDocument();
    expect(liveApproveEmr).toHaveBeenCalledWith('app-1');
  });

  it('exposes clean-file preview and an audited authenticity decision only when enabled', async () => {
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [{ ...summary, status: 'UNDER_REVIEW' }], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValue({ data: { ...detail, status: 'UNDER_REVIEW' } } as never);
    vi.mocked(liveApprovalReadiness).mockResolvedValue({ data: { ready: false, requiredEvidence: [], blockers: ['SECURE_DOCUMENT_WORKFLOW_NOT_CONNECTED'] } });
    vi.mocked(liveReviewNotes).mockResolvedValue({ data: { items: [] } });
    vi.mocked(livePlatformEvidence).mockResolvedValue({ data: { previewAvailable: true, unscannedExceptionAvailable: false, items: [{ id: 'evidence-1', requirementKey: 'OFFICER_LICENCE', fileName: 'officer_licence.pdf', contentType: 'application/pdf', sizeBytes: 1024, sha256: 'a'.repeat(64), scanStatus: 'CLEAN', reviewStatus: 'PENDING', createdAt: '2026-09-24T00:00:00Z' }] } });
    vi.mocked(liveEvidencePreview).mockResolvedValue({ data: { url: 'https://project.supabase.co/storage/v1/object/sign/evidence', expiresInSeconds: 60 } });
    vi.mocked(liveReviewEvidence).mockResolvedValue({ data: { id: 'evidence-1', reviewStatus: 'VERIFIED', reviewedAt: '2026-09-24T12:00:00Z' } });
    render(<LiveApplicationsPage canApprove/>);
    fireEvent.click(screen.getByRole('button', { name: 'UNDER REVIEW' }));
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Request 60-second private preview/ }));
    expect(await screen.findByRole('link', { name: 'Open private preview' })).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(screen.getByRole('button', { name: 'Record authenticity check' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Registry or verification source' }), { target: { value: 'Test regulator register' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Registry reference' }), { target: { value: 'REG-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark authentic' }));
    expect(await screen.findByText(/Review: VERIFIED/)).toBeInTheDocument();
    expect(liveReviewEvidence).toHaveBeenCalledWith('app-1', 'evidence-1', { decision: 'VERIFIED', sourceName: 'Test regulator register', reference: 'REG-123', note: '' });
  });

  it('shows a separate unscanned risk acknowledgement before authenticity review', async () => {
    vi.mocked(livePlatformApplications).mockResolvedValue({ data: { items: [{ ...summary, status: 'UNDER_REVIEW' }], nextPage: null } });
    vi.mocked(livePlatformApplicationDetail).mockResolvedValue({ data: { ...detail, status: 'UNDER_REVIEW' } } as never);
    vi.mocked(liveApprovalReadiness).mockResolvedValue({ data: { ready: false, requiredEvidence: ['OFFICER_LICENCE'], blockers: ['DOCUMENT_NOT_SCANNED:OFFICER_LICENCE'] } });
    vi.mocked(liveReviewNotes).mockResolvedValue({ data: { items: [] } });
    vi.mocked(livePlatformEvidence).mockResolvedValue({ data: { previewAvailable: false, unscannedExceptionAvailable: true, items: [{ id: 'evidence-1', requirementKey: 'OFFICER_LICENCE', fileName: 'officer_licence.pdf', contentType: 'application/pdf', sizeBytes: 1024, sha256: 'a'.repeat(64), scanStatus: 'PENDING', reviewStatus: 'PENDING', createdAt: '2026-09-24T00:00:00Z' }] } });
    vi.mocked(liveUnscannedEvidenceDownload).mockResolvedValue({ data: { url: 'https://project.supabase.co/storage/v1/object/sign/evidence?download=1', sha256: 'a'.repeat(64), expiresInSeconds: 60, warning: 'UNSCANNED_FILE' } });
    vi.mocked(liveAcceptUnscannedException).mockResolvedValue({ data: { id: 'evidence-1', scanStatus: 'UNSCANNED_EXCEPTION', unscannedExceptionAt: '2026-09-24T12:00:00Z' } });
    render(<LiveApplicationsPage canApprove/>);
    fireEvent.click(screen.getByRole('button', { name: 'UNDER REVIEW' }));
    fireEvent.click(await screen.findByRole('button', { name: /SABI-APP-TEST/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Request 60-second unscanned download' }));
    expect(await screen.findByRole('link', { name: 'Download unscanned file' })).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.change(screen.getByRole('textbox', { name: 'Unscanned exception reason' }), { target: { value: 'Verified file checksum on an isolated review workstation.' } });
    fireEvent.click(screen.getByRole('button', { name: 'I accept the unscanned risk for this file' }));
    expect(await screen.findByText('OFFICER LICENCE · UNSCANNED EXCEPTION')).toBeInTheDocument();
    expect(liveAcceptUnscannedException).toHaveBeenCalledWith('app-1', 'evidence-1', 'a'.repeat(64), 'Verified file checksum on an isolated review workstation.');
    expect(screen.queryByRole('button', { name: 'Approve for EMR' })).toBeDisabled();
  });
});
