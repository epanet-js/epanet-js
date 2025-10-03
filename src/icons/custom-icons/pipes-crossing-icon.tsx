import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomPipesCrossingIcon = React.forwardRef<
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
      <g id="crossing">
        <circle
          cx="12"
          cy="12"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M5.636,5.636l4.243,4.243"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M18.364,5.636l-4.243,4.243"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M14.121,14.121l4.243,4.243"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M9.879,14.121l-4.243,4.243"
          fill="none"
          fillRule="nonzero"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
});

CustomPipesCrossingIcon.displayName = "CustomPipesCrossingIcon";
