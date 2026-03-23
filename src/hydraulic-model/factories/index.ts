import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";
import { LabelManager } from "src/hydraulic-model/label-manager";

export { CustomerPointFactory } from "./customer-point-factory";

export type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
};

export const initializeModelFactories = (options?: {
  customerPointIdGenerator?: IdGenerator;
  labelManager?: LabelManager;
}): ModelFactories => ({
  customerPointFactory: new CustomerPointFactory(
    options?.customerPointIdGenerator ?? new ConsecutiveIdsGenerator(),
    options?.labelManager,
  ),
});
