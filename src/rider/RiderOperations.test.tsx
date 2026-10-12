import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiderAvailability, RiderEarnings } from './RiderOperations';
import RiderOfferNotifications from './RiderOfferNotifications';
const mocks = vi.hoisted(() => ({ get: vi.fn(), write: vi.fn(), geolocation: vi.fn() }));
vi.mock('./riderApi', () => ({ getLive: mocks.get, writeLive: mocks.write }));
vi.mock('@/identity/liveIdentity', () => ({ liveStepUpMfa: vi.fn() }));
const mount = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: mocks.geolocation } }); });
describe('Rider operational controls', () => {
  it('does not go online when location permission is denied', async () => {
    mocks.get.mockResolvedValue({ isAvailable: false, availabilityVersion: 1, availableUntil: null });
    mocks.geolocation.mockImplementation((_success, error) => error({ code: 1 }));
    mount(<RiderAvailability />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go online' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Go online' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Allow location');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('uses the server availability version and a bounded online period', async () => {
    mocks.get.mockResolvedValue({ isAvailable: false, availabilityVersion: 7, availableUntil: null });
    mocks.geolocation.mockImplementation((success) => success({ coords: { latitude: 6.5, longitude: 3.4, accuracy: 10 } }));
    mocks.write.mockResolvedValue({ isAvailable: true, availabilityVersion: 8, availableUntil: new Date(Date.now() + 3600000).toISOString() });
    mount(<RiderAvailability />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go online' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Go online' }));
    await screen.findByRole('button', { name: 'Go offline' });
    expect(mocks.write).toHaveBeenCalledWith('/api/v1/delivery/availability', expect.objectContaining({ expectedVersion: 7, durationMinutes: 60, available: true }), 'PUT');
  });
  it('shows final earning notifications without percentages and safely acknowledges the offer', async () => {
    mocks.get.mockResolvedValue({ items: [{ id: 'notice', title: 'New delivery offer', message: 'You can earn ₦4,000 for this delivery.', isRead: false, link: '/rider/delivery/11111111-1111-4111-8111-111111111111', createdAt: new Date().toISOString() }] });
    mocks.write.mockResolvedValue({});
    mount(<RiderOfferNotifications />);
    fireEvent.click(await screen.findByRole('button', { name: /Delivery notifications, 1 unread/ }));
    expect(screen.getByText(/You can earn ₦4,000/)).toBeInTheDocument();
    expect(screen.queryByText(/80%|20%|kilometre rate/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New delivery offer/ }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledWith('/api/v1/delivery/offer-notifications/notice/read', {}));
  });
  it('renders server earnings and blocks withdrawal without a verified bank', async () => {
    mocks.get.mockResolvedValue({ availableMinor: 400000, heldMinor: 0, paidMinor: 0, items: [], payouts: [], bank: null, total: 0, providerConfigured: false, note: 'Frozen earning on successful delivery.' });
    mount(<RiderEarnings />);
    expect(await screen.findByRole('heading', { name: 'Your earnings' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Request payout' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Add bank account' })).toBeDisabled();
    expect(screen.getByText(/₦4,000/)).toBeInTheDocument();
    expect(screen.queryByText(/80%|20%|policy version/i)).not.toBeInTheDocument();
  });
});
