import { useIsMainLocked } from "src/hooks/use-is-main-locked";

export const useImportCustomerPointsDisabled = () => useIsMainLocked();
