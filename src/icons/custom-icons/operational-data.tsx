import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomOperationalDataIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
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
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...props}
    >
      <g>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2" />
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2" />
        <path d="M6 15v1" />
        <path d="M6 15v1" />
        <path d="M18 12v4" />
        <path d="M18 12v4" />
        <path d="M10 10v6" />
        <path d="M10 10v6" />
        <path d="M14 13v3" />
        <path d="M14 13v3" />
      </g>
    </svg>
  );
});

CustomOperationalDataIcon.displayName = "CustomOperationalDataIcon";
