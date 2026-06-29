import type { Moment } from "src/lib/persistence/moment";
import type { CustomAttributeValueChange } from "./moment";

export const changeCustomAttribute = (
  change: CustomAttributeValueChange,
): Moment => ({
  note: "Change custom attribute",
  customAttributes: { putValues: [change] },
});
