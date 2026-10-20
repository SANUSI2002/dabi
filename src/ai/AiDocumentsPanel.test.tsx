import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AiDocumentsPanel from '../../apps/telemedicine/packages/shared-portal/ai/AiDocumentsPanel.jsx';
const config = { documents: true, documentConsentVersion: 'sabi-ai-document-v1' };
const file = { id: 'doc-1', originalFilename: 'My screened report.pdf', status: 'CLEAN' };
const source = { id: 'source-1', documentId: file.id, state: 'NEEDS_REVIEW', revision: 1, patientLabels: ['Synthetic Person'], document: file, pages: [{ pageNumber: 1, text: 'Original extracted text', originalText: 'Original extracted text', uncertain: true, fields: [] }] };
afterEach(cleanup);
describe('AI documents consent and review', () => {
  it('requires explicit file-processing consent and does not send an upload URL', async () => {
    const call = vi.fn(async (path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }) => path === '/source-documents' ? { items: [file] } : path === '/sources' && options?.method !== 'POST' ? { items: [] } : {});
    render(<AiDocumentsPanel call={call} config={config} onUse={vi.fn()} onBack={vi.fn()} />);
    const button = await screen.findByRole('button', { name: 'Extract for review' }); expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button);
    await waitFor(() => expect(call.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true));
    const write = call.mock.calls.find(([, options]) => options?.method === 'POST')?.[1] as { body: unknown };
    expect(write.body).toEqual({ documentId: file.id, clientRequestId: expect.any(String), consentGiven: true, consentVersion: config.documentConsentVersion });
  });
  it('requires wrong-patient and page checks before saving user corrections', async () => {
    const call = vi.fn(async (path: string, _options?: unknown) => path === '/source-documents' ? { items: [file] } : path === '/sources' ? { items: [source] } : path.endsWith('/review') ? { state: 'READY' } : source);
    render(<AiDocumentsPanel call={call} config={config} onUse={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(await screen.findByText(/Names printed in this file/)).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save reviewed extraction' }); expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review extracted text'), { target: { value: 'Corrected text as printed' } });
    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
    fireEvent.click(save);
    await waitFor(() => expect(call.mock.calls.some(([path]) => path.endsWith('/review'))).toBe(true));
    const body = call.mock.calls.find(([path]) => path.endsWith('/review'))?.[1] as { body: { pages: unknown[] } };
    expect(body.body.pages).toEqual([{ pageNumber: 1, text: 'Corrected text as printed' }]);
  });
});
