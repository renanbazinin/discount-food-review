export type OrderMethod = 'regular' | 'telbank';

export interface Dish {
  id: string;
  rootId: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  imageUrl: string | null;
  category: string;
  popularity: number;
  isPopular: boolean;
  orderMethod: OrderMethod;
  restaurantId: number;
  restaurantName: string;
}

export interface Restaurant {
  id: number;
  name: string;
  dishes: Dish[];
}

export interface CatalogDataset {
  restaurants: Restaurant[];
}

export interface RatingAggregate {
  dishId: string;
  averageStars: number;
  ratingCount: number;
}

export interface MyRating {
  dishId: string;
  stars: number;
  timestamp: number;
}
