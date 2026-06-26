import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomMissingAttributeIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
  const size = getPixels(rawSize);
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      clipRule="evenodd"
      fillRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g stroke="currentColor" strokeWidth={2} fill="none">
        <path d="M21,5l-18,0" fillRule="nonzero" />
        <path d="M14,12l-11,0" fillRule="nonzero" />
        <path d="M14,19l-11,0" fillRule="nonzero" />
      </g>
      <g stroke="currentColor" strokeWidth={2} fill="none">
        <path
          d="M18,12.27c0.2,-0.4 0.5,-0.8 0.9,-1c0.85,-0.491 1.937,-0.324 2.6,0.4c0.3,0.4 0.5,0.8 0.5,1.3c0,1.3 -2,2 -2,2"
          fillRule="nonzero"
        />
        <path
          d="M20,14.97l0,1.03"
          strokeMiterlimit={10}
          strokeDasharray="2,3,0,0,0,0"
        />
        <path d="M20,18.99l0,0.01" fillRule="nonzero" />
      </g>
    </svg>
  );
});

CustomMissingAttributeIcon.displayName = "CustomMissingAttributeIcon";
