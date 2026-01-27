import React from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { Store } from "src/state/jotai";
import { MemPersistenceDeprecated } from "src/lib/persistence/memory-deprecated";
import { PersistenceContext } from "src/lib/persistence/context";
import { ImportCustomerPointsWizard } from "../index";

export const renderWizard = (store: Store) => {
  const persistence = new MemPersistenceDeprecated(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <ImportCustomerPointsWizard isOpen={true} onClose={() => {}} />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};
