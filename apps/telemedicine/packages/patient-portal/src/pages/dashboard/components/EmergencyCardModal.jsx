import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EmergencyCardSection } from '../../../emergency/EmergencyCardSection';

export function EmergencyCardModal({ onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    const key = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled)')];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="sabi-modal-overlay" onClick={onClose}>
    <div ref={dialog} className="sabi-modal ec-modal" role="dialog" aria-modal="true" aria-label="Emergency Card" onClick={(e) => e.stopPropagation()}>
      <div className="sabi-modal-head"><h3>Emergency Card</h3><button type="button" className="sabi-modal-close" aria-label="Close Emergency Card" onClick={onClose}><X size={20} /></button></div>
      <EmergencyCardSection previewInitially />
    </div>
  </div>;
}
export default EmergencyCardModal;
