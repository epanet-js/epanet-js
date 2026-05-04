"use client";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { VisibleTooltipContent } from "./tooltip-data";
import { ChartCursorState } from "./use-chart-cursor";

const HGL_COLOR = "#2563eb";

interface ProfileTooltipProps {
  state: ChartCursorState;
  elevColor: string;
  translate: (key: string) => string;
}

export function ProfileTooltip({
  state,
  elevColor,
  translate,
}: ProfileTooltipProps) {
  if (!state) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: state.px + 12,
        top: state.py + 12,
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
      />
    </div>
  );
}

function TooltipBody({
  content,
  elevColor,
  translate,
}: {
  content: VisibleTooltipContent;
  elevColor: string;
  translate: (key: string) => string;
}) {
  if (content.kind === "node") {
    return (
      <>
        <strong>{content.label}</strong>
        <Row
          color={elevColor}
          label={translate("profileView.elevation")}
          value={content.elevation}
        />
        {content.hgl !== null && (
          <Row
            color={HGL_COLOR}
            label={translate("profileView.hgl")}
            value={content.hgl}
          />
        )}
        {content.pressure !== null && (
          <Row label={translate("pressure")} value={content.pressure} />
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
        />
      )}
      {content.hgl !== null && (
        <Row
          color={HGL_COLOR}
          label={translate("profileView.hgl")}
          value={content.hgl}
        />
      )}
      {content.pressure !== null && (
        <Row label={translate("pressure")} value={content.pressure} />
      )}
    </>
  );
}

function Row({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <Dot color={color} />
      {label}: {localizeDecimal(value, { decimals: 2 })}
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
