import React, { useState } from 'react';
import { Card } from 'design-system';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { EmergencyCardModal } from './EmergencyCardModal';
import { useApiData } from '../../../api/useApiData';
import { getEmergencyCard } from '../../../api/emergencyCardApi';
import '../../../emergency/EmergencyCard.css';

export function EmergencyCard() {
  const [showModal, setShowModal] = useState(false);
  const { data, loading, error } = useApiData(getEmergencyCard, [showModal]);
  return <Card className="sabi-emergency-card">
    <div className="sabi-emergency-head"><span className="sabi-emergency-label">SABI EMERGENCY CARD</span><ShieldCheck size={22} aria-hidden="true" /></div>
    <p>{data?.displayName || 'Your emergency identity'}</p>
    <p className="ec-readable-code">{data?.code || (loading ? 'Loading…' : 'Card unavailable')}</p>
    <p>{error ? 'Open your card to retry.' : data?.sharingEnabled ? 'Sharing on · eligible users only' : 'Sharing off · your consent is required'}</p>
    <button className="sabi-emergency-link" type="button" onClick={() => setShowModal(true)}>View Emergency Card <ArrowRight size={16} aria-hidden="true" /></button>
    {showModal && <EmergencyCardModal onClose={() => setShowModal(false)} />}
  </Card>;
}
export default EmergencyCard;
