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
  return `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${width}" height="${height}" viewBox="0 0 1024 1024">
  <circle cx="510.07184" cy="508.53308" r="360.74991" fill="${fillColor}" />
  <path fill="${borderColor}" d="M529 108a399 399 0 0 1 389 391 400 400 0 0 1-106 283 415 415 0 0 1-233 127 411 411 0 0 1-365-126 397 397 0 0 1-92-383 403 403 0 0 1 398-293l9 1m40 52-27-3a354 354 0 0 0-385 339 355 355 0 1 0 534-294c-38-20-78-35-122-42z"/>
  <path fill="${triangleColor}" d="m488 273 8-14c8-14 27-14 35 0l36 62 54 93 81 141 50 86c4 6 6 13 3 21s-9 13-18 13c-33 2-65 1-97 1l-71-1H429l-65 1h-67l-12-1c-14-4-19-19-12-31l15-27 107-185 93-159z"/>
</svg>`;
};
