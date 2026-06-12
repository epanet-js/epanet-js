import { AllocationStep } from "./allocation-step";
import { useAllocateCustomerPointsState } from "./wizard-state";

type AllocateCustomerPointsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AllocateCustomerPointsDialog: React.FC<
  AllocateCustomerPointsDialogProps
> = ({ isOpen, onClose }) => {
  const state = useAllocateCustomerPointsState();

  return <AllocationStep isOpen={isOpen} onClose={onClose} state={state} />;
};
