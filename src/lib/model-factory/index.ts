import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";

export { CustomerPointFactory } from "./customer-point-factory";

export type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
};

export const initializeModelFactories = (options?: {
  customerPointIdGenerator?: IdGenerator;
}): ModelFactories => ({
  customerPointFactory: new CustomerPointFactory(
    options?.customerPointIdGenerator ?? new ConsecutiveIdsGenerator(),
  ),
});
