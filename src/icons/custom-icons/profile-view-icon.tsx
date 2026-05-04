import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomProfileViewIcon = React.forwardRef<
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
      <path d="m3 12 2-1 7 5 4-2 5 4" />
      <path d="m3 12v7.032c0 1.087.881 1.968 1.968 1.968h14.064c1.087 0 1.968-.881 1.968-1.968 0-.565 0-1.032 0-1.032" />
      <path d="m3 3 18 2" />
      <path d="m3 3v4" />
      <path d="m12 4v5" />
      <path d="m21 5v6" />
    </svg>
  );
});

CustomProfileViewIcon.displayName = "CustomProfileViewIcon";
