import React from 'react';
import {Link, useLocation} from 'react-router-dom';
import {ArrowUpRight, ArrowLeft} from 'lucide-react';
import {resolvePageBanner} from './pageBannerCatalog';

// Eager URL imports bundle only filenames. The browser downloads the current
// page's image, never the whole collection; WebP assets remain cacheable.
const artwork = import.meta.glob('./assets/page-banners/*.webp', {eager:true, query:'?url', import:'default'});
export default function PageBanner({audience = 'patient', professionType = 'DOCTOR'}) {
  const {pathname} = useLocation();
  const page = resolvePageBanner(audience, pathname, professionType);
  if (!page) return null;
  const image = artwork[`./assets/page-banners/${audience}-${page.id}-v1.webp`];
  const overview = pathname === '/dashboard';
  const secondary = overview
    ? {to:audience === 'doctor' ? '/appointments' : '/records',label:audience === 'doctor' ? 'My appointments' : 'Health records'}
    : {to:'/dashboard',label:audience === 'doctor' ? 'Practice overview' : 'My overview'};
  return <section className={`sabi-page-banner sabi-page-banner-${audience}`} aria-label="Page introduction" data-banner-id={`${audience}-${page.id}`}>
    {image && <img className="sabi-page-banner-art" src={image} alt="" width="1536" height="1024" decoding="async" fetchPriority="low"/>}
    <div className="sabi-page-banner-copy">
      <span className="sabi-page-banner-eyebrow">{audience === 'doctor' ? 'YOUR PRACTICE, WITH PURPOSE' : 'CARE THAT FITS YOUR WORLD'}</span>
      <h2>{page.title}</h2><p>{page.description}</p>
      <div className="sabi-page-banner-actions"><Link className="sabi-page-banner-primary" to={page.to}>{page.action}<ArrowUpRight size={17}/></Link><Link className="sabi-page-banner-secondary" to={secondary.to}>{!overview && <ArrowLeft size={15}/>} {secondary.label}</Link></div>
    </div>
  </section>;
}
