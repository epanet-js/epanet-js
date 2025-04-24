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
  borderColor = "black",
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
  viewBox="0 0 780 780"
  version="1.1"
>
  <g>
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:62.4;stroke-linejoin:round"
    />
    <path
      d="M392.89,98.10 L725.4,748.8 H50.33 Z"
      style="fill:${triangleColor};stroke:${borderColor};stroke-width:63.87;stroke-linejoin:round"
    />
  </g>
</svg>
`;
};

export const buildGpvSvg = ({
  width = 64,
  height = 64,
  borderColor = "black",
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
  viewBox="0 0 780 780"
  version="1.1"
>
  <g transform="rotate(-90,390,390)" style="stroke-width:62.4">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      style="fill:${fillColor};stroke:${borderColor}"
    />
    <path
      d="M390.38,389.85 L31.2,705.47 V76.12 Z"
      style="fill:${triangleColor};stroke:${borderColor}"
    />
    <path
      d="M388.62,390.15 L748.8,74.53 V703.88 Z"
      style="fill:${triangleColor};stroke:${borderColor}"
    />
  </g>
</svg>

  `;
};

export const buildFcvSvg = ({
  width = 64,
  height = 64,
  borderColor = "black",
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
  viewBox="0 0 780 780"
  version="1.1"
>
  <g transform="rotate(-90,390,390)">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:62.4"
    />
    <path
      d="M271.4,392.42 L31.2,697.11 V89.55 Z"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:62.4"
    />
    <path
      d="M723.29,392.47 L291.36,720.67 V66.22 Z"
      style="fill:${triangleColor};stroke:${borderColor};stroke-width:62.4"
    />
  </g>
</svg>`;
};

export const buildPbvSvg = ({
  width = 64,
  height = 64,
  borderColor = "black",
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
  viewBox="0 0 780 780"
  version="1.1"
>
  <g transform="rotate(-90,390,390)">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:62.4"
    />
    <path
      d="M463.13,388.91 L31.2,717.11 V62.66 Z"
      style="fill:${triangleColor};stroke:${borderColor};stroke-width:62.4"
    />
    <rect
      x="546.08"
      y="31.2"
      width="202.72"
      height="717.6"
      style="fill:${triangleColor};stroke:${borderColor};stroke-width:62.4"
    />
  </g>
</svg>`;
};
