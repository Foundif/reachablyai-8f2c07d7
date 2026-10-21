import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadFieldMapping } from './LeadFieldMapping';

const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'abortSignal']) builder[method] = () => builder;
  builder.update = mocks.update;
  builder.maybeSingle = () => Promise.resolve(result);
  return builder;
}

describe('Lead field mapping persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  it('writes the mapping while preserving the latest saved settings, not stale screen settings', async () => {
    const saved = vi.fn();
    mocks.from.mockReturnValueOnce(query({ data: { settings: { leads_received: 12, verify_token: 'latest' } }, error: null }));
    const write = query({ data: { id: 'integration-test' }, error: null });
    mocks.from.mockReturnValueOnce(write);
    mocks.update.mockReturnValue(write);
    render(<LeadFieldMapping integrationId="integration-test" settings={{ leads_received: 1,
      field_map: [{ question: '  Your contact name  ', target: 'name' }] }} onSaved={saved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save mapping' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({ settings: { leads_received: 12, verify_token: 'latest',
      field_map: [{ question: 'Your contact name', target: 'name' }] } });
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it('does not claim success when access rules prevent updating any row', async () => {
    const saved = vi.fn();
    mocks.from.mockReturnValueOnce(query({ data: { settings: {} }, error: null }));
    const write = query({ data: null, error: null });
    mocks.from.mockReturnValueOnce(write);
    mocks.update.mockReturnValue(write);
    render(<LeadFieldMapping integrationId="integration-test" settings={{}} onSaved={saved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save mapping' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save mapping' })).toBeEnabled();
  });

  it('retains entered questions after a read failure and unlocks retry', async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { message: 'Connection unavailable' } }));
    render(<LeadFieldMapping integrationId="integration-test" settings={{ field_map: [{ question: 'Name', target: 'name' }] }} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Customer name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save mapping' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    expect(screen.getByRole('textbox')).toHaveValue('Customer name');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save mapping' })).toBeEnabled();
  });
});