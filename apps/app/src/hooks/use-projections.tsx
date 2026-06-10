import { useState, useEffect } from "react";
import { fetchProjections } from "src/lib/projections";
import type { Proj4Projection } from "src/lib/projections";

type ProjectionsState = {
  projections: Map<string, Proj4Projection> | null;
  projectionsArray: Proj4Projection[];
  loading: boolean;
  error: string | null;
};

export const useProjections = (): ProjectionsState => {
  const [state, setState] = useState<ProjectionsState>({
    projections: null,
    projectionsArray: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchProjections()
      .then((enriched) => {
        if (cancelled) return;
        const sorted = [...enriched].sort(
          (a, b) => Number(a.deprecated) - Number(b.deprecated),
        );
        const projectionsMap = new Map<string, Proj4Projection>();
        enriched.forEach((p) => projectionsMap.set(p.id, p));
        setState({
          projections: projectionsMap,
          projectionsArray: sorted,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          projections: null,
          projectionsArray: [],
          loading: false,
          error: error.message || "Failed to load coordinate projections",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
