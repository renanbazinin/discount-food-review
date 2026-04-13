import { error, type RequestEvent } from '@sveltejs/kit';

const MAX_LEN = 256;

export function getUserId(event: RequestEvent): string {
  const raw = event.request.headers.get('x-user-id');
  if (!raw || typeof raw !== 'string') {
    throw error(400, 'Missing x-user-id header');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LEN) {
    throw error(400, 'Invalid x-user-id header');
  }
  return trimmed;
}
