"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useSetAtom } from "jotai";
import { selectionAtom } from "src/state/selection";
import { tabAtom, TabOption } from "src/state/layout";
import { USelection } from "src/selection/selection";
import { ProfileLink, ProfilePoint } from "./chart-data";
import { findLinkAt } from "./tooltip-data";
import { pickSldSnap } from "./snap";

interface UseChartClickParams {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  points: ProfilePoint[];
  links: ProfileLink[];
}

export function useChartClick({
  containerRef,
  chartRef,
  points,
  links,
}: UseChartClickParams): void {
  const setSelection = useSetAtom(selectionAtom);
  const setTab = useSetAtom(tabAtom);

  const depsRef = useRef({ points, links, setSelection, setTab });
  depsRef.current = { points, links, setSelection, setTab };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      /* eslint-disable @typescript-eslint/no-unsafe-call,
         @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const result =
        chart.convertFromPixel({ gridIndex: 0 }, [px, py]) ??
        chart.convertFromPixel({ seriesIndex: 0 }, [px, py]);
      const cursorX = Array.isArray(result) ? (result[0] as number) : NaN;
      if (Number.isNaN(cursorX)) return;

      const deps = depsRef.current;
      const snap = pickSldSnap(chart, deps.points, deps.links, px);
      /* eslint-enable */

      if (snap?.kind === "link") {
        deps.setSelection(USelection.single(snap.link.linkId));
        deps.setTab(TabOption.Asset);
        return;
      }

      if (snap?.kind === "node") {
        deps.setSelection(USelection.single(deps.points[snap.index].nodeId));
        deps.setTab(TabOption.Asset);
        return;
      }

      const link = findLinkAt(cursorX, deps.links);
      if (link) {
        deps.setSelection(USelection.single(link.linkId));
        deps.setTab(TabOption.Asset);
      }
    };

    el.addEventListener("click", handleClick);
    return () => {
      el.removeEventListener("click", handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
