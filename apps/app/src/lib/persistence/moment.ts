import type { ModelMoment } from "src/hydraulic-model";
import type { CustomAttributesMoment } from "src/lib/custom-attributes/moment";

export type Moment = ModelMoment & {
  customAttributes?: CustomAttributesMoment;
};
