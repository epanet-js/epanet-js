import { setCoordinates } from "src/lib/map_operations";
import useResettable from "src/hooks/use_resettable";
import { usePersistence } from "src/lib/persistence/context";
import { captureError } from "src/infra/error-tracking";
import { LongitudeLatitudeInputs } from "src/components/longitude_latitude_inputs";
import { PanelDetails } from "src/components/panel_details";
import type { IWrappedFeature } from "src/types";
import { getCoordinatesMaybe } from "src/lib/map_operations/get_coordinates";

export function FeatureEditorVertex({
  wrappedFeature,
  vertexId,
}: {
  wrappedFeature: IWrappedFeature;
  vertexId: VertexId;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();

  const coordinatesMaybe = getCoordinatesMaybe(
    wrappedFeature.feature,
    vertexId,
  );

  const [longitude, latitude] = coordinatesMaybe.orDefault([0, 0]);

  const longitudeProps = useResettable({
    value: longitude.toString(),
    onCommit(newValue) {
      const num = +newValue;
      if (!isNaN(num)) {
        transact({
          putFeatures: [
            {
              ...wrappedFeature,
              feature: setCoordinates({
                breakRectangle: true,
                feature: wrappedFeature.feature,
                position: [num, latitude],
                vertexId: vertexId,
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
          putFeatures: [
            {
              ...wrappedFeature,
              feature: setCoordinates({
                breakRectangle: true,
                feature: wrappedFeature.feature,
                position: [longitude, num],
                vertexId: vertexId,
              }).feature,
            },
          ],
        }).catch((e) => captureError(e));
      }
    },
  });

  if (coordinatesMaybe.isNothing()) {
    return null;
  }

  return (
    <PanelDetails title="Selected vertex">
      <LongitudeLatitudeInputs
        longitudeProps={longitudeProps}
        latitudeProps={latitudeProps}
      />
    </PanelDetails>
  );
}
