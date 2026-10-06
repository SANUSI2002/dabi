import React from 'react';
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import CareStory from '../../apps/telemedicine/packages/shared-portal/CareStory';
import CareBanner from '../../apps/telemedicine/packages/shared-portal/CareBanner';
import AccountTypeSelection from '../../apps/telemedicine/packages/patient-portal/src/pages/Onboarding/AccountTypeSelection';
import Sidebar from '../../apps/telemedicine/packages/doctor-portal/src/components/Sidebar';
const session=vi.hoisted(() => ({current:{professionType:'DOCTOR'}}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/store/doctorSession',() => ({getCurrentDoctor:() => session.current}));
// Cross-workspace tests use the root React renderer; animation does not affect these navigation assertions.
vi.mock('framer-motion',() => ({motion:{span:({layoutId:_layoutId,transition:_transition,...props}) => <span {...props}/>}}));
afterEach(cleanup);
describe('shared portal redesign',() => {
  it('uses decorative artwork and audience-specific copy without invented statistics',() => {
    const {container, rerender}=render(<CareStory/>);
    expect(screen.getByText('YOUR PERSONAL CARE SPACE')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt','');
    expect(container.querySelector('source')).toHaveAttribute('media','(min-width:901px)');
    expect(screen.queryByText(/12,000|88%/)).not.toBeInTheDocument();
    rerender(<CareStory audience="professional"/>);
    expect(screen.getByText('FOR HEALTHCARE PROFESSIONALS')).toBeInTheDocument();
  });
  it('sends every professional to shared registration while keeping family caregiver onboarding separate',() => {
    render(<MemoryRouter><AccountTypeSelection/></MemoryRouter>);
    expect(screen.getByRole('link',{name:/Healthcare professional/})).toHaveAttribute('href',expect.stringContaining('/doctor-portal/register'));
    expect(screen.getByRole('link',{name:/Personal caregiver/})).toHaveAttribute('href','/signup/caregiver');
    expect(screen.getByRole('link',{name:/Patient Find care/})).toHaveAttribute('href','/signup/patient');
  });
  it('links the professional dashboard banner to existing availability',() => {
    render(<MemoryRouter><CareBanner/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Set your availability'})).toHaveAttribute('href','/availability');
  });
  it('keeps clinician navigation for doctors and separate care tools for counsellors',() => {
    session.current={professionType:'DOCTOR'};
    const onClose=vi.fn(), {rerender}=render(<MemoryRouter><Sidebar onClose={onClose}/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Prescriptions'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:'Manage Availability'}));
    expect(onClose).toHaveBeenCalled();
    session.current={professionType:'COUNSELLOR'};
    rerender(<MemoryRouter><Sidebar onClose={onClose}/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Counselling care'})).toBeInTheDocument();
    expect(screen.queryByRole('link',{name:'Prescriptions'})).not.toBeInTheDocument();
  });
});
