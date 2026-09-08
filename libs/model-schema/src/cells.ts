import { z } from "zod";

export const numberCell = z.number().finite();
export const nullableNumber = numberCell.nullable();

export const intCell = z.number().int();
export const nullableInt = intCell.nullable();

export const textCell = z.string();
export const nullableText = textCell.nullable();

export const flagCell = z.boolean();

export const positionCell = z.array(numberCell).min(2);
export const pathCell = z.array(positionCell).min(2);

export const curvePointsCell = z.array(
  z.object({ x: numberCell, y: numberCell }),
);

export const multipliersCell = z.array(numberCell);
