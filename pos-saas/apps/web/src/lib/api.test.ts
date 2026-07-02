import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, API_BASE } from '@/lib/api';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('construye la URL correctamente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiFetch('/auth/status');

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/auth/status`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('agrega Authorization header cuando recibe token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiFetch('/auth/status', { token: 'my-token' });

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/auth/status`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      },
    });
  });

  it('mergea headers adicionales', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiFetch('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ test: true }),
      token: 'my-token',
    });

    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      },
      body: JSON.stringify({ test: true }),
    });
  });

  it('lanza error cuando la respuesta no es ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    } as Response);

    await expect(apiFetch('/auth/status')).rejects.toThrow('Unauthorized');
  });

  it('lanza error generico si el body de error no tiene message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response);

    await expect(apiFetch('/test')).rejects.toThrow('Error 500');
  });
});
