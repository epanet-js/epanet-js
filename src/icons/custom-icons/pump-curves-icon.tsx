import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomPumpCurvesIcon = React.forwardRef<
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
      strokeWidth={2}
      strokeLinejoin="miter"
      strokeMiterlimit={10}
      width={size}
      height={size}
      {...props}
    >
      <path d="M3 3v16c0 1.097.903 2 2 2h16" />
      <path d="M7 7.5c7.464.062 9.248 1.743 12 7" />
    </svg>
  );
});

CustomPumpCurvesIcon.displayName = "CustomPumpCurvesIcon";
