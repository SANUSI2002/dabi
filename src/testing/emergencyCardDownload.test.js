import { afterEach, describe, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import { printableCardSvg, downloadPrintableCard, downloadLockScreenCard } from '../../apps/telemedicine/packages/patient-portal/src/emergency/emergencyCardDownload';
import { emergencyAccessUrl } from '../../apps/telemedicine/packages/patient-portal/src/emergency/emergencyCardNotification';
const card = { displayName: 'Ada & <Synthetic>', code: 'EC-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF' };
afterEach(() => { vi.restoreAllMocks(); });
describe('downloaded emergency cards', () => {
  it('includes a real QR, only identity/code/instructions and XML-escaped chosen name at wallet size', async () => {
    const qr = await QRCode.toString(emergencyAccessUrl(card.code), { type: 'svg', margin: 4 });
    const svg = printableCardSvg(card, qr);
    expect(svg).toContain('width="85.6mm" height="54mm"');
    expect(svg).toContain('Ada &amp; &lt;Synthetic&gt;');
    expect(svg).toContain('EC-AAAA-BBBB-CCCC'); expect(svg).toContain('DDDD-EEEE-FFFF');
    expect(svg).toContain('scan, sign in to Sabi'); expect(svg).toContain('<path');
    expect(svg).not.toMatch(/Bearer|allerg|diagnos/);
  });
  it('encodes the actual controlled URL, and downloads a printable SVG', async () => {
    const qr = vi.spyOn(QRCode, 'toString');
    URL.createObjectURL = vi.fn(() => 'blob:synthetic'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadPrintableCard(card);
    expect(qr).toHaveBeenCalledWith(emergencyAccessUrl(card.code), expect.objectContaining({ type: 'svg' }));
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('image/svg+xml');
    expect(click).toHaveBeenCalledOnce();
  });
  it('creates a lock-screen PNG with matching QR and no clinical information', async () => {
    const text = []; const context = { fillRect: vi.fn(), fillText: (value) => text.push(value), measureText: (value) => ({ width: value.length * 44 }), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['synthetic'], { type: 'image/png' })));
    const qr = vi.spyOn(QRCode, 'toCanvas').mockResolvedValue(undefined);
    URL.createObjectURL = vi.fn(() => 'blob:synthetic'); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadLockScreenCard(card);
    expect(qr).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), emergencyAccessUrl(card.code), expect.any(Object));
    expect(text).toContain(card.displayName); expect(text).toContain('EC-AAAA-BBBB-CCCC'); expect(text).toContain('DDDD-EEEE-FFFF');
    expect(text.join(' ')).not.toMatch(/allerg|diagnos|medication/);
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('image/png');
  });
});
