import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomPanelRightActive = React.forwardRef<
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      ref={ref}
      width={size}
      height={size}
      {...props}
    >
      <path d="M21,5l0,14c0,1.104 -0.896,2 -2,2l-14,0c-1.104,0 -2,-0.896 -2,-2l0,-14c0,-1.104 0.896,-2 2,-2l14,0c1.104,0 2,0.896 2,2Z" />
      <path
        d="M15,21l0,-18l4,0c1.104,0 2,0.896 2,2l-0,14c-0,1.104 -0.896,2 -2,2l-4,0Z"
        fill="currentColor"
      />
    </svg>
  );
});

CustomPanelRightActive.displayName = "CustomPanelRightActive";
