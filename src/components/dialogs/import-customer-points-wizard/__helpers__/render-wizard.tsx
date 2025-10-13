import React from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { Store } from "src/state/jotai";
import { MemPersistence } from "src/lib/persistence/memory";
import { PersistenceContext } from "src/lib/persistence/context";
import { UIDMap } from "src/lib/id-mapper";
import { ImportCustomerPointsWizard } from "../index";
import { ErrorTrackingProvider } from "src/hooks/use-error-tracking";

export const renderWizard = (store: Store) => {
  const persistence = new MemPersistence(UIDMap.empty(), store);
  return render(
    <ErrorTrackingProvider>
      <PersistenceContext.Provider value={persistence}>
        <JotaiProvider store={store}>
          <ImportCustomerPointsWizard isOpen={true} onClose={() => {}} />
        </JotaiProvider>
      </PersistenceContext.Provider>
    </ErrorTrackingProvider>,
  );
};
