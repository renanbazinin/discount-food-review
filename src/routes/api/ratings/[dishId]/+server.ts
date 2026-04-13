import { json, error, isHttpError } from '@sveltejs/kit';
import { getCollections } from '$lib/server/db';
import { getUserId } from '$lib/server/userId';
import { hasDish } from '$lib/server/catalog';
import type { RequestHandler } from './$types';

interface PutBody {
  stars?: unknown;
}

export const PUT: RequestHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const dishId = event.params.dishId;
    if (!dishId || !hasDish(dishId)) {
      throw error(400, `Unknown dishId: ${dishId}`);
    }

    let body: PutBody;
    try {
      body = (await event.request.json()) as PutBody;
    } catch {
      throw error(400, 'Invalid JSON body');
    }
    const stars = body.stars;
    if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 10) {
      throw error(400, 'stars must be an integer between 1 and 10');
    }

    const { ratings } = await getCollections();
    const timestamp = Date.now();
    await ratings.updateOne(
      { userId, dishId },
      { $set: { userId, dishId, stars, timestamp } },
      { upsert: true }
    );
    return json({ dishId, stars, timestamp });
  } catch (e) {
    if (isHttpError(e)) throw e;
    console.error('[ratings PUT]', e);
    throw error(503, 'Database unreachable');
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const dishId = event.params.dishId;
    if (!dishId) {
      throw error(400, 'Missing dishId');
    }

    const { ratings } = await getCollections();
    await ratings.deleteOne({ userId, dishId });
    return new Response(null, { status: 204 });
  } catch (e) {
    if (isHttpError(e)) throw e;
    console.error('[ratings DELETE]', e);
    throw error(503, 'Database unreachable');
  }
};
