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
      width={size}
      height={size}
      {...props}
    >
      <path d="M3,3l0,16c0,1.097 0.903,2 2,2l16,0" />
      <path d="M7,5c7.775,0.066 9.634,1.868 12.5,7.5" />
    </svg>
  );
});

CustomPumpCurvesIcon.displayName = "CustomPumpCurvesIcon";
