import QRCode from 'qrcode';
import { emergencyAccessUrl } from './emergencyCardNotification';
const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const chunks = (text, length) => String(text || '').match(new RegExp(`.{1,${length}}`, 'g')) || [];
const fittedLines = (ctx, text, width) => {
  const lines = []; let line = '';
  for (const char of Array.from(String(text || ''))) {
    if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
};
export function printableCardSvg(card, qrSvg) {
  const code = card.code.split('-');
  const lines = [`${code[0]}-${code.slice(1, 4).join('-')}`, code.slice(4).join('-')];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="85.6mm" height="54mm" viewBox="0 0 1011 638" role="img" aria-label="Sabi Emergency Card">
    <rect width="1011" height="638" rx="32" fill="#113c30"/>
    <text x="48" y="70" fill="#70efbb" font-size="32" font-family="Arial,sans-serif" font-weight="700">SABI HEALTH · EMERGENCY CARD</text>
    ${chunks(card.displayName, 30).slice(0, 4).map((line, i) => `<text x="48" y="${130 + i * 35}" fill="white" font-size="28" font-family="Arial,sans-serif">${escape(line)}</text>`).join('')}
    ${lines.map((line, i) => `<text x="48" y="${320 + i * 50}" fill="white" font-size="40" font-family="monospace" font-weight="700">${escape(line)}</text>`).join('')}
    <g transform="translate(710,270)">${qrSvg.replace('<svg ', '<svg width="245" height="245" ')}</g>
    <text x="48" y="465" fill="white" font-size="23" font-family="Arial,sans-serif">Eligible Care Circle members and clinical hospital staff:</text>
    <text x="48" y="500" fill="white" font-size="23" font-family="Arial,sans-serif">scan, sign in to Sabi, and enter this code.</text>
    <text x="48" y="570" fill="#70efbb" font-size="22" font-family="Arial,sans-serif">The code alone does not grant access to medical information.</text>
  </svg>`;
}
const download = (blob, filename) => {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export async function downloadPrintableCard(card) {
  const svg = await QRCode.toString(emergencyAccessUrl(card.code), { type: 'svg', margin: 4, errorCorrectionLevel: 'M' });
  download(new Blob([printableCardSvg(card, svg)], { type: 'image/svg+xml' }), 'sabi-emergency-wallet-card.svg');
}
export async function downloadLockScreenCard(card) {
  const canvas = document.createElement('canvas'); canvas.width = 1170; canvas.height = 2532;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image downloads are unavailable in this browser. Try the printable card.');
  ctx.fillStyle = '#113c30'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#70efbb'; ctx.font = 'bold 44px Arial'; ctx.fillText('SABI HEALTH', 85, 520);
  ctx.fillStyle = 'white'; ctx.font = 'bold 76px Arial'; ctx.fillText('Emergency Card', 85, 635);
  ctx.font = '44px Arial'; fittedLines(ctx, card.displayName, 1000).forEach((line, i) => ctx.fillText(line, 85, 745 + i * 52));
  ctx.font = 'bold 54px monospace'; const pieces = card.code.split('-');
  ctx.fillText(`${pieces[0]}-${pieces.slice(1, 4).join('-')}`, 85, 1090);
  ctx.fillText(pieces.slice(4).join('-'), 85, 1160);
  const qr = document.createElement('canvas'); await QRCode.toCanvas(qr, emergencyAccessUrl(card.code), { width: 520, margin: 4, errorCorrectionLevel: 'M' });
  ctx.drawImage(qr, 325, 1310, 520, 520);
  ctx.font = '34px Arial'; ctx.fillStyle = 'white';
  ['Eligible Care Circle members and authorised', 'clinical staff of verified Sabi hospitals:', 'scan this QR or enter the code in Sabi.', 'Sign-in and permission checks are required.'].forEach((line, i) => ctx.fillText(line, 85, 1950 + i * 52));
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be created. Please try again.');
  download(blob, 'sabi-emergency-lock-screen.png');
}
