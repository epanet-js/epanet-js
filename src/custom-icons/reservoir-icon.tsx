import * as React from "react";

export const ReservoirIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>((props, ref) => {
  const viewboxWidth = 32;
  const viewboxHeight = 32;

  const triangleHeight = 24;
  const triangleBase = 28;

  const p1x = (viewboxWidth - triangleBase) / 2;
  const p1y = (viewboxHeight + triangleHeight) / 2;

  const p2x = (viewboxWidth + triangleBase) / 2;
  const p2y = (viewboxHeight + triangleHeight) / 2;

  const p3x = viewboxWidth / 2;
  const p3y = (viewboxHeight - triangleHeight) / 2;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewboxWidth} ${viewboxHeight}`}
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <polygon
        points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`}
        stroke={props.stroke || "currentColor"}
        strokeWidth="2"
        fill={props.fill || "none"}
      />
    </svg>
  );
});

ReservoirIcon.displayName = "ReservoirIcon";
