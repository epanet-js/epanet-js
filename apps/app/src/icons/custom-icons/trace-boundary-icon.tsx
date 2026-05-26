import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomBoundaryTraceIcon = React.forwardRef<
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
      strokeWidth={2}
      strokeMiterlimit={10}
      stroke="currentColor"
      fill="none"
      {...props}
    >
      <path d="M16,20l0,-16" />
      <path d="M21,16l-5,5l-5,-5" />
      <path d="M11,8l5,-5l5,5" />
      <circle cx="5" cy="19" r="2" />
      <path d="M5,7l0,10" />
      <circle cx="5" cy="5" r="2" />
    </svg>
  );
});

CustomBoundaryTraceIcon.displayName = "CustomBoundaryTraceIcon";
