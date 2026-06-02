import { NodeAsset } from ".";

export const isNodeAsset = (asset: unknown): asset is NodeAsset => {
  if (!asset || typeof asset !== "object") return false;
  const type = (asset as { type?: string }).type;
  return type === "junction" || type === "reservoir" || type === "tank";
};
