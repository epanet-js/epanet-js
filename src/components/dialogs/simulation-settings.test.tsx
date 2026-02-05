import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { Store } from "src/state/jotai";
import { SimulationSettingsDialog } from "./simulation-settings";

const renderDialog = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <SimulationSettingsDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

describe("SimulationSettingsDialog", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  describe("switching from Steady State to EPS", () => {
    it("sets default values when switching to EPS with no previous values", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: undefined,
            hydraulicTimestep: undefined,
            reportTimestep: undefined,
            patternTimestep: undefined,
          })
          .build(),
      });

      renderDialog(store);

      const modeSelector = screen.getByRole("combobox", {
        name: /time analysis mode/i,
      });
      await userEvent.click(modeSelector);
      await userEvent.click(screen.getByRole("option", { name: /eps/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/total duration/i)).toHaveValue("24:00");
      });
      expect(screen.getByLabelText(/hydraulic time step/i)).toHaveValue("1:00");
      expect(screen.getByLabelText(/reporting time step/i)).toHaveValue("1:00");
      expect(screen.getByLabelText(/pattern time step/i)).toHaveValue("1:00");
    });

    it("sets default values when switching to EPS with zero values", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 0,
            hydraulicTimestep: 0,
            reportTimestep: 0,
            patternTimestep: 0,
          })
          .build(),
      });

      renderDialog(store);

      const modeSelector = screen.getByRole("combobox", {
        name: /time analysis mode/i,
      });
      await userEvent.click(modeSelector);
      await userEvent.click(screen.getByRole("option", { name: /eps/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/total duration/i)).toHaveValue("24:00");
      });
      expect(screen.getByLabelText(/hydraulic time step/i)).toHaveValue("1:00");
      expect(screen.getByLabelText(/reporting time step/i)).toHaveValue("1:00");
      expect(screen.getByLabelText(/pattern time step/i)).toHaveValue("1:00");
    });

    it("preserves existing values when switching to EPS", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 43200, // 12 hours
            hydraulicTimestep: 7200, // 2 hours
            reportTimestep: 1800, // 30 minutes
            patternTimestep: 3600, // 1 hour
          })
          .build(),
      });

      renderDialog(store);

      const modeSelector = screen.getByRole("combobox", {
        name: /time analysis mode/i,
      });
      await userEvent.click(modeSelector);
      await userEvent.click(screen.getByRole("option", { name: /eps/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/total duration/i)).toHaveValue("12:00");
      });
      expect(screen.getByLabelText(/hydraulic time step/i)).toHaveValue("2:00");
      expect(screen.getByLabelText(/reporting time step/i)).toHaveValue("0:30");
      expect(screen.getByLabelText(/pattern time step/i)).toHaveValue("1:00");
    });

    it("recovers model values when switching back to EPS after going to Steady State", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 43200, // 12 hours
            hydraulicTimestep: 7200, // 2 hours
            reportTimestep: 1800, // 30 minutes
            patternTimestep: 3600, // 1 hour
          })
          .build(),
      });

      renderDialog(store);

      // Verify initial EPS values are shown
      expect(screen.getByLabelText(/total duration/i)).toHaveValue("12:00");

      // Clear the timestep inputs (set to 0) before switching
      const hydraulicInput = screen.getByLabelText(/hydraulic time step/i);
      const reportingInput = screen.getByLabelText(/reporting time step/i);
      const patternInput = screen.getByLabelText(/pattern time step/i);

      await userEvent.clear(hydraulicInput);
      await userEvent.type(hydraulicInput, "0{Enter}");
      await userEvent.clear(reportingInput);
      await userEvent.type(reportingInput, "0{Enter}");
      await userEvent.clear(patternInput);
      await userEvent.type(patternInput, "0{Enter}");

      // Switch to Steady State
      const modeSelector = screen.getByRole("combobox", {
        name: /time analysis mode/i,
      });
      await userEvent.click(modeSelector);
      await userEvent.click(
        screen.getByRole("option", { name: /steady state/i }),
      );

      await waitFor(() => {
        expect(screen.getAllByText("N/A")).toHaveLength(4);
      });

      // Switch back to EPS - should recover original model values
      await userEvent.click(modeSelector);
      await userEvent.click(screen.getByRole("option", { name: /eps/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/total duration/i)).toHaveValue("12:00");
      });
      expect(screen.getByLabelText(/hydraulic time step/i)).toHaveValue("2:00");
      expect(screen.getByLabelText(/reporting time step/i)).toHaveValue("0:30");
      expect(screen.getByLabelText(/pattern time step/i)).toHaveValue("1:00");
    });
  });

  describe("switching from EPS to Steady State", () => {
    it("disables time inputs when switching to Steady State", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 86400,
            hydraulicTimestep: 3600,
            reportTimestep: 3600,
            patternTimestep: 3600,
          })
          .build(),
      });

      renderDialog(store);

      expect(screen.getByLabelText(/total duration/i)).toHaveValue("24:00");

      const modeSelector = screen.getByRole("combobox", {
        name: /time analysis mode/i,
      });
      await userEvent.click(modeSelector);
      await userEvent.click(
        screen.getByRole("option", { name: /steady state/i }),
      );

      await waitFor(() => {
        expect(screen.getAllByText("N/A")).toHaveLength(4);
      });
    });
  });

  describe("validation", () => {
    it("shows error when EPS fields are empty", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 86400,
            hydraulicTimestep: 3600,
            reportTimestep: 3600,
            patternTimestep: 3600,
          })
          .build(),
      });

      renderDialog(store);

      const durationInput = screen.getByLabelText(/total duration/i);
      await userEvent.clear(durationInput);
      await userEvent.tab();

      await waitFor(() => {
        expect(
          screen.getByText(/please fill in all values/i),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });

    it("shows error when EPS fields are zero", async () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 86400,
            hydraulicTimestep: 3600,
            reportTimestep: 3600,
            patternTimestep: 3600,
          })
          .build(),
      });

      renderDialog(store);

      const durationInput = screen.getByLabelText(/total duration/i);
      await userEvent.clear(durationInput);
      await userEvent.type(durationInput, "0");
      await userEvent.tab();

      await waitFor(() => {
        expect(
          screen.getByText(/values must be greater than zero/i),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });

    it("enables save button when all EPS fields are valid", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .eps({
            duration: 86400,
            hydraulicTimestep: 3600,
            reportTimestep: 3600,
            patternTimestep: 3600,
          })
          .build(),
      });

      renderDialog(store);

      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
  });
});
