import type { Moment } from "src/lib/persistence/moment";
import type { CustomAttributeValueChange } from "./moment";

export const changeCustomAttributes = (
  changes: CustomAttributeValueChange[],
): Moment => ({
  note: "Change custom attribute",
  customAttributes: { putValues: changes },
});
