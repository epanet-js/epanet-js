import * as React from "react";
import { CustomIconProps, IconSize } from "../index";

export const ValveIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
  ({ size: rawSize = "m", ...props }, ref) => {
    const size = IconSize[rawSize];
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

ValveIcon.displayName = "ValveIcon";
