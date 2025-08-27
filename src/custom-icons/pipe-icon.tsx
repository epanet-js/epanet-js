import * as React from "react";

export const PipeIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & { triangleFillColor?: string }
>(({ ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M4 15v6a.997.997 0 0 1-1 1 .997.997 0 0 1-1-1V3a.997.997 0 0 1 1-1 .997.997 0 0 1 1 1v6h16V3a.997.997 0 0 1 1-1 .997.997 0 0 1 1 1v18a.997.997 0 0 1-1 1 .997.997 0 0 1-1-1v-6H4Z" />
  </svg>
));

PipeIcon.displayName = "PipeIcon";
