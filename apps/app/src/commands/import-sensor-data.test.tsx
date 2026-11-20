import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { splitsAtom } from "src/state/layout";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { createSensorsPanel } from "src/panels/sensors/create-panel";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useImportSensorData } from "./import-sensor-data";

const SENSOR: ImportedSensor = {
  name: "NORTH",
  parameter: "pressure",
  assetId: 1,
  readings: [10, 11],
};

const sensorsPanels = (store: Store) =>
  store.get(panelsAtom).filter((panel) => panel.type === "sensors");

beforeEach(() => {
  stubUserTracking();
});

describe("useImportSensorData", () => {
  it("opens the sensors panel after importing", async () => {
    const store = setInitialState();
    store.set(panelsAtom, []);

    await importSensors(store);

    expect(sensorsPanels(store)).toHaveLength(1);
    expect(store.get(activePanelIn("bottom"))?.panel.type).toEqual("sensors");
    expect(store.get(splitsAtom).bottomOpen).toBe(true);
  });

  it("activates the open sensors panel rather than adding another", async () => {
    const store = setInitialState();
    store.set(panelsAtom, [createSensorsPanel({ id: "sensors" })]);

    await importSensors(store);

    expect(sensorsPanels(store)).toHaveLength(1);
    expect(store.get(activePanelIn("bottom"))?.id).toEqual("sensors");
  });

  it("opens a panel with every sensor when only a scoped one is open", async () => {
    const store = setInitialState();
    store.set(panelsAtom, [
      createSensorsPanel({ id: "scoped", assetIds: [1] }),
    ]);

    await importSensors(store);

    expect(sensorsPanels(store)).toHaveLength(2);
    expect(store.get(activePanelIn("bottom"))?.id).not.toEqual("scoped");
  });
});

const Trigger = () => {
  const importSensorData = useImportSensorData();
  return (
    <button
      aria-label="import"
      onClick={() =>
        importSensorData([SENSOR], { skippedCount: 0, hasTimingWarning: false })
      }
    >
      Import
    </button>
  );
};

const importSensors = async (store: Store) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "import" }));
};
