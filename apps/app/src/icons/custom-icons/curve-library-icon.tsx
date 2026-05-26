import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomCurveLibraryIcon = React.forwardRef<
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
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 17s5 1 6-5 6-5 6-5" />
    </svg>
  );
});

CustomCurveLibraryIcon.displayName = "CustomCurveLibraryIcon";
