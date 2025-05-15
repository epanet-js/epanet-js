import { Asset, HydraulicModel } from "src/hydraulic-model";

export const getSortedValues = (
  assets: HydraulicModel["assets"],
  property: string,
  { absValues = false }: { absValues?: boolean } = {},
): number[] => {
  const values: number[] = [];
  for (const asset of [...assets.values()]) {
    const value = asset[property as keyof Asset];
    if (value === undefined || value === null || typeof value !== "number")
      continue;

    values.push(absValues ? Math.abs(value) : value);
  }

  return values.sort((a, b) => a - b);
};
