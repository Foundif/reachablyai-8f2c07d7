import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Integrations from './Integrations';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), workspace: vi.fn(),
  auth: { user: { id: 'owner-test' }, profile: { active_workspace_id: 'workspace-test' } },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/workspace', () => ({ resolveWorkspaceId: mocks.workspace }));
vi.mock('@/components/layout/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'abortSignal']) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve);
  return builder;
}
const openPage = () => render(<MemoryRouter><Integrations /></MemoryRouter>);

describe('Integrations load recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspace.mockResolvedValue('workspace-test');
    mocks.from.mockImplementation(() => query({ data: [], error: null }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('exposes a database error and recovers on retry instead of treating it as no integrations', async () => {
    mocks.from.mockImplementation(() => query({ data: null, error: { message: 'Connection unavailable' } }));
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
    expect(screen.queryByText('Available Integrations')).not.toBeInTheDocument();
    mocks.from.mockImplementation(() => query({ data: [], error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Available Integrations')).toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledWith('webhook_endpoints');
  });

  it('stops a stalled workspace lookup after eight seconds', async () => {
    vi.useFakeTimers();
    mocks.workspace.mockImplementation(() => new Promise(() => {}));
    openPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByRole('alert')).toHaveTextContent('The connection took too long');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('does not allow setup actions when there is no workspace', async () => {
    mocks.workspace.mockResolvedValue(null);
    openPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No workspace is available');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});