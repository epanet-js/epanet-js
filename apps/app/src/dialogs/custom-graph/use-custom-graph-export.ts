import { RefObject, useCallback } from "react";
import { getInstanceByDom } from "echarts";
import { useExportSimulationResults } from "src/commands/export-simulation-results";
import { ExportSimulationResultsProperties } from "src/lib/export/types";
import { useUserTracking } from "src/infra/user-tracking";
import { GraphDefaultOptions } from "./default-options";
import { AssetTimeSeries } from "./types";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { SuccessIcon } from "src/icons";

interface UseCustomGraphExportOptions {
  chartContainerRef: RefObject<HTMLDivElement | null>;
  networkName: string;
  nodeSeriesData: AssetTimeSeries[];
  linkSeriesData: AssetTimeSeries[];
  nodeProperty: string;
  linkProperty: string;
  onExportProgress?: (progress: number) => void;
}

export function useCustomGraphExport({
  chartContainerRef,
  networkName,
  nodeSeriesData,
  linkSeriesData,
  nodeProperty,
  linkProperty,
  onExportProgress,
}: UseCustomGraphExportOptions) {
  const exportSimulationResults = useExportSimulationResults();
  const translate = useTranslate();
  const { capture } = useUserTracking();

  const trackExport = useCallback(
    (format: "png" | "csv" | "xlsx") =>
      capture({
        name: "customGraph.exported",
        format,
        numAssets: nodeSeriesData.length + linkSeriesData.length,
      }),
    [capture, nodeSeriesData.length, linkSeriesData.length],
  );

  const fileName = (() => {
    if (nodeSeriesData.length === 0 && linkSeriesData.length === 0) {
      return "";
    }

    if (nodeSeriesData.length > 1 || linkSeriesData.length > 1) {
      return `${networkName}-${linkProperty}-${nodeProperty}`;
    }

    if (nodeSeriesData.length === 0) {
      return `${networkName}-${linkSeriesData[0].label}-${linkProperty}`;
    }

    return `${networkName}-${nodeSeriesData[0].label}-${nodeProperty}`;
  })();

  const notifyExportSucceeded = useCallback(
    () =>
      notify({
        variant: "success",
        size: "sm",
        title: translate("customGraph.exportSucceeded"),
        Icon: SuccessIcon,
      }),
    [translate],
  );

  const exportAsPng = useCallback(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const echartsElements = container.querySelectorAll<HTMLDivElement>(
      "[_echarts_instance_]",
    );
    if (echartsElements.length === 0) return;

    const svgUrls: string[] = [];
    for (const el of echartsElements) {
      const instance = getInstanceByDom(el);
      if (instance) {
        svgUrls.push(instance.getDataURL({ type: "svg" }));
      }
    }

    if (svgUrls.length === 0) return;

    const ratio = 2;
    let loaded = 0;
    const images: HTMLImageElement[] = new Array(svgUrls.length);

    const onAllLoaded = () => {
      const padding = 16;
      const width = Math.max(...images.map((img) => img.width));
      const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

      const canvas = document.createElement("canvas");
      canvas.width = (width + padding * 2) * ratio;
      canvas.height = (totalHeight + padding * 2) * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(ratio, ratio);

      let y = padding;
      for (const img of images) {
        ctx.drawImage(img, padding, y);
        y += img.height;
      }

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${fileName}.png`;
      a.click();

      trackExport("png");
      notifyExportSucceeded();
    };

    svgUrls.forEach((url, i) => {
      const img = new Image();
      img.onload = () => {
        images[i] = img;
        loaded++;
        if (loaded === svgUrls.length) onAllLoaded();
      };
      img.src = url;
    });
  }, [chartContainerRef, fileName, notifyExportSucceeded, trackExport]);

  const exportTabular = useCallback(
    async (format: "csv" | "xlsx") => {
      let lastYield = performance.now();
      const nodeIds = nodeSeriesData.map((n) => n.assetId);
      const linkIds = linkSeriesData.map((n) => n.assetId);
      const selectedAssets = new Set<number>([...nodeIds, ...linkIds]);

      const mappedLinkProperty = (() => {
        if (linkIds.length === 0) {
          return [];
        }

        if (linkProperty === "headloss") {
          return ["unitHeadloss"];
        }

        if (linkProperty === "flowAbsolute") {
          return ["flow"];
        }

        return [linkProperty];
      })();

      const mappedNodeProperty = (() => {
        if (nodeIds.length === 0) {
          return [];
        }

        const hasWaterQuality =
          GraphDefaultOptions.WATER_QUALITY_PROPERTIES.includes(nodeProperty);
        if (hasWaterQuality) {
          return ["waterQuality"];
        }

        return [nodeProperty];
      })();

      const properties = [
        ...mappedNodeProperty,
        ...mappedLinkProperty,
      ] as ExportSimulationResultsProperties[];

      try {
        await exportSimulationResults({
          format,
          fileName,
          onProgress: (progress) => {
            onExportProgress?.(progress);
            if (performance.now() - lastYield >= 100) {
              lastYield = performance.now();
              return new Promise<void>((resolve) => setTimeout(resolve, 0));
            }
            return Promise.resolve();
          },
          properties,
          selectedAssets,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        throw err;
      }

      trackExport(format);
      notifyExportSucceeded();
    },
    [
      nodeSeriesData,
      linkSeriesData,
      exportSimulationResults,
      fileName,
      trackExport,
      notifyExportSucceeded,
      linkProperty,
      nodeProperty,
      onExportProgress,
    ],
  );

  return { exportAsPng, exportTabular };
}
