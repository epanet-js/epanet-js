import { useEffect, useState } from "react";
import type { Projection } from "src/lib/projections";

export const useProjections = () => {
  const [projections, setProjections] = useState<Projection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/projections.json")
      .then((res) => res.json())
      .then((data: Projection[]) => {
        if (!cancelled) {
          const enriched = data.map((p) => ({
            ...p,
            deprecated: /\(deprecated\)/i.test(p.name),
          }));
          enriched.sort((a, b) => Number(a.deprecated) - Number(b.deprecated));
          setProjections(enriched);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { projections, isLoading };
};
