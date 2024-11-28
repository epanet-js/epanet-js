import reservoirPng from "src/map/icons/reservoir.png";
import reservoirOutlinedPng from "src/map/icons/reservoir-outlined.png";

export type IconId = "reservoir" | "reservoir-outlined";
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
};

type IconsMapping = Record<IconId, IconMapping>;

const urls = [reservoirPng.src, reservoirOutlinedPng.src];

const iconsMapping: IconsMapping = {
  reservoir: { x: 0, y: 0, width: 32, height: 32 },
  "reservoir-outlined": { x: 32, y: 0, width: 32, height: 32 },
};

type Sprite = {
  atlas: TextureProps;
  mapping: IconsMapping;
};

const sprite: { current: Sprite | null } = { current: null };

export const getIconsSprite = () => {
  if (!sprite.current) throw new Error("Icons sprite is not ready!");

  return sprite.current;
};

export const prepareIconsSprite = async () => {
  const images = await Promise.all(urls.map((url) => fetchImage(url)));
  const { atlas } = buildSprite(images);

  sprite.current = {
    atlas,
    mapping: iconsMapping,
  };
};

export const fetchIconsAtlas = async () => {
  const images = await Promise.all(urls.map((url) => fetchImage(url)));
  const { atlas } = buildSprite(images);
  return atlas;
};

const fetchImage = async (url: string): Promise<HTMLImageElement> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const blob = await response.blob();

  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return img;
};

const buildSprite = (images: HTMLImageElement[]): { atlas: TextureProps } => {
  const { width, height } = calculateCanvasDimensions(images);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }

  let xOffset = 0;
  images.forEach((image) => {
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
  images: HTMLImageElement[],
): { width: number; height: number } => {
  let width = 0;
  let height = 0;
  for (const image of images) {
    if (image.height > height) height = image.height;
    width += image.width;
  }
  return { width, height };
};
