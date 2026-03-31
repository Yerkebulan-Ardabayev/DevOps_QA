import { useState, useEffect } from 'react';
import { DevOpsData, loadDevOpsData } from '@/lib/devops-data';

export function useDevOpsData() {
  const [data, setData] = useState<DevOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevOpsData()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
