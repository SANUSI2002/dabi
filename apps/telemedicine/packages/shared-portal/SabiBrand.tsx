import type { CSSProperties } from 'react';
import wordmark from './assets/sabi-wordmark.webp';
import symbolImage from './assets/sabi-symbol.webp';

/** The owner-supplied artwork, shared by every Sabi surface. */
export default function SabiBrand({ symbol = false, size = 36, width = 160, inverse = false, className = '', style }: {
  symbol?: boolean; size?: number; width?: number; inverse?: boolean; className?: string; style?: CSSProperties;
}) {
  return <span role="img" aria-label="Sabi Health" className={`sabi-official-brand ${className}`} style={{
    display: 'inline-flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    width: symbol ? size : width, height: symbol ? size : undefined, maxWidth: '100%',
    background: 'transparent', padding: 0, borderRadius: 0,
    ...(inverse ? { background: '#fff', borderRadius: 10, padding: symbol ? 4 : '6px 10px', boxSizing: 'content-box' as const } : {}),
    ...style,
  }}><img src={symbol ? symbolImage : wordmark} alt="" aria-hidden="true" width={symbol ? 256 : 720} style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }} /></span>;
}
