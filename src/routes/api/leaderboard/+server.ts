import { json, error } from '@sveltejs/kit';
import { getCollections } from '$lib/server/db';
import { getUserId } from '$lib/server/userId';
import type { RatingAggregate } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  getUserId(event); // enforce header presence; result not used

  try {
    const { ratings } = await getCollections();
    const agg = await ratings
      .aggregate<{ _id: string; averageStars: number; ratingCount: number }>([
        {
          $group: {
            _id: '$dishId',
            averageStars: { $avg: '$stars' },
            ratingCount: { $sum: 1 }
          }
        }
      ])
      .toArray();
    const result: RatingAggregate[] = agg.map((r) => ({
      dishId: r._id,
      averageStars: r.averageStars,
      ratingCount: r.ratingCount
    }));
    return json(result);
  } catch (e) {
    console.error('[leaderboard]', e);
    throw error(503, 'Database unreachable');
  }
};
