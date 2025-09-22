import triangle from "src/map/icons/triangle.png";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import {
  buildCheckValveSvg,
  buildFcvSvg,
  buildGpvSvg,
  buildPbvSvg,
  buildPrvSvg,
  buildPsvSvg,
  buildPumpSvg,
  buildTankSvg,
  buildReservoirSvg,
  buildVertexSquareSvg,
} from "./dynamic-icons";
import { colors } from "src/lib/constants";

export type IconId =
  | "reservoir"
  | "reservoir-outlined"
  | "reservoir-selected"
  | "reservoir-highlight"
  | "triangle"
  | "pump-on"
  | "pump-off"
  | "valve-prv-active"
  | "valve-prv-open"
  | "valve-prv-closed"
  | "valve-psv-active"
  | "valve-psv-open"
  | "valve-psv-closed"
  | "valve-tcv-active"
  | "valve-tcv-open"
  | "valve-tcv-closed"
  | "valve-fcv-active"
  | "valve-fcv-open"
  | "valve-fcv-closed"
  | "valve-pbv-active"
  | "valve-pbv-open"
  | "valve-pbv-closed"
  | "pipe-cv-open"
  | "pipe-cv-closed"
  | "tank"
  | "tank-selected"
  | "tank-highlight"
  | "vertex-square"
  | "vertex-square-selected";

export type TextureProps = {
  width: number;
  height: number;
  data: Uint8Array;
};

type IconUrl = { id: IconId; url: string; isSdf?: boolean };
export type IconImage = {
  id: IconId;
  image: HTMLImageElement;
  isSdf?: boolean;
};

const urlFor = (svg: string) => {
  return "data:image/svg+xml;charset=utf-8;base64," + btoa(svg);
};

const iconUrls: IconUrl[] = [
  {
    id: "triangle",
    url: triangle.src,
    isSdf: true,
  },
  {
    id: "pump-on",
    url: urlFor(
      buildPumpSvg({
        borderColor: "none",
        fillColor: colors.green300,
        triangleColor: colors.green800,
      }),
    ),
  },
  {
    id: "pump-off",
    url: urlFor(
      buildPumpSvg({
        borderColor: "none",
        fillColor: colors.red300,
        triangleColor: colors.red700,
      }),
    ),
  },
  {
    id: "valve-prv-active",
    url: urlFor(
      buildPrvSvg({
        triangleColor: colors.green800,
        fillColor: colors.green300,
      }),
    ),
  },
  {
    id: "valve-prv-open",
    url: urlFor(
      buildPrvSvg({
        triangleColor: colors.gray700,
        fillColor: colors.gray300,
      }),
    ),
  },
  {
    id: "valve-prv-closed",
    url: urlFor(
      buildPrvSvg({
        triangleColor: colors.red700,
        fillColor: colors.red300,
      }),
    ),
  },
  {
    id: "valve-psv-active",
    url: urlFor(
      buildPsvSvg({
        triangleColor: colors.green800,
        fillColor: colors.green300,
      }),
    ),
  },
  {
    id: "valve-psv-open",
    url: urlFor(
      buildPsvSvg({
        triangleColor: colors.gray700,
        fillColor: colors.gray300,
      }),
    ),
  },
  {
    id: "valve-psv-closed",
    url: urlFor(
      buildPsvSvg({
        triangleColor: colors.red700,
        fillColor: colors.red300,
      }),
    ),
  },
  {
    id: "valve-tcv-active",
    url: urlFor(
      buildGpvSvg({
        triangleColor: colors.green800,
        fillColor: colors.green300,
      }),
    ),
  },
  {
    id: "valve-tcv-open",
    url: urlFor(
      buildGpvSvg({
        triangleColor: colors.gray700,
        fillColor: colors.gray300,
      }),
    ),
  },
  {
    id: "valve-tcv-closed",
    url: urlFor(
      buildGpvSvg({
        triangleColor: colors.red700,
        fillColor: colors.red300,
      }),
    ),
  },
  {
    id: "valve-fcv-active",
    url: urlFor(
      buildFcvSvg({
        triangleColor: colors.green800,
        fillColor: colors.green300,
      }),
    ),
  },
  {
    id: "valve-fcv-open",
    url: urlFor(
      buildFcvSvg({
        triangleColor: colors.gray700,
        fillColor: colors.gray300,
      }),
    ),
  },
  {
    id: "valve-fcv-closed",
    url: urlFor(
      buildFcvSvg({
        triangleColor: colors.red700,
        fillColor: colors.red300,
      }),
    ),
  },
  {
    id: "valve-pbv-active",
    url: urlFor(
      buildPbvSvg({
        triangleColor: colors.green800,
        fillColor: colors.green300,
      }),
    ),
  },
  {
    id: "valve-pbv-open",
    url: urlFor(
      buildPbvSvg({
        triangleColor: colors.gray700,
        fillColor: colors.gray300,
      }),
    ),
  },
  {
    id: "valve-pbv-closed",
    url: urlFor(
      buildPbvSvg({
        triangleColor: colors.red700,
        fillColor: colors.red300,
      }),
    ),
  },
  {
    id: "pipe-cv-open",
    url: urlFor(
      buildCheckValveSvg({
        triangleColor: colors.gray700,
        fillColor: colors.gray300,
      }),
    ),
  },
  {
    id: "pipe-cv-closed",
    url: urlFor(
      buildCheckValveSvg({
        triangleColor: colors.red700,
        fillColor: colors.red300,
      }),
    ),
  },
  {
    id: "tank",
    url: urlFor(
      buildTankSvg({
        borderColor: colors.indigo800,
        fillColor: colors.indigo300,
      }),
    ),
  },
  {
    id: "tank-selected",
    url: urlFor(
      buildTankSvg({
        borderColor: colors.fuchsia300,
        fillColor: colors.fuchsia500,
      }),
    ),
  },
  {
    id: "tank-highlight",
    url: urlFor(
      buildTankSvg({
        borderColor: colors.indigo300,
        fillColor: colors.indigo800,
      }),
    ),
  },
  {
    id: "reservoir",
    url: urlFor(
      buildReservoirSvg({
        borderColor: colors.indigo800,
        fillColor: colors.indigo300,
      }),
    ),
  },
  {
    id: "reservoir-selected",
    url: urlFor(
      buildReservoirSvg({
        borderColor: colors.fuchsia300,
        fillColor: colors.fuchsia500,
      }),
    ),
  },
  {
    id: "reservoir-highlight",
    url: urlFor(
      buildReservoirSvg({
        borderColor: colors.indigo300,
        fillColor: colors.indigo800,
      }),
    ),
  },
  {
    id: "vertex-square",
    url: urlFor(
      buildVertexSquareSvg({
        borderColor: "white",
        fillColor: colors.indigo600,
      }),
    ),
  },
  {
    id: "vertex-square-selected",
    url: urlFor(
      buildVertexSquareSvg({
        borderColor: "white",
        fillColor: colors.fuchsia500,
      }),
    ),
  },
];

export const prepareIconsSprite = withDebugInstrumentation(
  async (): Promise<IconImage[]> => {
    const iconImages = await Promise.all(
      iconUrls.map((iconUrl) => fetchImage(iconUrl)),
    );

    return iconImages;
  },
  { name: "GENERATE_ICONS_SPRITE", maxDurationMs: 1000 },
);

const fetchImage = async ({ id, url, isSdf }: IconUrl): Promise<IconImage> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const blob = await response.blob();

  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return { id, image: img, isSdf };
};
