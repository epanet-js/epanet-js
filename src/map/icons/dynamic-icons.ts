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
  <svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 780 780"
  version="1.1"
>
  <g transform="rotate(90 376.55 390)" stroke-linejoin="round">
    <rect x="31.2" y="31.2" width="717.6" height="717.6" ry="171.86" fill="${fillColor}" opacity=".99" stroke="${borderColor}" stroke-linecap="round" stroke-width="35.498"/>
    <path d="m342.33 391.63 261.9-231.74v462.09z" fill="${triangleColor}" stroke="${triangleColor}" stroke-width="35.498"/>
    <path d="m341.83 391.5-166.73 151.89v-302.86z" fill="${fillColor}" stroke="${triangleColor}" stroke-width="35.494"/>
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
  <svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 780 780"
  version="1.1"
>
  <g transform="rotate(270 376.55 390)" stroke-linejoin="round">
    <rect x="31.2" y="31.2" width="717.6" height="717.6" ry="171.86" fill="${fillColor}" opacity=".99" stroke="${borderColor}" stroke-linecap="round" stroke-width="35.498"/>
    <path d="m342.33 391.63 261.9-231.74v462.09z" fill="${fillColor}" stroke="${triangleColor}" stroke-width="35.498"/>
    <path d="m341.83 391.5-166.73 151.89v-302.86z" fill="${triangleColor}" stroke="${triangleColor}" stroke-width="35.494"/>
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
  <g transform="rotate(90,407.75,390)" style="stroke-width:62.4">
    <rect
      x="31.2"
      y="31.2"
      width="717.6"
      height="717.6"
      ry="171.86"
      style="fill:${fillColor};stroke:${borderColor};stroke-width:35.5;stroke-linecap:round;stroke-linejoin:round"
    />
    <path
      d="M171.31,390 L399.01,209.19v360.53z"
      style="fill:${triangleColor};stroke:${triangleColor};stroke-width:37.54;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M405.6,390 L608.02,208.17v362.57z"
      style="fill:none;stroke:${triangleColor};stroke-width:35.5;stroke-linecap:butt;stroke-linejoin:round"
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
  <svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}j"
  viewBox="0 0 815.5 815.5"
  version="1.1"
>
  <g transform="rotate(90,407.75,390)" style="stroke-width:62.4">
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
      style="fill:${fillColor};stroke:${triangleColor};stroke-width:35.49;stroke-linecap:butt;stroke-linejoin:round"
    />
    <path
      d="M390,210.6v358.8"
      style="fill:none;stroke:${triangleColor};stroke-width:34.05;stroke-linecap:round"
    />
  </g>
</svg>
`;
};
