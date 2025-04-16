import * as React from "react";

export const PumpIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & { triangleFillColor?: string }
>(({ triangleFillColor = "current", ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -0.8 35.232498 35.232498"
    fill="none"
    stroke="currentColor"
    {...props}
  >
    <g transform="translate(-79.236495,-225.92998)">
      <circle
        cx="96.852745"
        cy="242.74623"
        r="16.58"
        stroke="currentColor"
        strokeWidth="2.0725"
        fill="none"
      />
      <path
        d="M -68.8105,-199.49597 C -69.549008,-199.73664 -77.42937,-237.47192 -76.851686,-237.99115 C -76.274002,-238.51038 -39.08712,-226.71733 -38.926296,-225.95743 C -38.765473,-225.19753 -67.072992,-199.75529 -67.8115,-199.99597 Z"
        transform="matrix(0.29824635,0.25051777,-0.27138933,0.27530931,55.330342,319.49486)"
        fill={triangleFillColor}
        stroke="currentColor"
        strokeWidth="4.6476"
      />
    </g>
  </svg>
));

PumpIcon.displayName = "PumpIcon";
