import { Mock, vi } from "vitest";

import * as useProjections from "src/hooks/use-projections";
import { Projection } from "src/hooks/use-projections";

vi.mock("src/hooks/use-projections", () => ({
  useProjections: vi.fn(),
}));

const mockProjections = new Map<string, Projection>([
  [
    "EPSG:3857",
    {
      id: "EPSG:3857",
      name: "WGS 84 / Pseudo-Mercator",
      code: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs",
    },
  ],
  [
    "EPSG:4326",
    {
      id: "EPSG:4326",
      name: "WGS 84",
      code: "+proj=longlat +datum=WGS84 +no_defs",
    },
  ],
]);

export const stubProjectionsReady = () => {
  (useProjections.useProjections as Mock).mockReturnValue({
    projections: mockProjections,
    loading: false,
    error: null,
  });
};

export const stubProjectionsLoading = () => {
  (useProjections.useProjections as Mock).mockReturnValue({
    projections: null,
    loading: true,
    error: null,
  });
};

export const stubProjectionsError = (
  errorMessage = "Failed to load projections",
) => {
  (useProjections.useProjections as Mock).mockReturnValue({
    projections: null,
    loading: false,
    error: errorMessage,
  });
};
