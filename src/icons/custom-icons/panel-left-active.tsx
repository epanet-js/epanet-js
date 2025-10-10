import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomPanelLeftActive = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
  const size = getPixels(rawSize);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ref={ref}
      width={size}
      height={size}
      {...props}
    >
      <path d="M3,5l0,14c0,1.104 0.896,2 2,2l14,0c1.104,0 2,-0.896 2,-2l0,-14c0,-1.104 -0.896,-2 -2,-2l-14,0c-1.104,0 -2,0.896 -2,2Z" />
      <path
        d="M9,21l0,-18l-4,0c-1.104,0 -2,0.896 -2,2l0,14c0,1.104 0.896,2 2,2l4,0Z"
        fill="currentColor"
      />
    </svg>
  );
});

CustomPanelLeftActive.displayName = "CustomPanelLeftActive";
