import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomUpstreamTraceIcon = React.forwardRef<
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
      <circle cx={19} cy={19} r={2} />
      <circle cx={5} cy={19} r={2} />
      <path d="M5,7l0,10" />
      <path d="M17,19l-10,0" />
      <circle cx={5} cy={5} r={2} />
      <path d="M16,13l-0,-10" />
      <path d="M20,9l-4,4l-4,-4" />
    </svg>
  );
});

CustomUpstreamTraceIcon.displayName = "CustomUpstreamTraceIcon";
