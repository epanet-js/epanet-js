import { Mock, vi } from "vitest";

import * as useProjections from "src/hooks/use-projections";
import type { Proj4Projection } from "src/lib/projections";

vi.mock("src/hooks/use-projections", () => ({
  useProjections: vi.fn(),
}));

const mockProjections = new Map<string, Proj4Projection>([
  [
    "EPSG:3857",
    {
      type: "proj4",
      id: "EPSG:3857",
      name: "WGS 84 / Pseudo-Mercator",
      code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs",
    },
  ],
  [
    "EPSG:4326",
    {
      type: "proj4",
      id: "EPSG:4326",
      name: "WGS 84",
      code: "+proj=longlat +datum=WGS84 +no_defs",
    },
  ],
]);

const mockProjectionsArray = [...mockProjections.values()];

export const stubProjectionsReady = () => {
  (useProjections.useProjections as Mock).mockReturnValue({
    projections: mockProjections,
    projectionsArray: mockProjectionsArray,
    loading: false,
    error: null,
  });
};

export const stubProjectionsLoading = () => {
  (useProjections.useProjections as Mock).mockReturnValue({
    projections: null,
    projectionsArray: [],
    loading: true,
    error: null,
  });
};

export const stubProjectionsError = (
  errorMessage = "Failed to load projections",
) => {
  (useProjections.useProjections as Mock).mockReturnValue({
    projections: null,
    projectionsArray: [],
    loading: false,
    error: errorMessage,
  });
};
