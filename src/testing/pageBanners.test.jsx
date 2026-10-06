import React from 'react';
import {describe, it, expect} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {afterEach} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import PageBanner from '../../apps/telemedicine/packages/shared-portal/PageBanner';
import {patientBanners, doctorBanners, resolvePageBanner} from '../../apps/telemedicine/packages/shared-portal/pageBannerCatalog';

afterEach(cleanup);
function Location() {return <output data-testid="location">{useLocation().pathname}</output>;}

describe('page-specific banner coverage', () => {
  it.each([...patientBanners, ...doctorBanners].map(page => [page.audience, page.id, page]))('%s %s resolves its screen template', (audience, id, page) => {
    const path = '/' + page.route.replace(/:[^/]+/g, 'example');
    const profession = id === 'nutrition-workspace' ? 'NUTRITIONIST_DIETITIAN' : 'DOCTOR';
    expect(resolvePageBanner(audience, path, profession)?.id).toBe(id);
    expect(page.to).toMatch(/^\/(?!.*:)/);
    expect(page.action.length).toBeGreaterThan(2);
  });
  it.each([
    ['/pharmacy-market/prescription','medicine-prescription'],
    ['/family/hospital-enrollment','family-hospital'],
    ['/hospitals/check-in/example','hospital-checkin'],
    ['/vitals/add','vital-select'],
    ['/prescriptions/dietician-table','dietician'],
    ['/family/join','family-add'],
    ['/order-confirmation/example','order-confirmation'],
  ])('selects the specific patient route %s', (path,id) => expect(resolvePageBanner('patient',path)?.id).toBe(id));
  it.each(['/login','/signup/patient','/registration/status','/unknown'])('does not add workspace artwork on %s', path => {
    expect(resolvePageBanner('patient',path)).toBeNull();
    expect(resolvePageBanner('doctor',path)).toBeNull();
  });
  it('uses independent artwork identifiers for every screen', () => {
    const keys = [...patientBanners,...doctorBanners].map(page => `${page.audience}-${page.id}`);
    expect(new Set(keys).size).toBe(71);
  });
  it('ships a distinct, nonempty WebP for every catalog entry', () => {
    const directory = resolve('apps/telemedicine/packages/shared-portal/assets/page-banners');
    const files = readdirSync(directory).filter(name => name.endsWith('.webp'));
    const expected = [...patientBanners,...doctorBanners].map(page => `${page.audience}-${page.id}-v1.webp`);
    expect(files.sort()).toEqual(expected.sort());
    const hashes = files.map(name => {
      const bytes = readFileSync(join(directory,name));
      expect(bytes.length).toBeGreaterThan(10000);
      expect(bytes.toString('ascii',8,12)).toBe('WEBP');
      return createHash('sha256').update(bytes).digest('hex');
    });
    expect(new Set(hashes).size).toBe(71);
  });
  it('shows useful, working patient actions and decorative artwork', () => {
    const {container} = render(<MemoryRouter initialEntries={['/dashboard']}><PageBanner/><Location/></MemoryRouter>);
    expect(screen.getByRole('region',{name:'Page introduction'})).toHaveAttribute('data-banner-id','patient-overview');
    expect(screen.getByRole('link',{name:'Health records'})).toHaveAttribute('href','/records');
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt','');
    expect(img).toHaveAttribute('fetchpriority','low');
    fireEvent.click(screen.getByRole('link',{name:'Health records'}));
    expect(screen.getByTestId('location')).toHaveTextContent('/records');
    expect(screen.getByRole('region',{name:'Page introduction'})).toHaveAttribute('data-banner-id','patient-records');
  });
  it('provides safe professional navigation without changing care permissions', () => {
    render(<MemoryRouter initialEntries={['/availability']}><PageBanner audience="doctor"/><Location/></MemoryRouter>);
    expect(screen.getByRole('link',{name:/Practice overview/})).toHaveAttribute('href','/dashboard');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:/Practice overview/}));
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});
