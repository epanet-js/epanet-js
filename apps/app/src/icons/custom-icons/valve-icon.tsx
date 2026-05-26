import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomValveIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
  ({ size: rawSize = "md", ...props }, ref) => {
    const size = getPixels(rawSize);
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        {...props}
      >
        <g>
          <path
            d="M3 3v18.048L21 3v18L3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeMiterlimit="8"
          />
        </g>
      </svg>
    );
  },
);

CustomValveIcon.displayName = "CustomValveIcon";
