import { useState, useEffect } from "react";
import type { Projection } from "src/lib/projections";

type ProjectionsState = {
  projections: Map<string, Projection> | null;
  projectionsArray: Projection[];
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

    fetch("/projections.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load projections: ${response.status}`);
        }
        return response.json();
      })
      .then((data: Projection[]) => {
        if (cancelled) return;
        const enriched = data.map((p) => ({
          ...p,
          deprecated: /\(deprecated\)/i.test(p.name),
        }));
        const sorted = [...enriched].sort(
          (a, b) => Number(a.deprecated) - Number(b.deprecated),
        );
        const projectionsMap = new Map<string, Projection>();
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
