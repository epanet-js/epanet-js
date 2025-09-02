import * as React from "react";

export const PumpIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & { triangleFillColor?: string }
>(({ triangleFillColor = "currentColor", ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    {...props}
  >
    <g>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        fill={triangleFillColor}
        d="M10.883 7.508a.998.998 0 0 1 1.734 0l4.021 6.994A.999.999 0 0 1 15.771 16H7.729a1 1 0 0 1-.867-1.498l4.021-6.994Z"
      />
    </g>
  </svg>
));

PumpIcon.displayName = "PumpIcon";
