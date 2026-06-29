import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomAllocateCustomerPointsIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
  const size = getPixels(rawSize);
  return (
    <svg
      ref={ref}
      clipRule="evenodd"
      fillRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={size}
      height={size}
      {...props}
    >
      <path d="m4.708 21.208c-1.097 0-2-.903-2-2v-9c-.001-.59.259-1.15.71-1.53l7-6c.742-.627 1.838-.627 2.58 0l7 6c.45.38.71.94.71 1.53v.792" />
      <path d="m12 12.958h-.975c-1.065 0-2.086.424-2.837 1.18s-1.169 1.78-1.163 2.845c0 .006.001.013.001.02.013 2.188 1.791 3.955 3.98 3.955h.994" />
      <path d="m15.733 12.958h.975c1.065 0 2.086.424 2.837 1.18s1.169 1.78 1.163 2.845c0 .006 0 .013-.001.02-.013 2.188-1.791 3.955-3.979 3.955-.585 0-.995 0-.995 0" />
      <path d="m11 16.958h6" />
    </svg>
  );
});

CustomAllocateCustomerPointsIcon.displayName =
  "CustomAllocateCustomerPointsIcon";
