import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomProximityCheckIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
  const size = getPixels(rawSize);
  return (
    <svg
      ref={ref}
      fill="currentColor"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fillRule="evenodd"
      clipRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g id="proximity">
        <g>
          <path
            d="M15,4l0,-2"
            fill="none"
            fillRule="nonzero"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M15,16l0,-2"
            fill="none"
            fillRule="nonzero"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8,9l2,0"
            fill="none"
            fillRule="nonzero"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M20,9l2,0"
            fill="none"
            fillRule="nonzero"
            stroke="currentColor"
            strokeWidth="2"
          />
        </g>
        <path
          d="M15,9l0.01,0"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M3,21l9,-9"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M21,15l-12,-12"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
});

CustomProximityCheckIcon.displayName = "CustomProximityCheckIcon";
