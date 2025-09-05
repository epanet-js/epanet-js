import { useState, useEffect } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export type Projection = {
  id: string;
  name: string;
  code: string;
};

type ProjectionsState = {
  projections: Map<string, Projection> | null;
  loading: boolean;
  error: string | null;
};

export const useProjections = (): ProjectionsState => {
  const isDataMappingOn = useFeatureFlag("FLAG_DATA_MAPPING");
  const [state, setState] = useState<ProjectionsState>({
    projections: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!isDataMappingOn) {
      setState({ projections: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetch("/projections.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load projections: ${response.status}`);
        }
        return response.json();
      })
      .then((projectionsArray: Projection[]) => {
        const projectionsMap = new Map<string, Projection>();
        projectionsArray.forEach((projection) => {
          projectionsMap.set(projection.id, projection);
        });
        setState({
          projections: projectionsMap,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        setState({
          projections: null,
          loading: false,
          error: error.message || "Failed to load coordinate projections",
        });
      });
  }, [isDataMappingOn]);

  return state;
};
