'use client';

import { useCallback, useEffect, useState } from 'react';

interface UsageCounts {
  entries: number;
  widgets: number;
  reports: number;
}

interface UseUsageCountsResult {
  counts: UsageCounts | null;
  loading: boolean;
  refetch: () => void;
}

export function useUsageCounts(accessToken: string | null | undefined): UseUsageCountsResult {
  const [counts, setCounts] = useState<UsageCounts | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/profile/usage', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCounts({
        entries: data.entries ?? 0,
        widgets: data.widgets ?? 0,
        reports: data.reports ?? 0,
      });
    } catch {
      // non-critical — silently ignore
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { counts, loading, refetch: fetchCounts };
}
