import { useEffect, useState } from 'react';
import { loadPublicMenu, type PublicMenuData } from '@/lib/nutrimenu-data';

export function usePublicMenuData(slug: string | undefined) {
  const [data, setData] = useState<PublicMenuData>({ restaurant: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!slug) {
      setData({ restaurant: null, items: [] });
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    loadPublicMenu(slug)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load this menu.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return { ...data, loading, error };
}
