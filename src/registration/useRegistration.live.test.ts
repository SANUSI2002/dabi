import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPLICATION_STEPS, createBlankApplication } from './domain';
import { useRegistration } from './useRegistration';
import { liveSubmitApplication } from './livePlatform';

vi.mock('@/config/runtime', () => ({ apiConfigured: true }));
vi.mock('./livePlatform', () => ({ liveSubmitApplication: vi.fn() }));

function readyDraft() {
  const draft = createBlankApplication();
  draft.completedSteps = APPLICATION_STEPS.filter((step) => step.key !== 'review').map((step) => step.key);
  useRegistration.setState({ applications: [draft] });
  return draft;
}

afterEach(() => { vi.clearAllMocks(); useRegistration.setState({ applications: [] }); localStorage.clear(); });

describe('live organization application submission', () => {
  it('waits for server acknowledgement and email verification instead of marking submission complete', async () => {
    const draft = readyDraft();
    vi.mocked(liveSubmitApplication).mockResolvedValue({ data: { id: 'server-1', reference: 'SABI-APP-2026-TEST', status: 'AWAITING_EMAIL', createdAt: '2026-09-24', submittedAt: null } });
    const result = await useRegistration.getState().submitApplication(draft.id);
    expect(result.reference).toBe('SABI-APP-2026-TEST');
    expect(useRegistration.getState().applications[0]).toMatchObject({ status: 'AWAITING_EMAIL', serverApplicationId: 'server-1' });
  });

  it('leaves the draft editable when the API refuses the submission', async () => {
    const draft = readyDraft();
    vi.mocked(liveSubmitApplication).mockRejectedValue(new Error('Package not published'));
    const result = await useRegistration.getState().submitApplication(draft.id);
    expect(result.error).toBe('Package not published');
    expect(useRegistration.getState().applications[0].status).toBe('DRAFT');
  });
});
