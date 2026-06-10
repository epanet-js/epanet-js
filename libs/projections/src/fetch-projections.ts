import { getProjectionsBaseUrl } from "./config";
import type { Proj4Projection } from "./projection";

type RawProjection = { id: string; name: string; code: string };

export const fetchProjections = async (): Promise<Proj4Projection[]> => {
  const baseUrl = getProjectionsBaseUrl();
  const response = await fetch(`${baseUrl}/projections.json`);

  if (!response.ok) {
    throw new Error(`Failed to load projections: ${response.status}`);
  }

  const data: RawProjection[] =
    (await response.json()) as unknown as RawProjection[];

  return data.map((p) => ({
    type: "proj4" as const,
    ...p,
    deprecated: /\(deprecated\)/i.test(p.name),
  }));
};
