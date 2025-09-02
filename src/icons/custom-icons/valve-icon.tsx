import * as React from "react";

export const ValveIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & { triangleFillColor?: string }
>(({ ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
  >
    <g>
      <path
        d="M3 3v18.048L21 3v18L3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeMiterlimit="8"
      />
    </g>
  </svg>
));

ValveIcon.displayName = "ValveIcon";
