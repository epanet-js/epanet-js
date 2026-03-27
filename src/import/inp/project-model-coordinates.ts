import { AssetsMap } from "src/hydraulic-model/assets-map";
import { CustomerPoints } from "src/hydraulic-model/customer-points";
import { transformCoordinates } from "src/hydraulic-model/mutations/transform-coordinates";
import { type Projection, createProjectionMapper } from "src/lib/projections";

type ProjectCoordinatesData = {
  assets: AssetsMap;
  customerPoints: CustomerPoints;
};

export const projectCoordinates = (
  data: ProjectCoordinatesData,
  projection: Projection,
) => {
  const mapper = createProjectionMapper(projection);
  transformCoordinates(data, mapper.toWgs84);
};
