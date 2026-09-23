import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createBlankApplication } from '../domain';
import { DocumentsStep } from './ComplianceSteps';

vi.mock('@/config/runtime', () => ({ apiConfigured: true }));

describe('live organization document step', () => {
  it('explains the evidence requirements without collecting files', () => {
    const onNext = vi.fn();
    render(<DocumentsStep application={createBlankApplication()} update={vi.fn()} onNext={onNext} setMessage={vi.fn()}/>);
    expect(screen.getByText(/Secure document collection is not connected/)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue without uploading' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
