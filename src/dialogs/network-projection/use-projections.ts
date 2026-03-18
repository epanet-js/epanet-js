import { useEffect, useState } from "react";
import type { Projection } from "./types";

export const useProjections = () => {
  const [projections, setProjections] = useState<Projection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/projections.json")
      .then((res) => res.json())
      .then((data: Projection[]) => {
        if (!cancelled) {
          setProjections(data);
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
