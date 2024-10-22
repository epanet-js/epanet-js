import useResettable from "src/hooks/use_resettable";
import type { IWrappedFeature } from "src/types";
import { LongitudeLatitudeInputs } from "src/components/longitude_latitude_inputs";
import { captureError } from "src/infra/error-tracking";
import { usePersistence } from "src/lib/persistence/context";
import { getCoordinates, setCoordinates } from "src/lib/map_operations";
import { CVertexId } from "src/lib/id";

export default function PointGeometry({
  wrappedFeature,
  vertexId: explicitVertexId,
}: {
  wrappedFeature: IWrappedFeature;
  vertexId?: VertexId;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();

  const vertexId = explicitVertexId || new CVertexId(0, 0);

  const [longitude, latitude] = getCoordinates(
    wrappedFeature.feature,
    vertexId,
  );

  const longitudeProps = useResettable({
    value: longitude.toString(),
    onCommit(newValue) {
      const num = +newValue;
      if (!isNaN(num)) {
        transact({
          note: "Manually updated point location",
          putFeatures: [
            {
              ...wrappedFeature,
              feature: setCoordinates({
                breakRectangle: true,
                feature: wrappedFeature.feature,
                position: [num, latitude],
                vertexId,
              }).feature,
            },
          ],
        }).catch((e) => captureError(e));
      }
    },
  });

  const latitudeProps = useResettable({
    value: latitude.toString(),
    onCommit(newValue) {
      const num = +newValue;
      if (!isNaN(num)) {
        transact({
          note: "Manually updated point location",
          putFeatures: [
            {
              ...wrappedFeature,
              feature: setCoordinates({
                breakRectangle: true,
                feature: wrappedFeature.feature,
                position: [longitude, num],
                vertexId,
              }).feature,
            },
          ],
        }).catch((e) => captureError(e));
      }
    },
  });

  return (
    <div>
      <LongitudeLatitudeInputs
        longitudeProps={longitudeProps}
        latitudeProps={latitudeProps}
      />
    </div>
  );
}
