import {beforeEach,describe,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({doctorRequest:vi.fn()}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/services/doctorAuth',()=>auth);
const api=await import('../../apps/telemedicine/packages/doctor-portal/src/live/doctorApi');
beforeEach(()=>vi.clearAllMocks());

describe('consultation notes before the server has them',()=>{
  it('treats a plain 404 (route not on the server yet) as "not live"',async()=>{
    auth.doctorRequest.mockRejectedValue(Object.assign(new Error('Not Found - /api/v1/consultation-notes/practice'),{status:404}));
    await expect(api.loadConsultationNotes(0)).resolves.toEqual({notLive:true});
    await expect(api.loadConsultationNote('apt')).resolves.toEqual({notLive:true});
  });
  it('still reports the module\'s own "not found" and other failures',async()=>{
    auth.doctorRequest.mockRejectedValue(Object.assign(new Error('Appointment not found.'),{status:404,code:'NOT_FOUND'}));
    await expect(api.loadConsultationNote('apt')).rejects.toThrow('Appointment not found.');
    auth.doctorRequest.mockRejectedValue(Object.assign(new Error('Service unavailable'),{status:503}));
    await expect(api.loadConsultationNotes(0)).rejects.toThrow('Service unavailable');
  });
});
