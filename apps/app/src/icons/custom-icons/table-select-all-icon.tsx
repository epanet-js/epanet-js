import * as React from "react";
import { CustomIconProps, getPixels } from "../index";

export const CustomTableSelectAllIcon = React.forwardRef<
  SVGSVGElement,
  CustomIconProps
>(({ size: rawSize = "md", ...props }, ref) => {
  const size = getPixels(rawSize);
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      strokeWidth="2"
      fillRule="evenodd"
      clipRule="evenodd"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit="10"
      width={size}
      height={size}
      {...props}
    >
      <path d="M16.536,9.464c0.58,-0.58 1.453,-0.754 2.211,-0.44c0.759,0.314 1.253,1.054 1.253,1.875c-0,2.44 -0,5.255 -0,7.101c-0,1.105 -0.895,2 -2,2l-7.172,-0c-0.809,-0 -1.538,-0.487 -1.847,-1.235c-0.31,-0.747 -0.139,-1.607 0.433,-2.179c2.163,-2.163 4.95,-4.95 7.122,-7.122Z" />
    </svg>
  );
});

CustomTableSelectAllIcon.displayName = "CustomTableSelectAllIcon";
