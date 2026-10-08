import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActivityLog, { placeLabel } from '../../apps/telemedicine/packages/shared-portal/activity/ActivityLog.jsx';

const now = new Date();
const earlier = new Date(now.getTime() - 3 * 86_400_000);
const mine = { id: 'a1', at: now.toISOString(), category: 'SIGN_IN', action: 'SIGNED_IN', side: 'actor', text: 'You signed in', device: 'Chrome on Android', ip: '102.89.x.x', location: { city: 'Lagos', region: 'LA', country: 'NG' } };
const failed = { id: 'a2', at: now.toISOString(), category: 'SIGN_IN', action: 'SIGN_IN_FAILED', side: 'actor', text: 'Someone tried to sign in to your account with a wrong password', device: 'Firefox on Windows', ip: '41.58.x.x', location: null };
const theirs = { id: 'a3', at: earlier.toISOString(), category: 'RECORD_ACCESS', action: 'CONSULTATION_NOTE_VIEWED', side: 'subject', text: 'Dr Synthetic opened the notes about your consultation' };
afterEach(cleanup);

describe('Activity log', () => {
  it('groups entries by day and shows network details only on your own entries', async () => {
    render(<ActivityLog load={vi.fn().mockResolvedValue({ items: [mine, failed, theirs], nextCursor: null })} />);
    const today = await screen.findByRole('region', { name: 'Today' });
    expect(within(today).getByText('You signed in')).toBeInTheDocument();
    expect(within(today).getByText('Chrome on Android · Lagos, Nigeria · IP 102.89.x.x')).toBeInTheDocument();
    const older = screen.getAllByRole('region').find((region) => region !== today);
    expect(within(older).getByText('Dr Synthetic opened the notes about your consultation')).toBeInTheDocument();
    expect(within(older).queryByText(/IP /)).not.toBeInTheDocument();
  });

  it('highlights failed sign-in attempts', async () => {
    render(<ActivityLog load={vi.fn().mockResolvedValue({ items: [failed], nextCursor: null })} />);
    expect((await screen.findByText(failed.text)).closest('li')).toHaveClass('is-warning');
  });

  it('filters by category and loads older entries with the cursor', async () => {
    const load = vi.fn(async ({ cursor }) => (cursor ? { items: [theirs], nextCursor: null } : { items: [mine], nextCursor: 'c1' }));
    render(<ActivityLog load={load} audience="professional" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load older activity' }));
    await screen.findByText(theirs.text);
    expect(load).toHaveBeenLastCalledWith({ category: '', cursor: 'c1' });
    expect(screen.queryByRole('button', { name: 'Load older activity' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Record access' }));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith({ category: 'RECORD_ACCESS' }));
  });

  it('explains a failed load and retries', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValue({ items: [mine], nextCursor: null });
    render(<ActivityLog load={load} />);
    fireEvent.click(await screen.findByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('You signed in')).toBeInTheDocument();
  });

  it('says where a sign-in came from in words', () => {
    expect(placeLabel({ city: 'Lagos', region: 'LA', country: 'NG' })).toBe('Lagos, Nigeria');
    expect(placeLabel({ city: null, region: 'FC', country: 'NG' })).toBe('FC, Nigeria');
    expect(placeLabel(null)).toBeNull();
  });
});
