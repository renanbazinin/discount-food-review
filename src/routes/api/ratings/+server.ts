import { json, error } from '@sveltejs/kit';
import { getCollections } from '$lib/server/db';
import { getUserId } from '$lib/server/userId';
import type { MyRating } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const userId = getUserId(event);

  try {
    const { ratings } = await getCollections();
    const docs = await ratings
      .find({ userId })
      .project<{ dishId: string; stars: number; timestamp: number }>({
        _id: 0,
        userId: 0
      })
      .toArray();
    const result: MyRating[] = docs.map((d) => ({
      dishId: d.dishId,
      stars: d.stars,
      timestamp: d.timestamp
    }));
    return json(result);
  } catch (e) {
    console.error('[ratings GET]', e);
    throw error(503, 'Database unreachable');
  }
};
