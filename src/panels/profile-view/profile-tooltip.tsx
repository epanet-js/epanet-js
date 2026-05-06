"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { VisibleTooltipContent } from "./tooltip-data";
import { ChartCursorState } from "./use-chart-cursor";

const HGL_COLOR = "#2563eb";
const CURSOR_OFFSET = 12;
const EDGE_PADDING = 4;

interface ProfileTooltipProps {
  state: ChartCursorState;
  containerRef: RefObject<HTMLDivElement | null>;
  elevColor: string;
  translate: (key: string) => string;
  elevationUnitLabel: string;
  pressureUnitLabel: string;
  elevationDecimals: number;
  pressureDecimals: number;
}

export function ProfileTooltip({
  state,
  containerRef,
  elevColor,
  translate,
  elevationUnitLabel,
  pressureUnitLabel,
  elevationDecimals,
  pressureDecimals,
}: ProfileTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!state) return;
    const tooltipEl = tooltipRef.current;
    const containerEl = containerRef.current;
    if (!tooltipEl || !containerEl) return;
    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;

    let left = state.px + CURSOR_OFFSET;
    if (left + tooltipWidth + EDGE_PADDING > containerWidth) {
      left = state.px - CURSOR_OFFSET - tooltipWidth;
    }
    if (left < EDGE_PADDING) left = EDGE_PADDING;

    let top = state.py + CURSOR_OFFSET;
    if (top + tooltipHeight + EDGE_PADDING > containerHeight) {
      top = state.py - CURSOR_OFFSET - tooltipHeight;
    }
    if (top < EDGE_PADDING) top = EDGE_PADDING;

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.visibility = "visible";
  });

  if (!state) return null;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        visibility: "hidden",
        pointerEvents: "none",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 12,
        lineHeight: 1.5,
        color: "#111827",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        zIndex: 1000,
        whiteSpace: "nowrap",
      }}
    >
      <TooltipBody
        content={state.content}
        elevColor={elevColor}
        translate={translate}
        elevationUnitLabel={elevationUnitLabel}
        pressureUnitLabel={pressureUnitLabel}
        elevationDecimals={elevationDecimals}
        pressureDecimals={pressureDecimals}
      />
    </div>
  );
}

function TooltipBody({
  content,
  elevColor,
  translate,
  elevationUnitLabel,
  pressureUnitLabel,
  elevationDecimals,
  pressureDecimals,
}: {
  content: VisibleTooltipContent;
  elevColor: string;
  translate: (key: string) => string;
  elevationUnitLabel: string;
  pressureUnitLabel: string;
  elevationDecimals: number;
  pressureDecimals: number;
}) {
  if (content.kind === "node") {
    return (
      <>
        <strong>{content.label}</strong>
        <Row
          color={elevColor}
          label={translate("profileView.elevation")}
          value={content.elevation}
          unit={elevationUnitLabel}
          decimals={elevationDecimals}
        />
        {content.hgl !== null && (
          <Row
            color={HGL_COLOR}
            label={translate("profileView.hgl")}
            value={content.hgl}
            unit={elevationUnitLabel}
            decimals={elevationDecimals}
          />
        )}
        {content.pressure !== null && (
          <Row
            label={translate("pressure")}
            value={content.pressure}
            unit={pressureUnitLabel}
            decimals={pressureDecimals}
          />
        )}
      </>
    );
  }

  return (
    <>
      <strong>{content.linkLabel ?? translate("profileView.estimated")}</strong>
      {content.linkLabel !== null && (
        <em style={{ opacity: 0.7, fontStyle: "italic", marginLeft: 4 }}>
          ({translate("profileView.estimated")})
        </em>
      )}
      {content.elevation !== null && (
        <Row
          color={elevColor}
          label={translate("profileView.elevation")}
          value={content.elevation}
          unit={elevationUnitLabel}
          decimals={elevationDecimals}
        />
      )}
      {content.hgl !== null && (
        <Row
          color={HGL_COLOR}
          label={translate("profileView.hgl")}
          value={content.hgl}
          unit={elevationUnitLabel}
          decimals={elevationDecimals}
        />
      )}
      {content.pressure !== null && (
        <Row
          label={translate("pressure")}
          value={content.pressure}
          unit={pressureUnitLabel}
          decimals={pressureDecimals}
        />
      )}
    </>
  );
}

function Row({
  color,
  label,
  value,
  unit,
  decimals,
}: {
  color?: string;
  label: string;
  value: number;
  unit?: string;
  decimals: number;
}) {
  const formatted = localizeDecimal(value, { decimals });
  return (
    <div>
      <Dot color={color} />
      {label}: {formatted}
      {unit ? ` ${unit}` : ""}
    </div>
  );
}

function Dot({ color }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        background: color ?? "transparent",
        marginRight: 4,
        borderRadius: "50%",
      }}
    />
  );
}
