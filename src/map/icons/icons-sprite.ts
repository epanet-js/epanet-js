import reservoirPng from "src/map/icons/reservoir.png";
import reservoirOutlinedPng from "src/map/icons/reservoir-outlined.png";
import reservoirSelectedPng from "src/map/icons/reservoir-selected.png";
import triangle from "src/map/icons/triangle.png";
import { withInstrumentation } from "src/infra/with-instrumentation";
import {
  buildFcvSvg,
  buildGpvSvg,
  buildPbvSvg,
  buildPrvSvg,
  buildPumpSvg,
} from "./dynamic-icons";
import { colors } from "src/lib/constants";

export type IconId =
  | "reservoir"
  | "reservoir-outlined"
  | "reservoir-selected"
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
  | "valve-pbv-closed";

export type TextureProps = {
  width: number;
  height: number;
  data: Uint8Array;
};

type IconMapping = {
  x: number;
  y: number;
  width: number;
  height: number;
  mask?: boolean;
};

type IconsMapping = Partial<Record<IconId, IconMapping>>;

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
  { id: "reservoir", url: reservoirPng.src, isSdf: true },
  { id: "reservoir-outlined", url: reservoirOutlinedPng.src, isSdf: true },
  { id: "reservoir-selected", url: reservoirSelectedPng.src, isSdf: true },
  {
    id: "triangle",
    url: triangle.src,
    isSdf: true,
  },
  {
    id: "pump-on",
    url: urlFor(
      buildPumpSvg({
        borderColor: colors.green800,
        fillColor: colors.green300,
        triangleColor: colors.green800,
      }),
    ),
  },
  {
    id: "pump-off",
    url: urlFor(
      buildPumpSvg({
        borderColor: colors.red700,
        fillColor: colors.red300,
        triangleColor: colors.red700,
      }),
    ),
  },
  {
    id: "valve-prv-active",
    url: urlFor(
      buildPrvSvg({
        borderColor: colors.green800,
        triangleColor: colors.green300,
        fillColor: colors.green100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-prv-open",
    url: urlFor(
      buildPrvSvg({
        borderColor: colors.gray700,
        triangleColor: colors.gray300,
        fillColor: colors.gray100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-prv-closed",
    url: urlFor(
      buildPrvSvg({
        borderColor: colors.red700,
        triangleColor: colors.red300,
        fillColor: colors.red100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-psv-active",
    url: urlFor(
      buildPrvSvg({
        borderColor: colors.green800,
        triangleColor: colors.green100,
        fillColor: colors.green300,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-psv-open",
    url: urlFor(
      buildPrvSvg({
        borderColor: colors.gray700,
        triangleColor: colors.gray100,
        fillColor: colors.gray300,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-psv-closed",
    url: urlFor(
      buildPrvSvg({
        borderColor: colors.red700,
        triangleColor: colors.red100,
        fillColor: colors.red300,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-tcv-active",
    url: urlFor(
      buildGpvSvg({
        borderColor: colors.green800,
        triangleColor: colors.green300,
        fillColor: colors.green100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-tcv-open",
    url: urlFor(
      buildGpvSvg({
        borderColor: colors.gray700,
        triangleColor: colors.gray300,
        fillColor: colors.gray100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-tcv-closed",
    url: urlFor(
      buildGpvSvg({
        borderColor: colors.red700,
        triangleColor: colors.red300,
        fillColor: colors.red100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-fcv-active",
    url: urlFor(
      buildFcvSvg({
        borderColor: colors.green800,
        triangleColor: colors.green300,
        fillColor: colors.green100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-fcv-open",
    url: urlFor(
      buildFcvSvg({
        borderColor: colors.gray700,
        triangleColor: colors.gray300,
        fillColor: colors.gray100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-fcv-closed",
    url: urlFor(
      buildFcvSvg({
        borderColor: colors.red700,
        triangleColor: colors.red300,
        fillColor: colors.red100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-pbv-active",
    url: urlFor(
      buildPbvSvg({
        borderColor: colors.green800,
        triangleColor: colors.green300,
        fillColor: colors.green100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-pbv-open",
    url: urlFor(
      buildPbvSvg({
        borderColor: colors.gray700,
        triangleColor: colors.gray300,
        fillColor: colors.gray100,
        width: 56,
        height: 56,
      }),
    ),
  },
  {
    id: "valve-pbv-closed",
    url: urlFor(
      buildPbvSvg({
        borderColor: colors.red700,
        triangleColor: colors.red300,
        fillColor: colors.red100,
        width: 56,
        height: 56,
      }),
    ),
  },
];

const iconsMapping: IconsMapping = {
  reservoir: { x: 0, y: 0, width: 32, height: 32 },
  "reservoir-outlined": { x: 32, y: 0, width: 32, height: 32 },
  "reservoir-selected": { x: 64, y: 0, width: 32, height: 32 },
  triangle: { x: 96, y: 0, width: 64, height: 64, mask: true },
};

export type Sprite = {
  atlas: TextureProps;
  mapping: IconsMapping;
};

const sprite: { current: Sprite | null } = { current: null };

export const getIconsSprite = () => {
  if (!sprite.current) throw new Error("Icons sprite is not ready!");

  return sprite.current;
};

export const prepareIconsSprite = withInstrumentation(
  async (): Promise<IconImage[]> => {
    const iconImages = await Promise.all(
      iconUrls.map((iconUrl) => fetchImage(iconUrl)),
    );
    const { atlas } = buildSprite(iconImages);

    sprite.current = {
      atlas,
      mapping: iconsMapping,
    };

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

const buildSprite = (iconImages: IconImage[]): { atlas: TextureProps } => {
  const { width, height } = calculateCanvasDimensions(iconImages);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }

  let xOffset = 0;
  iconImages.forEach(({ image }) => {
    ctx.drawImage(image, xOffset, 0);
    xOffset += image.width;
  });

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    atlas: {
      width: width,
      height: height,
      data: new Uint8Array(imageData.data.buffer),
    },
  };
};

const calculateCanvasDimensions = (
  images: IconImage[],
): { width: number; height: number } => {
  let width = 0;
  let height = 0;
  for (const { image } of images) {
    if (image.height > height) height = image.height;
    width += image.width;
  }
  return { width, height };
};
