import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";
import { LabelManager } from "src/hydraulic-model/label-manager";

export { CustomerPointFactory } from "./customer-point-factory";

export type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
};

export const initializeModelFactories = (options: {
  idGenerator?: IdGenerator;
  labelManager: LabelManager;
}): ModelFactories => ({
  customerPointFactory: new CustomerPointFactory(
    options.idGenerator ?? new ConsecutiveIdsGenerator(),
    options.labelManager,
  ),
});
