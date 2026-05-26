import * as React from "react";

export const TankIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>((props, ref) => {
  const viewboxWidth = 32;
  const viewboxHeight = 32;

  const rectWidth = 28;
  const rectHeight = 22;

  const rectX = (viewboxWidth - rectWidth) / 2;
  const rectY = (viewboxHeight - rectHeight) / 2;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewboxWidth} ${viewboxHeight}`}
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <rect
        x={rectX}
        y={rectY}
        width={rectWidth}
        height={rectHeight}
        stroke={props.stroke || "currentColor"}
        strokeWidth="2"
        fill={props.fill || "none"}
        rx="2"
      />
    </svg>
  );
});

TankIcon.displayName = "TankIcon";
