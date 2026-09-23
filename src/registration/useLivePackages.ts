import { useEffect, useState } from 'react';
import { apiConfigured } from '@/config/runtime';
import { livePublicPackages, type LivePackage } from './livePlatform';

export function useLivePackages() {
  const [packages, setPackages] = useState<LivePackage[]>([]);
  const [loading, setLoading] = useState(apiConfigured);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!apiConfigured) return;
    let active = true;
    livePublicPackages().then((response) => { if (active) setPackages(response.data.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Package catalog unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { packages, loading, error };
}
