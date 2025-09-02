import * as React from "react";
import { CustomIconProps, IconSize } from "../index";

export const CustomTypeOffIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "m", ...props }, ref) => {
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
          d="m2 2 20 20M12 12v8M12 4v2M10 4h9c.549 0 1 .451 1 1v2M4 7V5M9 20h6"
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
});

CustomTypeOffIcon.displayName = "CustomTypeOffIcon";
