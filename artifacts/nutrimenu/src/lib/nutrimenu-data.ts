import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  MenuItem,
  OwnerWorkspace,
  RestaurantProfile,
  RestaurantSettings,
} from './types';

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  website: string;
};

type MenuRow = {
  id: string;
  restaurant_id: string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  serving_size: string;
  category: string;
  image: string;
  calories: number | string;
  protein: number | string;
  carbohydrates: number | string;
  fat: number | string;
  fiber: number | string;
  sugar: number | string;
  sodium: number | string;
  cholesterol: number | string;
  saturated_fat: number | string;
  dietary_options: string[] | null;
  allergens: string[] | null;
  published: boolean;
  created_at: string;
};

type SettingsRow = {
  nutrition_units: 'US customary' | 'Metric';
  menu_update_reminders: boolean;
};

export type PublicMenuData = {
  restaurant: RestaurantProfile | null;
  items: MenuItem[];
};

const toRestaurant = (row: RestaurantRow): RestaurantProfile => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  location: row.location,
  website: row.website,
});

const toMenuItem = (row: MenuRow): MenuItem => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  price: Number(row.price),
  servingSize: row.serving_size,
  category: row.category,
  image: row.image,
  calories: Number(row.calories),
  protein: Number(row.protein),
  carbohydrates: Number(row.carbohydrates),
  fat: Number(row.fat),
  fiber: Number(row.fiber),
  sugar: Number(row.sugar),
  sodium: Number(row.sodium),
  cholesterol: Number(row.cholesterol),
  saturatedFat: Number(row.saturated_fat),
  dietaryOptions: row.dietary_options ?? [],
  allergens: row.allergens ?? [],
  published: row.published,
  createdAt: row.created_at.slice(0, 10),
});

const toMenuRow = (restaurantId: string, item: MenuItem) => ({
  id: item.id,
  restaurant_id: restaurantId,
  name: item.name,
  slug: item.slug,
  description: item.description,
  price: item.price,
  serving_size: item.servingSize,
  category: item.category,
  image: item.image,
  calories: item.calories,
  protein: item.protein,
  carbohydrates: item.carbohydrates,
  fat: item.fat,
  fiber: item.fiber,
  sugar: item.sugar,
  sodium: item.sodium,
  cholesterol: item.cholesterol,
  saturated_fat: item.saturatedFat,
  dietary_options: item.dietaryOptions,
  allergens: item.allergens,
  published: item.published,
  created_at: item.createdAt,
});

export function explainSupabaseError(error: unknown): string {
  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.code === '42P01' || candidate?.code === 'PGRST205') {
    return 'NutriMenu tables are not installed in this Supabase project yet. Run artifacts/nutrimenu/supabase/setup.sql in the Supabase SQL Editor, then reload.';
  }
  if (candidate?.code === '42501') {
    return 'Supabase blocked this request. Check the NutriMenu row-level security policies in setup.sql.';
  }
  return candidate?.message || 'Supabase request failed. Check the project connection and try again.';
}

export async function loadOwnerWorkspace(user: User): Promise<OwnerWorkspace> {
  const { data: ownership, error: ownershipError } = await supabase
    .from('restaurant_owners')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (ownershipError) throw new Error(explainSupabaseError(ownershipError));
  if (!ownership) {
    throw new Error('No restaurant workspace is linked to this account. Sign out and register a restaurant account.');
  }

  const restaurantId = ownership.restaurant_id as string;
  const [restaurantResult, settingsResult, categoryResult, menuResult] = await Promise.all([
    supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
    supabase.from('restaurant_settings').select('*').eq('restaurant_id', restaurantId).single(),
    supabase.from('restaurant_categories').select('name').eq('restaurant_id', restaurantId).order('position'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
  ]);

  for (const result of [restaurantResult, settingsResult, categoryResult, menuResult]) {
    if (result.error) throw new Error(explainSupabaseError(result.error));
  }

  const categories = (categoryResult.data ?? []).map((row) => row.name as string);
  return {
    restaurant: toRestaurant(restaurantResult.data as RestaurantRow),
    settings: {
      nutritionUnits: (settingsResult.data as SettingsRow).nutrition_units,
      menuUpdateReminders: (settingsResult.data as SettingsRow).menu_update_reminders,
    },
    categories,
    items: ((menuResult.data ?? []) as MenuRow[]).map(toMenuItem),
  };
}

export async function loadPublicMenu(slug: string): Promise<PublicMenuData> {
  const { data: restaurantRow, error: restaurantError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (restaurantError) throw new Error(explainSupabaseError(restaurantError));
  if (!restaurantRow) return { restaurant: null, items: [] };

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantRow.id)
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(explainSupabaseError(error));

  return {
    restaurant: toRestaurant(restaurantRow as RestaurantRow),
    items: ((data ?? []) as MenuRow[]).map(toMenuItem),
  };
}

export async function persistMenuDiff(
  restaurantId: string,
  previous: MenuItem[],
  next: MenuItem[],
): Promise<void> {
  const nextIds = new Set(next.map((item) => item.id));
  const removedIds = previous.filter((item) => !nextIds.has(item.id)).map((item) => item.id);
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const changed = next.filter((item) => {
    const old = previousById.get(item.id);
    return !old || JSON.stringify(old) !== JSON.stringify(item);
  });

  if (changed.length) {
    const { error } = await supabase
      .from('menu_items')
      .upsert(changed.map((item) => toMenuRow(restaurantId, item)), { onConflict: 'id' });
    if (error) throw new Error(explainSupabaseError(error));
  }
  if (removedIds.length) {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('restaurant_id', restaurantId)
      .in('id', removedIds);
    if (error) throw new Error(explainSupabaseError(error));
  }
}

export async function persistCategories(
  restaurantId: string,
  previous: string[],
  next: string[],
): Promise<void> {
  const nextNames = new Set(next);
  const removed = previous.filter((name) => !nextNames.has(name));
  if (removed.length) {
    const { error } = await supabase
      .from('restaurant_categories')
      .delete()
      .eq('restaurant_id', restaurantId)
      .in('name', removed);
    if (error) throw new Error(explainSupabaseError(error));
  }

  const rows = next.map((name, position) => ({ restaurant_id: restaurantId, name, position }));
  if (rows.length) {
    const { error } = await supabase
      .from('restaurant_categories')
      .upsert(rows, { onConflict: 'restaurant_id,name' });
    if (error) throw new Error(explainSupabaseError(error));
  }
}

export async function updateRestaurantProfile(
  restaurantId: string,
  values: Pick<RestaurantProfile, 'name' | 'description' | 'location' | 'website'>,
): Promise<RestaurantProfile> {
  const { data, error } = await supabase
    .from('restaurants')
    .update(values)
    .eq('id', restaurantId)
    .select('*')
    .single();
  if (error) throw new Error(explainSupabaseError(error));
  return toRestaurant(data as RestaurantRow);
}

export async function updateRestaurantSettings(
  restaurantId: string,
  settings: RestaurantSettings,
): Promise<void> {
  const { error } = await supabase
    .from('restaurant_settings')
    .update({
      nutrition_units: settings.nutritionUnits,
      menu_update_reminders: settings.menuUpdateReminders,
    })
    .eq('restaurant_id', restaurantId);
  if (error) throw new Error(explainSupabaseError(error));
}
