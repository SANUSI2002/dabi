import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentLibrary from '../../apps/telemedicine/packages/patient-portal/src/pages/records/components/DocumentLibrary';
import * as api from '../../apps/telemedicine/packages/patient-portal/src/api/recordsApi';
vi.mock('../../apps/telemedicine/packages/patient-portal/src/api/recordsApi', () => ({
  DOCUMENT_KINDS: [{ value: 'MEDICAL_RECORD', label: 'Medical record' }, { value: 'LAB_RESULT', label: 'Lab report' }],
  documentConfig: vi.fn(), documentPage: vi.fn(), documentRecipients: vi.fn(), documentShares: vi.fn(), documentDownloadUrl: vi.fn(), uploadDocument: vi.fn(), shareDocument: vi.fn(), revokeDocumentShare: vi.fn(), retryDocumentScan: vi.fn(), deleteDocument: vi.fn(),
  toDocument: (d) => ({ ...d, filename: d.originalFilename, kindLabel: 'Lab report', statusLabel: d.status === 'CLEAN' ? 'Available' : 'Security scan in progress', tone: d.status === 'CLEAN' ? 'good' : 'pending', downloadable: d.status === 'CLEAN', contentType: 'application/pdf' }),
}));
const doc = { id: 'doc-1', originalFilename: 'Synthetic report.pdf', status: 'CLEAN', byteSize: 200, kind: 'LAB_RESULT', createdAt: '2026-10-12T10:00:00Z', scanAttempts: 0 };
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  api.documentConfig.mockResolvedValue({ enabled: true, maxBytes: 3500000, privacy: 'Stored privately. Cloudmersive processes security checks.' });
  api.documentPage.mockResolvedValue({ items: [], total: 0 });
  api.documentRecipients.mockResolvedValue({ items: [{ id: 'doctor-1', name: 'Synthetic Doctor', type: 'DOCTOR' }] });
  api.documentShares.mockResolvedValue({ items: [] });
  api.uploadDocument.mockResolvedValue({ ...doc, status: 'PENDING_SCAN' });
  api.documentDownloadUrl.mockResolvedValue('https://synthetic.supabase.co/storage/v1/object/sign/doc?token=synthetic');
});
describe('Patient medical documents', () => {
  it('automatically uploads on file selection and confirms receipt without a second upload button', async () => {
    render(<DocumentLibrary />);
    const input = await screen.findByLabelText('Choose a medical document');
    await waitFor(() => expect(input).not.toBeDisabled());
    const file = new File(['%PDF-synthetic'], 'synthetic.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(/received. Security screening/)).toBeVisible();
    expect(api.uploadDocument).toHaveBeenCalledOnce();
    expect(api.uploadDocument).toHaveBeenCalledWith(file, { kind: 'MEDICAL_RECORD' });
    expect(screen.queryByRole('button', { name: /Upload privately/ })).not.toBeInTheDocument();
  });
  it('keeps blocked and pending files out of preview and sharing', async () => {
    api.documentPage.mockResolvedValue({ items: [{ ...doc, status: 'PENDING_SCAN', scanAttempts: 5, scanErrorCode: 'CLOUDMERSIVE_UNAVAILABLE' }], total: 1 });
    render(<DocumentLibrary />);
    expect(await screen.findByText('Security check delayed')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry security check' }));
    await waitFor(() => expect(api.retryDocumentScan).toHaveBeenCalledWith('doc-1'));
  });
  it('previews only short-lived private Supabase links', async () => {
    api.documentPage.mockResolvedValue({ items: [doc], total: 1 });
    render(<DocumentLibrary />); fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    const frame = await screen.findByTitle('Preview of Synthetic report.pdf');
    expect(frame).toHaveAttribute('sandbox', 'allow-same-origin');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByRole('link', { name: 'Open document in a new tab' })).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('rejects an unexpected preview host', async () => {
    api.documentPage.mockResolvedValue({ items: [doc], total: 1 });
    api.documentDownloadUrl.mockResolvedValue('https://untrusted.test/clinical-file');
    render(<DocumentLibrary />); fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('private preview could not be opened');
    expect(screen.queryByTitle('Preview of Synthetic report.pdf')).not.toBeInTheDocument();
  });
  it('grants named expiring access and displays a revocation control', async () => {
    api.documentPage.mockResolvedValue({ items: [doc], total: 1 });
    api.documentShares.mockResolvedValue({ items: [{ id: 'share-1', recipientId: 'doctor-1', name: 'Synthetic Doctor', expiresAt: '2099-01-01T00:00:00Z', revokedAt: null }] });
    render(<DocumentLibrary />); fireEvent.click(await screen.findByRole('button', { name: 'Share' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Grant access' }));
    await waitFor(() => expect(api.shareDocument).toHaveBeenCalledWith('doc-1', 'doctor-1', expect.any(String)));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(api.revokeDocumentShare).toHaveBeenCalledWith('doc-1', 'share-1'));
  });
  it('requires explicit confirmation before deleting a document', async () => {
    api.documentPage.mockResolvedValue({ items: [doc], total: 1 });
    render(<DocumentLibrary />); fireEvent.click(await screen.findByRole('button', { name: 'Delete Synthetic report.pdf' }));
    expect(api.deleteDocument).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete document' }));
    await waitFor(() => expect(api.deleteDocument).toHaveBeenCalledWith('doc-1'));
  });
});
