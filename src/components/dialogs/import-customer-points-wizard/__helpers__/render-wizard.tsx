import React from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { Store } from "src/state/jotai";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { ImportCustomerPointsWizard } from "../index";

export const renderWizard = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <ImportCustomerPointsWizard isOpen={true} onClose={() => {}} />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};
