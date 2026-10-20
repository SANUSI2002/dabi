import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../apps/telemedicine/packages/patient-portal/src/pages/dashboard/components/Sidebar.jsx';

vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity', () => ({ signOut: vi.fn() }));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/pwa/pushNotifications', () => ({ forgetThisDevice: vi.fn() }));

beforeEach(() => localStorage.clear());
function open(path = '/dashboard') {
  return render(<MemoryRouter initialEntries={[path]}><Sidebar /><Routes>
    <Route path="/dashboard" element={<h1>Patient dashboard</h1>} />
    <Route path="/sabi-ai" element={<h1>Patient AI destination</h1>} />
  </Routes></MemoryRouter>);
}
describe('released patient AI navigation', () => {
  it('renders the real sidebar entry and opens the protected AI destination path', () => {
    open(); const link = screen.getByRole('link', { name: 'Sabi AI', exact: true });
    expect(link).toHaveAttribute('href', '/sabi-ai'); fireEvent.click(link);
    expect(screen.getByRole('heading', { name: 'Patient AI destination' })).toBeInTheDocument();
    expect(link).toHaveAttribute('aria-current', 'page');
  });
  it('keeps the entry available from collapsed and mobile navigation', () => {
    localStorage.setItem('sabi-sidebar-collapsed', 'true'); const { container } = open('/sabi-ai');
    expect(screen.getByRole('link', { name: 'Sabi AI', exact: true })).toHaveAttribute('title', 'Sabi AI');
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(container.querySelector('.sabi-sidebar')).toHaveClass('mobile-open');
    expect(screen.getByRole('link', { name: 'Sabi AI', exact: true })).toHaveAttribute('aria-current', 'page');
  });
});
