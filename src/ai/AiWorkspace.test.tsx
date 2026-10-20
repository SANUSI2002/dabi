import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import AiWorkspace from '../../apps/telemedicine/packages/shared-portal/ai/AiWorkspace.jsx';

const sid = '11111111-1111-4111-8111-111111111111';
const rid = '22222222-2222-4222-8222-222222222222';
const now = '2026-10-20T10:00:00Z';
const config = { enabled: true, consentVersion: 'sabi-ai-conversation-v1' };
const ok = (data: unknown) => ({ status: 'success', data });
const conversation = { id: sid, title: 'Understanding my care', messages: [{ id: 'message-1', role: 'assistant', content: 'A report records an assessment.', createdAt: now }], runs: [] };
const usage = { today: 2, total: 4, completed: 2, dailyAllowance: 10, resetsAt: now };
function transport(override?: (path: string, options?: { method?: string; body?: unknown }) => ReturnType<typeof ok> | undefined) {
  return vi.fn(async (path: string, options?: { method?: string; body?: unknown }) => {
    const result = override?.(path, options);
    if (result !== undefined) return result;
    if (path.endsWith('/config')) return ok(config);
    if (path.endsWith('/usage')) return ok(usage);
    if (path.endsWith('/memory')) return ok({ items: [] });
    if (path.endsWith('/sessions')) return ok({ items: [] });
    return ok(conversation);
  });
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
});
afterEach(cleanup);

describe('connected Sabi AI workspace', () => {
  it('blocks a known exhausted allowance and accepts an administrator top-up after refreshing the server balance', async () => {
    let remaining = 0;
    const request = transport((path) => path.endsWith('/usage') ? ok({ ...usage, allowance: { requests: { remaining: 8, resetsAt: '2099-01-01T00:00:00Z' }, tokens: { allocated: 5000, used: 5000, reserved: 0, remaining, status: remaining ? 'AVAILABLE' : 'EXHAUSTED', resetsAt: '2099-01-01T00:00:00Z' } } }) : undefined);
    render(<AiWorkspace request={request} />);
    await screen.findByText('0 tokens left');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Your message to Sabi'), { target: { value: 'Explain a health term.' } });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    remaining = 1000;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh balance' }));
    await screen.findByText('1,000 tokens left');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });
  it('shows server-owned remaining tokens and reset details without deriving a balance from browser storage', async () => {
    const request = transport((path) => path.endsWith('/usage') ? ok({ ...usage, allowance: { requests: { remaining: 8, resetsAt: '2099-01-01T00:00:00Z' }, tokens: { allocated: 5000, used: 1000, reserved: 500, remaining: 3500, status: 'LOW', resetsAt: '2099-01-01T00:00:00Z' } } }) : undefined);
    render(<AiWorkspace request={request} />);
    expect(await screen.findByText('3,500 tokens left')).toBeInTheDocument();
    expect(screen.getByText('Your token allocation is running low.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usage & reset times' }));
    expect(await screen.findByRole('region', { name: 'Token allocation details' })).toHaveTextContent('Tokens reserved for outstanding work');
    expect(screen.getByText('Token allowance renews')).toBeInTheDocument();
  });
  it('requires consent and sends only the explicit message with an idempotency key', async () => {
    const request = transport((path, options) => {
      if (path.endsWith('/sessions') && options?.method === 'POST') return ok({ ...conversation, messages: [] });
      if (path.endsWith('/messages')) return ok({ id: rid, sessionId: sid, status: 'QUEUED' });
    });
    render(<AiWorkspace request={request} />);
    await screen.findByRole('heading', { name: 'What would you like to understand?' });
    fireEvent.change(screen.getByLabelText('Your message to Sabi'), { target: { value: 'What is a report?' } });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.endsWith('/messages'))).toBe(true));
    const body = request.mock.calls.find(([path]) => path.endsWith('/messages'))?.[1]?.body as { message: string; clientMessageId: string };
    expect(body).toEqual({ message: 'What is a report?', clientMessageId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    expect(JSON.stringify(body)).not.toMatch(/patientId|tenantId|accessToken/);
  });
  it('keeps the same message ID after an uncertain network failure', async () => {
    let sends = 0;
    const request = transport((path, options) => {
      if (path.endsWith('/sessions') && options?.method === 'POST') return ok({ ...conversation, messages: [] });
      if (path.endsWith('/messages')) { sends += 1; if (sends === 1) throw new Error('Connection interrupted'); return ok({ id: rid, status: 'QUEUED' }); }
    });
    render(<AiWorkspace request={request} />);
    await screen.findByRole('heading', { name: 'What would you like to understand?' });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Your message to Sabi'), { target: { value: 'Explain a health term.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Connection interrupted');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(sends).toBe(2));
    const bodies = request.mock.calls.filter(([path]) => path.endsWith('/messages')).map(([, options]) => options?.body);
    expect(bodies[0]).toEqual(bodies[1]);
  });
  it('allows saved history when generation is unavailable and renders model text safely', async () => {
    const request = transport((path) => path.endsWith('/config') ? ok({ ...config, enabled: false }) : path.endsWith('/sessions') ? ok({ items: [conversation] }) : path.endsWith(sid) ? ok({ ...conversation, messages: [{ ...conversation.messages[0], content: '<img src=x onerror=alert(1)>' }] }) : undefined);
    const { container } = render(<AiWorkspace request={request} />);
    fireEvent.click(await screen.findByRole('button', { name: conversation.title }));
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });
  it('requires an explicit delete confirmation and explains retained metadata', async () => {
    const request = transport((path, options) => path.endsWith('/sessions') ? ok({ items: [conversation] }) : options?.method === 'DELETE' ? ok({ deleted: true, retained: 'Audit and usage metadata remain.' }) : undefined);
    render(<AiWorkspace request={request} />);
    fireEvent.click(await screen.findByRole('button', { name: conversation.title }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete conversation' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete messages' }));
    await waitFor(() => expect(request.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('Audit and usage metadata remain.')).toBeInTheDocument();
  });
  it('shows actual server usage without inventing monetary charges', async () => {
    render(<AiWorkspace request={transport()} />);
    await screen.findByRole('heading', { name: 'What would you like to understand?' });
    fireEvent.click(screen.getByRole('button', { name: 'Privacy & usage' }));
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    expect(screen.getByText(/AI billing is not enabled/)).toBeInTheDocument();
  });
});
