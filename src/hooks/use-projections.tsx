import { useState, useEffect } from "react";
import type { Proj4Projection } from "src/lib/projections";

type ProjectionsState = {
  projections: Map<string, Proj4Projection> | null;
  projectionsArray: Proj4Projection[];
  loading: boolean;
  error: string | null;
};

type RawProjection = { id: string; name: string; code: string };

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
      .then((data: RawProjection[]) => {
        if (cancelled) return;
        const enriched: Proj4Projection[] = data.map((p) => ({
          type: "proj4" as const,
          ...p,
          deprecated: /\(deprecated\)/i.test(p.name),
        }));
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
