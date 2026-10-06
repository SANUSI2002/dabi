import React from 'react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ProfessionalCareWorkspace from '../../apps/telemedicine/packages/doctor-portal/src/live/ProfessionalCareWorkspace';
import {DieticianTablePage} from '../../apps/telemedicine/packages/patient-portal/src/pages/prescriptions/DieticianTablePage';
import ProfessionalRegistrationPage from '../../apps/telemedicine/packages/doctor-portal/src/pages/auth/ProfessionalRegistrationPage';
const mocks=vi.hoisted(()=>({doctorRequest:vi.fn(),authorizedRequest:vi.fn(),getRegistrationConfig:vi.fn(),registerProfessional:vi.fn()}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/services/doctorAuth',()=>({...mocks,AUTH_CONFIGURED:true,PREVIEW_ENABLED:false,REGISTRATION_CONFIGURED:true,TERMS_URL:'',PRIVACY_URL:''}));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity',()=>({authorizedRequest:mocks.authorizedRequest}));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/pages/hospitals/hospitalShared',()=>({PageShell:({children})=><main>{children}</main>}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/pages/auth/AuthLayout',()=>({default:({children})=><main>{children}</main>}));
const content={title:'Published meal plan',startsOn:'2026-10-06',endsOn:'2026-10-12',goals:'Balanced meals',history:'Private assessment',preferences:'',allergies:'',restrictions:'',budget:'',instructions:'Follow up weekly',activities:'',followUpOn:null,meals:[{day:'Monday',time:'Breakfast',food:'Oats',portion:'One reviewed serving',alternative:'',preparation:''}],targets:[]};
const plan={id:'plan',patientId:'patient',title:content.title,draft:content,revision:1,publishedVersion:null,versions:[],feedback:[],notes:[]};
beforeEach(()=>{vi.clearAllMocks();mocks.doctorRequest.mockImplementation(async(path,options={})=>({data:path.endsWith('/workspace')?{kind:'NUTRITION',professionType:'NUTRITIONIST_DIETITIAN',patients:[{id:'patient',name:'Synthetic patient',reference:'TEST'}],plans:[plan],templates:[]}:path.endsWith('/publish')?{...plan,revision:2,publishedVersion:1}:plan}));mocks.authorizedRequest.mockImplementation(async path=>({data:path.endsWith('/providers')?[]:[{id:'plan',kind:'NUTRITION',professionalId:'pro',professional:'Verified dietitian',publishedVersion:1,content:{...content,history:undefined},versions:[{number:1,publishedAt:'2026-10-06T10:00:00Z'}],feedback:[]}]}));mocks.getRegistrationConfig.mockResolvedValue({enabled:true,professions:[{type:'COUNSELLOR',label:'Counsellor',disciplines:['COUNSELLOR'],regulator:'Professional standing',regulated:false},{type:'PSYCHOLOGIST',label:'Clinical psychologist',disciplines:['CLINICAL_PSYCHOLOGIST'],regulator:'Clinical qualification',regulated:false},{type:'CAREGIVER',label:'Caregiver',disciplines:['NON_CLINICAL_CAREGIVER','REGISTERED_NURSE'],regulator:'NMCN for nurses',regulated:false}]});});
afterEach(cleanup);
function fillAccount() {
  for (const [label,value] of [['First name','Test'],['Last name','Professional'],['Email address','synthetic@example.invalid'],['Phone (+234…)','+2348000000000'],['Password (at least 15 characters)','synthetic-passphrase-only'],['Confirm password','synthetic-passphrase-only']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:/Continue/}));
}
function fillPractice() {
  for (const [label,value] of [['Relevant qualification','Synthetic qualification'],['Training institution','Test institution'],['Qualification year','2020'],['Years of experience','3'],['Specialisation','Test practice'],['Services you provide','Synthetic services']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:/Continue/}));
}
describe('connected professional and patient UI',()=>{
  it('ignores repeated draft submission while the first save is pending',async()=>{
    let finish;
    const original=mocks.doctorRequest.getMockImplementation();
    mocks.doctorRequest.mockImplementation((path,options)=>path==='/professional-care/plans'&&options?.method==='POST'?new Promise(resolve=>{finish=resolve;}):original(path,options));
    render(<ProfessionalCareWorkspace/>);await screen.findByText('Dietician Table');
    fireEvent.click(screen.getByRole('button',{name:'New nutrition plan'}));
    fireEvent.change(screen.getByLabelText('Authorised patient'),{target:{value:'patient'}});
    fireEvent.change(screen.getByLabelText('Plan name'),{target:{value:'Synthetic plan'}});
    const save=screen.getByRole('button',{name:'Save draft'});
    act(()=>{save.dispatchEvent(new MouseEvent('click',{bubbles:true}));save.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    expect(mocks.doctorRequest.mock.calls.filter(([path])=>path==='/professional-care/plans')).toHaveLength(1);
    await act(async()=>{finish({data:plan});});
    await screen.findByText(/Draft saved/);
  });
  it('opens the same stored nutrition plan, saves private draft and publishes by revision',async()=>{render(<ProfessionalCareWorkspace/>);await screen.findByText('Dietician Table');fireEvent.click(screen.getByRole('button',{name:/Published meal plan/}));await screen.findByDisplayValue(content.title);fireEvent.change(screen.getByLabelText('Patient goals'),{target:{value:'Revised goals'}});fireEvent.click(screen.getByRole('button',{name:'Save draft'}));await screen.findByText(/Draft saved/);expect(mocks.doctorRequest).toHaveBeenCalledWith('/professional-care/plans/plan',expect.objectContaining({method:'PUT',body:expect.stringContaining('Revised goals')}));fireEvent.click(screen.getByRole('button',{name:'Publish version'}));await screen.findByText(/Plan published/);expect(mocks.doctorRequest).toHaveBeenCalledWith('/professional-care/plans/plan/publish',expect.objectContaining({method:'POST',body:'{"revision":1}'}));});
  it('patient receives only published nutrition and sends version-specific progress',async()=>{render(<DieticianTablePage/>);await screen.findByText('Published meal plan');expect(screen.queryByText('Private assessment')).not.toBeInTheDocument();expect(screen.getByText('Oats')).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Progress or questions'),{target:{value:'Following the plan'}});fireEvent.click(screen.getByRole('button',{name:'Send update'}));await screen.findByText(/update was sent/);expect(mocks.authorizedRequest).toHaveBeenCalledWith('/api/v1/professional-care/patient/plans/plan/feedback',{method:'POST',body:{version:1,message:'Following the plan',progress:'ON_TRACK'}});});
  it('therapist workspace does not show medication or meal-plan tools',async()=>{mocks.doctorRequest.mockResolvedValue({data:{kind:'SUPPORT',professionType:'COUNSELLOR',patients:[{id:'patient',name:'Patient'}],plans:[],templates:[]}});render(<ProfessionalCareWorkspace/>);await screen.findByText('Counselling workspace');fireEvent.click(screen.getByRole('button',{name:'New support plan'}));expect(screen.getByLabelText('Activities / care goals and agreed next steps')).toBeInTheDocument();expect(screen.queryByText('Add meal')).not.toBeInTheDocument();expect(screen.queryByText('Prescriptions')).not.toBeInTheDocument();});
  it('registers psychologists and counsellors as separate disciplines',async()=>{render(<MemoryRouter><ProfessionalRegistrationPage/></MemoryRouter>);await screen.findByRole('option',{name:'Clinical psychologist'});fireEvent.change(screen.getByLabelText('Profession'),{target:{value:'COUNSELLOR'}});expect(screen.getByLabelText('Discipline')).toHaveValue('COUNSELLOR');fireEvent.change(screen.getByLabelText('Profession'),{target:{value:'PSYCHOLOGIST'}});expect(screen.getByLabelText('Discipline')).toHaveValue('CLINICAL_PSYCHOLOGIST');expect(screen.queryByLabelText('Current licence expiry')).not.toBeInTheDocument();});
  it('only the nursing caregiver discipline requests a dated regulator licence',async()=>{render(<MemoryRouter><ProfessionalRegistrationPage/></MemoryRouter>);await screen.findByRole('option',{name:'Caregiver'});fireEvent.change(screen.getByLabelText('Profession'),{target:{value:'CAREGIVER'}});expect(screen.queryByLabelText('Licence type')).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('Discipline'),{target:{value:'REGISTERED_NURSE'}});fillAccount();fillPractice();expect(screen.getByLabelText('Regulator registration number')).toBeRequired();expect(screen.getByLabelText('Licence type')).toBeInTheDocument();});
  it('blocks missing details and mismatched passwords before moving forward',async()=>{
    render(<MemoryRouter><ProfessionalRegistrationPage/></MemoryRouter>);
    await screen.findByRole('option',{name:'Counsellor'});
    fireEvent.change(screen.getByLabelText('Profession'),{target:{value:'COUNSELLOR'}});
    fireEvent.click(screen.getByRole('button',{name:/Continue/}));
    expect(screen.getByRole('alert')).toHaveTextContent('Please complete');
    fillAccount();
    fireEvent.click(screen.getByRole('button',{name:'Back'}));
    fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'different-passphrase'}});
    fireEvent.click(screen.getByRole('button',{name:/Continue/}));
    expect(screen.getByRole('alert')).toHaveTextContent('passwords do not match');
    expect(mocks.registerProfessional).not.toHaveBeenCalled();
  });
  it('reviews and submits once without sending confirmation password or saving credentials',async()=>{
    let finish;
    mocks.registerProfessional.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    render(<MemoryRouter><ProfessionalRegistrationPage/></MemoryRouter>);
    await screen.findByRole('option',{name:'Counsellor'});
    fireEvent.change(screen.getByLabelText('Profession'),{target:{value:'COUNSELLOR'}});
    fillAccount();fillPractice();
    fireEvent.change(screen.getByLabelText('Practice state'),{target:{value:'Lagos'}});
    fireEvent.change(screen.getByLabelText('City'),{target:{value:'Test city'}});
    fireEvent.click(screen.getByRole('button',{name:/Continue/}));
    expect(screen.getByText('Review your application')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Create professional account'}));
    expect(screen.getByRole('alert')).toHaveTextContent('confirm your declaration');
    fireEvent.click(screen.getByLabelText('I confirm my details and qualifications are accurate.'));
    fireEvent.click(screen.getByLabelText(/I accept the registration conditions/));
    const submit=screen.getByRole('button',{name:'Create professional account'});
    act(()=>{submit.dispatchEvent(new MouseEvent('click',{bubbles:true}));submit.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    expect(mocks.registerProfessional).toHaveBeenCalledTimes(1);
    expect(mocks.registerProfessional.mock.calls[0][0]).toMatchObject({professionType:'COUNSELLOR',discipline:'COUNSELLOR',termsAccepted:true,declaration:true,country:'NG'});
    expect(mocks.registerProfessional.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
    expect(localStorage.length).toBe(0);
    await act(async()=>finish({data:{id:'synthetic'}}));
  });
  it('preserves entered details after a registration API failure',async()=>{
    mocks.registerProfessional.mockRejectedValue(new Error('Service unavailable'));
    render(<MemoryRouter><ProfessionalRegistrationPage/></MemoryRouter>);
    await screen.findByRole('option',{name:'Counsellor'});
    fireEvent.change(screen.getByLabelText('Profession'),{target:{value:'COUNSELLOR'}});
    fillAccount();fillPractice();
    fireEvent.change(screen.getByLabelText('Practice state'),{target:{value:'Lagos'}});
    fireEvent.change(screen.getByLabelText('City'),{target:{value:'Test city'}});
    fireEvent.click(screen.getByRole('button',{name:/Continue/}));
    fireEvent.click(screen.getByLabelText('I confirm my details and qualifications are accurate.'));
    fireEvent.click(screen.getByLabelText(/I accept the registration conditions/));
    fireEvent.click(screen.getByRole('button',{name:'Create professional account'}));
    await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    fireEvent.click(screen.getByRole('button',{name:'Edit your account'}));
    expect(screen.getByLabelText('Email address')).toHaveValue('synthetic@example.invalid');
  });
  it('shows API failures instead of empty fabricated records',async()=>{mocks.authorizedRequest.mockRejectedValue(new Error('Service unavailable'));render(<DieticianTablePage/>);await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable'));});
});
