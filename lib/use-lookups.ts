import { useEffect, useState } from "react";

export interface LookupOption {
  value: string;
  label: string;
}

interface Lookups {
  statuses: LookupOption[];
  priorities: LookupOption[];
}

const cache: { data: Lookups | null } = { data: null };

export function useLookups() {
  const [lookups, setLookups] = useState<Lookups>(
    cache.data ?? { statuses: [], priorities: [] }
  );

  useEffect(() => {
    if (cache.data) return;
    fetch("/api/lookups")
      .then((r) => r.json())
      .then((res) => {
        cache.data = res.data;
        setLookups(res.data);
      })
      .catch(console.error);
  }, []);

  return lookups;
}
