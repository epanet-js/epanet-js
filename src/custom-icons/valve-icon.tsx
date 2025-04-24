import * as React from "react";

export const ValveIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & { triangleFillColor?: string }
>(({ ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 780 780"
    {...props}
  >
    <g>
      <path
        d="M390.38,389.85 L31.2,705.47 V76.12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="62.4"
        strokeLinejoin="round"
      />
      <path
        d="M388.62,390.15 L748.8,74.53 V703.88 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="62.4"
        strokeLinejoin="round"
      />
    </g>
  </svg>
));

ValveIcon.displayName = "ValveIcon";
