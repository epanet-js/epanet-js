import { LinkAsset } from "../../asset-types";
import { Pipe, PipeProperties } from "../../asset-types/pipe";

type CopyablePipeProperties = Pick<
  PipeProperties,
  "diameter" | "roughness" | "minorLoss" | "initialStatus"
>;
type CopyablePipePropertyKeys = keyof CopyablePipeProperties;

export function copyPipePropertiesToLink(
  sourcePipe: Pipe,
  targetLink: LinkAsset,
): void {
  targetLink.setProperty("isActive", sourcePipe.isActive);

  if (targetLink.type === "pipe") {
    const propertiesToCopy: CopyablePipePropertyKeys[] = [
      "diameter",
      "roughness",
      "minorLoss",
      "initialStatus",
    ];

    for (const property of propertiesToCopy) {
      if (sourcePipe.hasProperty(property)) {
        const value = sourcePipe.getProperty(property);
        if (value !== null && value !== undefined) {
          targetLink.setProperty(property, value);
        }
      }
    }
  } else {
    if (sourcePipe.hasProperty("diameter")) {
      const diameter = sourcePipe.getProperty("diameter");
      if (diameter !== null && diameter !== undefined) {
        targetLink.setProperty("diameter", diameter);
      }
    }
  }
}
