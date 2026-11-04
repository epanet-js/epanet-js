import * as Comlink from "comlink";
import {
  assetsGeoTransferables,
  customerPointsGeoTransferables,
  zonesGeoTransferables,
} from "@epanet-js/hydraulic-model";
import { assetIndexTransferables } from "src/hydraulic-model/asset-index-transferable";
import { EncodedAreaSelectionBuffers } from "./data";

export const transferArgs = (encoded: EncodedAreaSelectionBuffers) => ({
  assetIndexArg: Comlink.transfer(
    encoded.assetIndexBuffers,
    assetIndexTransferables(encoded.assetIndexBuffers),
  ),
  assetsGeoArg: Comlink.transfer(
    encoded.assetsGeoBuffers,
    assetsGeoTransferables(encoded.assetsGeoBuffers),
  ),
  customerPointsGeoArg: encoded.customerPointsGeoBuffers
    ? Comlink.transfer(
        encoded.customerPointsGeoBuffers,
        customerPointsGeoTransferables(encoded.customerPointsGeoBuffers),
      )
    : undefined,
  zonesGeoArg: encoded.zonesGeoBuffers
    ? Comlink.transfer(
        encoded.zonesGeoBuffers,
        zonesGeoTransferables(encoded.zonesGeoBuffers),
      )
    : undefined,
});
