import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLiveEmr, type LiveEmrUser } from './session';
import type { LiveEmrAccess } from '../identity/liveIdentity';
import { flowsheetRows, marSlots, useLiveWards } from './inpatient';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ emrRequest: request, newIdempotencyKey: () => 'synthetic-key' }));
const hospital = (id: string) => useLiveEmr.setState({ status: 'ready', access: { organizationId: id } as LiveEmrAccess, user: { id: 'staff' } as LiveEmrUser });
afterEach(() => { useLiveEmr.setState({ status: 'idle', access: null, user: null }); vi.resetAllMocks(); });
describe('live inpatient release', () => {
  it('clears ward data when the hospital changes or the user signs out', () => {
    hospital('hospital-a');
    useLiveWards.setState({ wards: [{ id: 'ward-a' }] as never, flowsheet: { 'admission-a': [] } });
    hospital('hospital-b');
    expect(useLiveWards.getState().wards).toEqual([]);
    expect(useLiveWards.getState().flowsheet).toEqual({});
    useLiveWards.setState({ mar: { 'admission-b': [] } });
    useLiveEmr.setState({ status: 'idle', access: null });
    expect(useLiveWards.getState().mar).toEqual({});
  });
  it('ignores an old hospital response that arrives after switching', async () => {
    hospital('hospital-a');
    let reply!: (value: unknown) => void;
    request.mockImplementation((path: string) => path === '/wards'
      ? new Promise((resolve) => { reply = resolve; }) : Promise.resolve({ data: { items: [] } }));
    const load = useLiveWards.getState().load();
    hospital('hospital-b');
    useLiveWards.setState({ error: 'New hospital state' });
    reply({ data: { items: [] } });
    await load;
    expect(useLiveWards.getState().error).toBe('New hospital state');
  });
  it('combines nursing and vital readings without displaying entered-in-error vitals', () => {
    const rows = flowsheetRows('a', 'p', [
      { code: 'BP_SYSTOLIC', value: 120, recordedAt: '2026-10-08T10:00:00Z', recordedByName: 'Nurse', status: 'ACTIVE' },
      { code: 'BP_DIASTOLIC', value: 80, recordedAt: '2026-10-08T10:00:00Z', recordedByName: 'Nurse', status: 'ACTIVE' },
      { code: 'TEMPERATURE', value: 99, recordedAt: '2026-10-08T10:00:00Z', recordedByName: 'Nurse', status: 'ENTERED_IN_ERROR' },
    ], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].bp).toBe('120/80');
    expect(rows[0].temp).toBeUndefined();
  });
  it('retains controlled-dose requirements and idempotency in MAR requests', async () => {
    // Signed-out refreshes are skipped; the isolated request only verifies payload mapping.
    request.mockResolvedValue({});
    const [slot] = marSlots([{ prescriptionItemId: 'rx', drugName: 'Synthetic medicine', strength: '1 mg', dose: 1, doseUnit: 'mg', route: 'ORAL', frequency: 'DAILY', prn: false, controlled: true, lastGivenAt: null, nextAllowedAt: null }], []);
    expect(slot.controlled).toBe(true);
    await useLiveWards.getState().chart({ id: 'a' } as never, slot, 'given', { witnessUserId: 'witness', key: 'one-dose-key' });
    expect(request).toHaveBeenCalledWith('/admissions/a/mar', expect.objectContaining({ idempotencyKey: 'one-dose-key', body: { prescriptionItemId: 'rx', status: 'GIVEN', dose: 1, doseUnit: 'mg', route: 'ORAL', witnessUserId: 'witness' } }));
  });
});
