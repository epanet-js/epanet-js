export const buildPumpSvg = ({
  width = 64,
  height = 64,
  borderColor = "black",
  fillColor = "white",
  triangleColor = "black",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  fillColor?: string;
  triangleColor?: string;
}) => {
  return `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -0.8 35.232498 35.232498"
    fill="none"
    stroke="currentColor"
    width="${width}"
    height="${height}"
  >
    <g transform="translate(-79.236495,-225.92998)">
      <circle
        cx="96.852745"
        cy="242.74623"
        r="16.58"
        stroke="${borderColor}"
        stroke-width="2.0725"
        fill="${fillColor}"
      />
      <path
        d="M -68.8105,-199.49597 C -69.549008,-199.73664 -77.42937,-237.47192 -76.851686,-237.99115 C -76.274002,-238.51038 -39.08712,-226.71733 -38.926296,-225.95743 C -38.765473,-225.19753 -67.072992,-199.75529 -67.8115,-199.99597 Z"
        transform="matrix(0.29824635,0.25051777,-0.27138933,0.27530931,55.330342,319.49486)"
        fill="${triangleColor}"
        stroke="${triangleColor}"
        stroke-width="4.6476"
      />
    </g>
  </svg>
  `;
};

export const buildPrvSvg = ({
  width = 64,
  height = 64,
  borderColor = "none",
  fillColor = "white",
  triangleColor = "black",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  triangleColor?: string;
  fillColor?: string;
} = {}) => {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 815.5 815.5" version="1.1">
  <g transform="rotate(-90,407.75,390)" style="stroke-width:62.4">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      ry="171.86"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:round"
    />
    <path
      d="M436.8,390L600.6,239.57v299.95z"
      style="fill:${fillColor};stroke:${triangleColor};stroke-width:44.95;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M447.98,390L179.6,631.54V149.91z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:47.11;stroke-linecap:butt;stroke-linejoin:round"
    />
  </g>
</svg>

  `;
};

export const buildPsvSvg = ({
  width = 64,
  height = 64,
  borderColor = "none",
  fillColor = "white",
  triangleColor = "black",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  triangleColor?: string;
  fillColor?: string;
} = {}) => {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 815.5 815.5" version="1.1">
  <g transform="rotate(-90,407.75,390)" style="stroke-width:62.4">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      ry="171.86"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:round"
    />
    <path
      d="M343.2,390L179.4,239.57v299.95z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:44.95;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M332.02,390L600.4,631.54V149.91z"
      style="fill:${fillColor};stroke:${triangleColor};stroke-width:47.11;stroke-linecap:butt;stroke-linejoin:round"
    />
  </g>
</svg>
  `;
};

export const buildGpvSvg = ({
  width = 64,
  height = 64,
  borderColor = "none",
  fillColor = "white",
  triangleColor = "black",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  triangleColor?: string;
  fillColor?: string;
} = {}) => {
  return `
  <svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 815.5 815.5"
  version="1.1"
>
  <g transform="rotate(-90,407.75,390)" style="stroke-width:62.4">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      ry="171.86"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:round"
    />
    <path
      d="M390.38,388.66L592.8,206.83v362.57z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:35.5;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M386.44,390L184.02,571.83V209.26z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:35.49;stroke-linecap:butt;stroke-linejoin:round"
    />
  </g>
</svg>
`;
};

export const buildFcvSvg = ({
  width = 64,
  height = 64,
  borderColor = "none",
  fillColor = "white",
  triangleColor = "black",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  triangleColor?: string;
  fillColor?: string;
} = {}) => {
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 815.5 815.5"
  version="1.1"
>
  <g transform="rotate(-90,407.75,390)" style="stroke-width:62.4">
    <rect
      x="-748.8"
      y="31.2"
      width="717.6"
      height="717.6"
      ry="171.86"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:round"
      transform="scale(-1,1)"
    />
    <path
      d="M389.62,388.66L187.2,206.83v362.57z"
      style="fill:${fillColor};stroke:${triangleColor};stroke-width:35.5;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M595.98,390l-202.42,181.83V209.26z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:35.5;stroke-linecap:butt;stroke-linejoin:round"
    />
  </g>
</svg>
`;
};

export const buildPbvSvg = ({
  width = 64,
  height = 64,
  borderColor = "none",
  fillColor = "white",
  triangleColor = "black",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  triangleColor?: string;
  fillColor?: string;
} = {}) => {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 815.5 815.5" version="1.1">
  <g transform="rotate(-90,407.75,390)" style="stroke-width:62.4">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      ry="171.86"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:round"
    />
    <path
      d="M390.38,388.66L592.8,206.83v362.57z"
      style="fill:${fillColor};stroke:${triangleColor};stroke-width:35.5;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M386.44,390L184.02,571.83V209.26z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:35.5;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M390,195v382.2"
      style="fill:none;stroke:${triangleColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:miter"
    />
  </g>
</svg>
`;
};

export const buildTankSvg = ({
  width = 64,
  height = 64,
  borderColor = "black",
  fillColor = "white",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  fillColor?: string;
}) => {
  const viewboxWidth = 32;
  const viewboxHeight = 32;

  const rectWidth = 28;
  const rectHeight = 22;

  const rectX = (viewboxWidth - rectWidth) / 2;
  const rectY = (viewboxHeight - rectHeight) / 2;

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${viewboxWidth} ${viewboxHeight}"
      fill="none"
      stroke="currentColor"
      width="${width}"
      height="${height}"
    >
      <rect
        x="${rectX}"
        y="${rectY}"
        width="${rectWidth}"
        height="${rectHeight}"
        stroke="${borderColor}"
        stroke-width="2"
        fill="${fillColor}"
        rx="2" />
    </svg>
  `;
};

export const buildReservoirSvg = ({
  width = 64,
  height = 64,
  borderColor = "black",
  fillColor = "white",
}: {
  width?: number;
  height?: number;
  borderColor?: string;
  fillColor?: string;
}) => {
  const viewboxWidth = 32;
  const viewboxHeight = 32;

  const triangleHeight = 24;
  const triangleBase = 28;

  const p1x = (viewboxWidth - triangleBase) / 2;
  const p1y = (viewboxHeight + triangleHeight) / 2;

  const p2x = (viewboxWidth + triangleBase) / 2;
  const p2y = (viewboxHeight + triangleHeight) / 2;

  const p3x = viewboxWidth / 2;
  const p3y = (viewboxHeight - triangleHeight) / 2;

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${viewboxWidth} ${viewboxHeight}"
      fill="none"
      stroke="currentColor"
      width="${width}"
      height="${height}"
    >
      <polygon
        points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}"
        stroke="${borderColor}"
        stroke-width="2"
        fill="${fillColor}"
      />
    </svg>
  `;
};
