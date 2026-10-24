import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SabiBrand from './SabiBrand';

describe('official Sabi branding', () => {
  it('uses the supplied wordmark with an accessible name and preserves its proportions', () => {
    render(<SabiBrand width={150} />);
    const brand = screen.getByRole('img', { name: 'Sabi Health' });
    expect(brand).toHaveStyle({ width: '150px', maxWidth: '100%' });
    const artwork = brand.querySelector('img')!;
    expect(artwork.src).toContain('sabi-wordmark.webp');
    expect(artwork).toHaveAttribute('alt', '');
    expect(artwork).toHaveAttribute('height', '163');
    expect(artwork).toHaveStyle({ objectFit: 'contain', height: 'auto' });
  });

  it('uses the supplied symbol on compact dark surfaces without recolouring it', () => {
    render(<SabiBrand symbol size={32} inverse />);
    const brand = screen.getByRole('img', { name: 'Sabi Health' });
    expect(brand).toHaveStyle({ width: '32px', height: '32px', background: '#fff' });
    expect(brand.querySelector('img')!.src).toContain('sabi-symbol.webp');
  });
});
