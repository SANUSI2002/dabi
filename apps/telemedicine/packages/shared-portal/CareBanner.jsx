import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import artwork from './assets/wellness-at-home-v1.png';

export default function CareBanner() {
  return <section className="sabi-care-banner"><div><span className="sabi-care-eyebrow">CARE STARTS WITH CONNECTION</span><h2>A little more space for better care.</h2><p>Keep your schedule clear, your appointments organised and your focus on the people you care for.</p><Link className="dp-btn dp-btn-primary" to="/availability">Set your availability <ArrowUpRight size={16}/></Link></div><img src={artwork} width="1536" height="1024" alt="" decoding="async"/></section>;
}
