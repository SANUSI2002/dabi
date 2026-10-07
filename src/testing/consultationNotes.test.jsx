import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';

const api=vi.hoisted(()=>({loadConsultationNote:vi.fn(),saveConsultationNote:vi.fn(),signConsultationNote:vi.fn(),loadConsultationNotes:vi.fn()}));
const identity=vi.hoisted(()=>({authorizedRequest:vi.fn()}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/live/doctorApi',()=>api);
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/store/doctorSession',()=>({getCurrentDoctor:()=>({professionType:'DOCTOR',name:'Synthetic doctor'}),signOutDoctor:vi.fn()}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/components/PortalLayout',()=>({default:({children})=><main>{children}</main>}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/services/runtime',()=>({IDENTITY_UI_URL:''}));
vi.mock('../../apps/telemedicine/packages/shared-video/DailyConsultation',()=>({default:()=>null}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/live/ProfessionalAvailability',()=>({default:()=>null}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/live/ProfessionalCareWorkspace',()=>({default:()=>null}));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity',()=>identity);
const {default:LiveDoctorWorkspace}=await import('../../apps/telemedicine/packages/doctor-portal/src/live/LiveDoctorWorkspace');
const {listUiAppointments}=await import('../../apps/telemedicine/packages/patient-portal/src/api/doctorsApi');
const {AppointmentDetailModal}=await import('../../apps/telemedicine/packages/patient-portal/src/pages/appointments/components/AppointmentDetailModal');

const content=(over={})=>({clinical:{presentingComplaint:'Synthetic complaint',history:'',findings:'',assessment:'Synthetic assessment',plan:'',...over.clinical},patient:{summary:'Synthetic summary',advice:'',warningSigns:'',followUp:{needed:false,timeframe:'',instructions:''},...over.patient}});
const detail=({revision=2,signedVersion=null,canSign=true,draft=content()}={})=>({appointment:{id:'apt',status:canSign?'COMPLETED':'CONFIRMED',startsAt:'2026-10-07T12:00:00Z',endsAt:'2026-10-07T12:30:00Z',consultationType:'VIRTUAL',reason:'Synthetic reason',patient:{name:'Synthetic patient',patientId:'SABI-T-1'},dependent:null},note:{revision,signedVersion,draft,hasUnsignedChanges:false,versions:signedVersion?[{number:1,signedAt:'2026-10-07T13:00:00Z',amendmentReason:null}]:[]},canSign,previous:[]});
const openEditor=()=>render(<MemoryRouter initialEntries={['/reports/apt']}><LiveDoctorWorkspace/></MemoryRouter>);
beforeEach(()=>vi.clearAllMocks());
afterEach(cleanup);

describe('doctor consultation note editor',()=>{
  it('saves unsaved edits first, then signs the revision the save returned',async()=>{
    api.loadConsultationNote.mockResolvedValue(detail());
    api.saveConsultationNote.mockImplementation(async(_id,body)=>detail({revision:3,draft:body.content}));
    api.signConsultationNote.mockResolvedValue(detail({revision:4,signedVersion:1}));
    openEditor();
    fireEvent.change(await screen.findByLabelText('Plan'),{target:{value:'Synthetic plan'}});
    fireEvent.click(screen.getByRole('button',{name:'Sign and share with patient'}));
    await screen.findByText(/Note signed/);
    expect(api.saveConsultationNote).toHaveBeenCalledWith('apt',{revision:2,content:expect.objectContaining({clinical:expect.objectContaining({plan:'Synthetic plan'})})});
    expect(api.signConsultationNote).toHaveBeenCalledWith('apt',{revision:3});
    expect(api.saveConsultationNote.mock.invocationCallOrder[0]).toBeLessThan(api.signConsultationNote.mock.invocationCallOrder[0]);
  });
  it('keeps signing closed until the consultation is completed',async()=>{
    api.loadConsultationNote.mockResolvedValue(detail({canSign:false}));
    openEditor();
    expect(await screen.findByRole('button',{name:'Sign and share with patient'})).toBeDisabled();
    expect(screen.getByText(/Signing opens once you mark the consultation completed/)).toBeInTheDocument();
  });
  it('asks for a reason before signing an amendment',async()=>{
    api.loadConsultationNote.mockResolvedValue(detail({revision:3,signedVersion:1}));
    api.signConsultationNote.mockResolvedValue(detail({revision:5,signedVersion:2}));
    api.saveConsultationNote.mockImplementation(async(_id,body)=>detail({revision:4,signedVersion:1,draft:body.content}));
    openEditor();
    fireEvent.change(await screen.findByLabelText('Advice and next steps'),{target:{value:'Corrected advice'}});
    const signAmendment=screen.getByRole('button',{name:'Sign amendment'});
    expect(signAmendment).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason for changing the signed note'),{target:{value:'Corrected the advice'}});
    fireEvent.click(signAmendment);
    await screen.findByText(/Amendment signed/);
    expect(api.signConsultationNote).toHaveBeenCalledWith('apt',{revision:4,amendmentReason:'Corrected the advice'});
  });
});

const appointment={id:'apt',status:'COMPLETED',startsAt:'2026-10-07T12:00:00Z',endsAt:'2026-10-07T12:30:00Z',consultationType:'VIRTUAL',doctorProfileId:'doc',doctor:{id:'doc',name:'Dr Synthetic',specialty:'General practice',practiceName:null,practiceAddress:null}};
const visit={appointmentId:'apt',version:1,signedAt:'2026-10-07T13:00:00Z',updated:false,history:[],consultation:{},doctor:{name:'Dr Synthetic'},summary:{summary:'Synthetic summary',advice:'Synthetic advice',warningSigns:'',followUp:{needed:true,timeframe:'In two weeks',instructions:''}}};

describe('patient visit summaries',()=>{
  it('attaches the signed summary and marks recommended follow-ups',async()=>{
    identity.authorizedRequest.mockImplementation(async(path)=>({data:path.includes('consultation-notes')?[visit]:{items:[appointment]}}));
    const [item]=await listUiAppointments();
    expect(item).toMatchObject({visitSummary:visit,followUpRecommended:true,visitSummaryUnavailable:false});
  });
  it('still lists appointments when summaries cannot load, and says so on completed ones',async()=>{
    identity.authorizedRequest.mockImplementation(async(path)=>{if(path.includes('consultation-notes'))throw new Error('Service unavailable');return {data:{items:[appointment]}};});
    const [item]=await listUiAppointments();
    expect(item).toMatchObject({visitSummary:null,followUpRecommended:false,visitSummaryUnavailable:true});
  });
  it('shows the summary in the appointment details, skipping empty sections',()=>{
    render(<AppointmentDetailModal appointment={{status:'completed',doctor:'Dr Synthetic',location:'Video consultation',date:'Oct 07, 2026',time:'01:00 PM',visitSummary:visit}} onClose={()=>{}}/>);
    expect(screen.getByRole('region',{name:'Visit summary'})).toBeInTheDocument();
    expect(screen.getByText('Synthetic advice')).toBeInTheDocument();
    expect(screen.getByText('In two weeks')).toBeInTheDocument();
    expect(screen.queryByText('When to seek urgent care')).not.toBeInTheDocument();
  });
});
