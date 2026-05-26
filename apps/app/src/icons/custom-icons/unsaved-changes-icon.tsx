import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomUnsavedChangesIcon = React.forwardRef<
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
      {...props}
    >
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
});

CustomUnsavedChangesIcon.displayName = "CustomUnsavedChangesIcon";
