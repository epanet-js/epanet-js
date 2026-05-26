import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomActiveTopologyEnableIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
  const size = getPixels(rawSize);
  return (
    <svg
      ref={ref}
      fill="none"
      stroke="currentColor"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fillRule="nonzero"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <g id="active-topology-enable">
        <path d="M11,19l-4.5,0c-1.92,0 -3.5,-1.58 -3.5,-3.5c0,-1.92 1.58,-3.5 3.5,-3.5l11,0c1.92,0 3.5,-1.58 3.5,-3.5c0,-1.92 -1.58,-3.5 -3.5,-3.5l-8.5,0" />
        <circle cx="6" cy="5" r="3" />
        <path d="M14,18l2,2l4,-4" />
      </g>
    </svg>
  );
});

CustomActiveTopologyEnableIcon.displayName = "CustomActiveTopologyEnableIcon";
