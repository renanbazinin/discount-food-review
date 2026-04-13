import type { MyRating, RatingAggregate } from '$lib/types';
import type { RatingsStore } from './ratings-store';

const USER_KEY = 'user:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function generateUuid(): string {
  if (isBrowser() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getUserId(): string {
  if (!isBrowser()) return 'ssr';
  const raw = window.localStorage.getItem(USER_KEY);
  if (typeof raw === 'string' && raw.length > 0 && raw.length < 256) {
    return raw;
  }
  const fresh = generateUuid();
  window.localStorage.setItem(USER_KEY, fresh);
  return fresh;
}

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.text();
  throw new Error(`HTTP ${res.status}: ${body || res.statusText}`);
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  return { 'x-user-id': getUserId(), ...extra };
}

export class HttpRatingsStore implements RatingsStore {
  async getLeaderboard(): Promise<RatingAggregate[]> {
    const res = await fetch('/api/leaderboard', { headers: headers() });
    await throwOnError(res);
    return res.json();
  }

  async getMyRatings(): Promise<MyRating[]> {
    const res = await fetch('/api/ratings', { headers: headers() });
    await throwOnError(res);
    return res.json();
  }

  async rate(dishId: string, stars: number): Promise<MyRating> {
    const res = await fetch(`/api/ratings/${encodeURIComponent(dishId)}`, {
      method: 'PUT',
      headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ stars })
    });
    await throwOnError(res);
    return res.json();
  }

  async clear(dishId: string): Promise<void> {
    const res = await fetch(`/api/ratings/${encodeURIComponent(dishId)}`, {
      method: 'DELETE',
      headers: headers()
    });
    await throwOnError(res);
  }
}

export const ratingsStore: RatingsStore = new HttpRatingsStore();
