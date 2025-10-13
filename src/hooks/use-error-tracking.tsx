import { createContext, useContext } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  captureError as captureErrorModule,
  captureWarning as captureWarningModule,
  setUserContext as setUserContextModule,
  setFlagsContext as setFlagsContextModule,
  setErrorContext as setErrorContextModule,
  addToErrorLog as addToErrorLogModule,
} from "src/infra/error-tracking";
import { Plan } from "src/user-plan";

type UserData = {
  id: string;
  email: string;
  plan: Plan;
};

type ErrorTrackingContextValue = {
  captureError: (error: Error) => void;
  captureWarning: (message: string) => void;
  setUserContext: (user: UserData | null) => void;
  setFlagsContext: (flagsEnabled: string[]) => void;
  setErrorContext: (
    name: string,
    context: Parameters<typeof Sentry.setContext>[1],
  ) => void;
  addToErrorLog: (breadcrumbs: Sentry.Breadcrumb) => void;
};

const ErrorTrackingContext = createContext<ErrorTrackingContextValue | null>(
  null,
);

export const ErrorTrackingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const value: ErrorTrackingContextValue = {
    captureError: captureErrorModule,
    captureWarning: captureWarningModule,
    setUserContext: setUserContextModule,
    setFlagsContext: setFlagsContextModule,
    setErrorContext: setErrorContextModule,
    addToErrorLog: addToErrorLogModule,
  };

  return (
    <ErrorTrackingContext.Provider value={value}>
      {children}
    </ErrorTrackingContext.Provider>
  );
};

export const useErrorTracking = (): ErrorTrackingContextValue => {
  const context = useContext(ErrorTrackingContext);

  if (!context) {
    throw new Error(
      "useErrorTracking must be used within an ErrorTrackingProvider",
    );
  }

  return context;
};
