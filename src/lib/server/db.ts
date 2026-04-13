import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import { env } from '$env/dynamic/private';

export interface RatingDoc {
  _id: ObjectId;
  userId: string;
  dishId: string;
  stars: number;
  timestamp: number;
}

export interface Collections {
  ratings: Collection<RatingDoc>;
}

let cached: { client: MongoClient; collections: Collections } | null = null;

async function ensureIndexes(db: Db): Promise<void> {
  const ratings = db.collection<RatingDoc>('ratings');
  await ratings.createIndex({ userId: 1, dishId: 1 }, { unique: true });
  await ratings.createIndex({ dishId: 1 });
}

async function dropLegacyVotes(db: Db): Promise<void> {
  try {
    await db.collection('votes').drop();
    console.log('[db] dropped legacy votes collection');
  } catch (e: unknown) {
    // ns not found (code 26) is fine — collection already gone
    const code = (e as { code?: number })?.code;
    if (code !== 26) {
      console.warn('[db] non-fatal legacy drop error:', e);
    }
  }
}

export async function getCollections(): Promise<Collections> {
  if (cached) return cached.collections;

  const uri = env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill in the connection string.');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('food-ranking');
  await dropLegacyVotes(db);
  await ensureIndexes(db);

  const collections: Collections = {
    ratings: db.collection<RatingDoc>('ratings')
  };
  cached = { client, collections };
  return collections;
}
