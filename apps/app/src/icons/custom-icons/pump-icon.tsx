import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomPumpIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps & { triangleFillColor?: string }
>(
  (
    { size: rawSize = "md", triangleFillColor = "currentColor", ...props },
    ref,
  ) => {
    const size = getPixels(rawSize);
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        width={size}
        height={size}
        {...props}
      >
        <g>
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            fill={triangleFillColor}
            d="M11.098,6.882c0.166,-0.347 0.517,-0.568 0.902,-0.568c0.385,0 0.736,0.221 0.902,0.568c1.153,2.406 3.124,6.519 4.162,8.686c0.148,0.31 0.127,0.674 -0.056,0.965c-0.183,0.291 -0.502,0.467 -0.846,0.467c-2.194,0 -6.13,0 -8.324,0c-0.344,0 -0.663,-0.176 -0.846,-0.467c-0.183,-0.291 -0.204,-0.655 -0.056,-0.965c1.038,-2.167 3.009,-6.28 4.162,-8.686Z"
          />
        </g>
      </svg>
    );
  },
);

CustomPumpIcon.displayName = "CustomPumpIcon";
