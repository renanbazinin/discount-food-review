import type { RatingAggregate, MyRating } from '$lib/types';

export interface RatingsStore {
  getLeaderboard(): Promise<RatingAggregate[]>;
  getMyRatings(): Promise<MyRating[]>;
  rate(dishId: string, stars: number): Promise<MyRating>;
  clear(dishId: string): Promise<void>;
}
