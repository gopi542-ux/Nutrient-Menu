export type MenuItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  servingSize: string;
  category: string;
  image: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturatedFat: number;
  dietaryOptions: string[];
  allergens: string[];
  published: boolean;
  createdAt: string;
};

export type RestaurantProfile = {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  website: string;
};

export type RestaurantSettings = {
  nutritionUnits: 'US customary' | 'Metric';
  menuUpdateReminders: boolean;
};

export type OwnerWorkspace = {
  restaurant: RestaurantProfile;
  settings: RestaurantSettings;
  categories: string[];
  items: MenuItem[];
};
