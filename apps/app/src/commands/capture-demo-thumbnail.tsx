import { useAtomValue } from "jotai";
import { useCallback, useContext } from "react";
import { DEMO_THUMBNAIL_SIZE } from "src/demo/demo-networks";
import { MapContext, captureThumbnail } from "src/map";
import { sourceRegionWidthFor } from "src/map/capture-thumbnail";
import { projectSettingsAtom } from "src/state/project-settings";

export const captureDemoThumbnailShortcut = "alt+t";

export const useCaptureDemoThumbnail = () => {
  const map = useContext(MapContext);
  const projectName = useAtomValue(projectSettingsAtom).name;

  return useCallback(() => {
    if (!map) return;

    warnWhenCanvasTooSmall(map.map?.getCanvas());

    const image = captureThumbnail(map, {
      ...DEMO_THUMBNAIL_SIZE,
      crop: 1,
      format: "png",
      allowUpscale: true,
    });
    if (!image) return;

    downloadImage(image, `${projectName || "demo-network"}.png`);
  }, [map, projectName]);
};

const warnWhenCanvasTooSmall = (
  sourceCanvas: HTMLCanvasElement | undefined,
) => {
  if (!sourceCanvas) return;

  const { width, height } = DEMO_THUMBNAIL_SIZE;
  const regionWidth = sourceRegionWidthFor(sourceCanvas, width, height);
  if (regionWidth >= width) return;

  // eslint-disable-next-line no-console
  console.warn(
    `DEBUG: map canvas only provides ${Math.round(regionWidth)}px for a ${width}px thumbnail, widen the window to avoid upscaling`,
  );
};

const downloadImage = (image: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = image;
  link.download = fileName;
  link.click();
};
