import reservoirPng from "src/map/icons/reservoir.png";
import reservoirOutlinedPng from "src/map/icons/reservoir-outlined.png";
import reservoirSelectedPng from "src/map/icons/reservoir-selected.png";
import triangle from "src/map/icons/triangle.png";
import { withInstrumentation } from "src/infra/with-instrumentation";

export type IconId =
  | "reservoir"
  | "reservoir-outlined"
  | "reservoir-selected"
  | "triangle";
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

type IconsMapping = Record<IconId, IconMapping>;

type IconUrl = { id: IconId; url: string };
export type IconImage = { id: IconId; image: HTMLImageElement };

const iconUrls: IconUrl[] = [
  { id: "reservoir", url: reservoirPng.src },
  { id: "reservoir-outlined", url: reservoirOutlinedPng.src },
  { id: "reservoir-selected", url: reservoirSelectedPng.src },
  {
    id: "triangle",
    url: triangle.src,
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

const fetchImage = async ({ id, url }: IconUrl): Promise<IconImage> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const blob = await response.blob();

  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return { id, image: img };
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
