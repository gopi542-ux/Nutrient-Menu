import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  loadOwnerWorkspace,
  persistCategories,
  persistMenuDiff,
  updateRestaurantProfile,
  updateRestaurantSettings,
} from '@/lib/nutrimenu-data';
import type { MenuItem, OwnerWorkspace, RestaurantProfile, RestaurantSettings } from '@/lib/types';

type MenuItemsUpdate = MenuItem[] | ((current: MenuItem[]) => MenuItem[]);
type CategoriesUpdate = string[] | ((current: string[]) => string[]);

const messageFrom = (reason: unknown) =>
  reason instanceof Error ? reason.message : 'Could not save your changes to Supabase.';

export function useOwnerWorkspace(user: User | null) {
  const [workspace, setWorkspace] = useState<OwnerWorkspace | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const workspaceRef = useRef<OwnerWorkspace | null>(null);
  const persistedItems = useRef(new Map<string, MenuItem[]>());
  const persistedCategories = useRef(new Map<string, string[]>());
  const menuQueue = useRef<Promise<void>>(Promise.resolve());
  const categoryQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    if (!user) {
      workspaceRef.current = null;
      setWorkspace(null);
      setLoading(false);
      setLoadError('');
      setSaveError('');
      return;
    }

    setLoading(true);
    setLoadError('');
    loadOwnerWorkspace(user)
      .then((loaded) => {
        if (!active) return;
        workspaceRef.current = loaded;
        persistedItems.current.set(loaded.restaurant.id, loaded.items);
        persistedCategories.current.set(loaded.restaurant.id, loaded.categories);
        setWorkspace(loaded);
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(messageFrom(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const setItems = useCallback((update: MenuItemsUpdate): Promise<void> => {
    const current = workspaceRef.current;
    if (!current) return Promise.reject(new Error('Your restaurant workspace is still loading.'));
    const nextItems = typeof update === 'function' ? update(current.items) : update;
    if (nextItems === current.items) return Promise.resolve();

    workspaceRef.current = { ...current, items: nextItems };
    setWorkspace(workspaceRef.current);
    setSaveError('');

    const restaurantId = current.restaurant.id;
    const task = menuQueue.current.then(async () => {
      const previouslySaved = persistedItems.current.get(restaurantId) ?? current.items;
      await persistMenuDiff(restaurantId, previouslySaved, nextItems);
      persistedItems.current.set(restaurantId, nextItems);
    });
    menuQueue.current = task.catch((reason: unknown) => setSaveError(messageFrom(reason)));
    return task;
  }, []);

  const setCategories = useCallback((update: CategoriesUpdate): Promise<void> => {
    const current = workspaceRef.current;
    if (!current) return Promise.reject(new Error('Your restaurant workspace is still loading.'));
    const nextCategories = typeof update === 'function' ? update(current.categories) : update;
    if (nextCategories === current.categories) return Promise.resolve();

    workspaceRef.current = { ...current, categories: nextCategories };
    setWorkspace(workspaceRef.current);
    setSaveError('');

    const restaurantId = current.restaurant.id;
    const task = categoryQueue.current.then(async () => {
      const previouslySaved = persistedCategories.current.get(restaurantId) ?? current.categories;
      await persistCategories(restaurantId, previouslySaved, nextCategories);
      persistedCategories.current.set(restaurantId, nextCategories);
    });
    categoryQueue.current = task.catch((reason: unknown) => setSaveError(messageFrom(reason)));
    return task;
  }, []);

  const saveProfile = useCallback(async (
    values: Pick<RestaurantProfile, 'name' | 'description' | 'location' | 'website'>,
  ) => {
    const current = workspaceRef.current;
    if (!current) throw new Error('Your restaurant workspace is still loading.');
    try {
      const restaurant = await updateRestaurantProfile(current.restaurant.id, values);
      const latest = workspaceRef.current;
      if (!latest || latest.restaurant.id !== current.restaurant.id) return restaurant;
      workspaceRef.current = { ...latest, restaurant };
      setWorkspace(workspaceRef.current);
      setSaveError('');
      return restaurant;
    } catch (reason) {
      setSaveError(messageFrom(reason));
      throw reason;
    }
  }, []);

  const saveSettings = useCallback(async (settings: RestaurantSettings) => {
    const current = workspaceRef.current;
    if (!current) throw new Error('Your restaurant workspace is still loading.');
    try {
      await updateRestaurantSettings(current.restaurant.id, settings);
      const latest = workspaceRef.current;
      if (!latest || latest.restaurant.id !== current.restaurant.id) return;
      workspaceRef.current = { ...latest, settings };
      setWorkspace(workspaceRef.current);
      setSaveError('');
    } catch (reason) {
      setSaveError(messageFrom(reason));
      throw reason;
    }
  }, []);

  return {
    workspace,
    loading,
    loadError,
    saveError,
    setItems,
    setCategories,
    saveProfile,
    saveSettings,
  };
}
