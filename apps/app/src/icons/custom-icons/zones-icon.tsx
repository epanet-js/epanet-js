import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomZonesIcon = React.forwardRef<SVGSVGElement, CustomIconProps>(
  ({ size: rawSize = "md", ...props }, ref) => {
    const size = getPixels(rawSize);
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        width={size}
        height={size}
        {...props}
      >
        <path d="M21 14.601V8c-.001-.714-.382-1.373-1-1.73l-7-4c-.619-.357-1.381-.357-2 0l-7 4C3.382 6.627 3.001 7.286 3 8v8c.001.714.382 1.373 1 1.73l4.753 2.773" />
        <path d="M16.159 15.647V19.13v3.859" />
        <path d="M19.83 19.308h-3.483H12.487" />
      </svg>
    );
  },
);

CustomZonesIcon.displayName = "CustomZonesIcon";
