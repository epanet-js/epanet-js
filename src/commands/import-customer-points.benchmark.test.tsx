/* eslint-disable no-console */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Store, dataAtom } from "src/state/jotai";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useImportCustomerPoints } from "./import-customer-points";
import toast from "react-hot-toast";
import { parseInp } from "src/import/inp";
import { promises as fs } from "fs";
import path from "path";

describe("importCustomerPoints benchmark", () => {
  beforeEach(() => {
    toast.remove();
  });

  it("benchmarks step timing with sample data", async () => {
    const benchmarkDir = path.join(__dirname, ".benchmark");
    const inpPath = path.join(benchmarkDir, "network.inp");
    const geojsonlPath = path.join(benchmarkDir, "customer-points.geojsonl");

    try {
      await fs.access(inpPath);
      await fs.access(geojsonlPath);
    } catch (error) {
      console.warn(`DEBUG: ⚠️  Benchmark data files missing!

Expected files:
  - ${inpPath}
  - ${geojsonlPath}

To run this benchmark test, please provide the required data files in the .benchmark directory.
The test will be skipped.
      `);
      return;
    }

    const inpContent = await fs.readFile(inpPath, "utf-8");
    const { hydraulicModel } = parseInp(inpContent);

    const geojsonlContent = await fs.readFile(geojsonlPath, "utf-8");
    const file = aTestFile({
      filename: "customer-points.geojsonl",
      content: geojsonlContent,
    });

    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerCommand();
    await waitForWizardToOpen();
    expectWizardStep("data input");

    let stepStartTime = performance.now();
    await uploadFileInWizard(file);
    expectWizardStep("data preview");

    const uploadTime = performance.now() - stepStartTime;

    stepStartTime = performance.now();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expectWizardStep("demand options");

    const previewTime = performance.now() - stepStartTime;

    stepStartTime = performance.now();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expectWizardStep("customers allocation");
    await waitForAllocations();

    const allocationTime = performance.now() - stepStartTime;

    stepStartTime = performance.now();
    await userEvent.click(screen.getByRole("button", { name: /finish/i }));
    await expectSuccessNotification();

    const finishTime = performance.now() - stepStartTime;

    const { hydraulicModel: finalModel } = store.get(dataAtom);
    const totalPoints = finalModel.customerPoints.size;
    const totalTime = uploadTime + previewTime + allocationTime + finishTime;

    console.log(`DEBUG: File upload and parsing: ${uploadTime.toFixed(2)}ms`);
    console.log(`DEBUG: Data preview step: ${previewTime.toFixed(2)}ms`);
    console.log(
      `DEBUG: Customer allocation (full process): ${allocationTime.toFixed(2)}ms`,
    );
    console.log(
      `DEBUG: Finish step and notification: ${finishTime.toFixed(2)}ms`,
    );
    console.log(`DEBUG: Total customer points allocated: ${totalPoints}`);
    console.log(`DEBUG: Total time: ${totalTime.toFixed(2)}ms`);

    expect(totalPoints).toBeGreaterThan(0);
    expect(totalTime).toBeLessThan(600000); // 10 minutes max
  });
});

const triggerCommand = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "importCustomerPoints" }),
  );
};

const TestableComponent = () => {
  const importCustomerPoints = useImportCustomerPoints();

  return (
    <button
      aria-label="importCustomerPoints"
      onClick={() => importCustomerPoints({ source: "benchmark" })}
    >
      Import Customer Points
    </button>
  );
};

const renderComponent = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <TestableComponent />
    </CommandContainer>,
  );
};

const waitForWizardToOpen = async () => {
  await waitFor(
    () => screen.getByRole("navigation", { name: /import wizard steps/i }),
    { timeout: 10000 },
  );
};

const uploadFileInWizard = async (file: File) => {
  const dropZone = screen.getByTestId("customer-points-drop-zone");
  expect(dropZone).toBeInTheDocument();

  await userEvent.click(dropZone);

  const fileInput = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  await userEvent.upload(fileInput, file);
};

const waitForAllocations = async () => {
  await waitFor(
    () => {
      expect(
        screen.queryByText("Computing allocations..."),
      ).not.toBeInTheDocument();
    },
    { timeout: 300000 },
  );

  await waitFor(
    () => {
      expect(screen.getByText(/Allocation Summary/)).toBeInTheDocument();
    },
    { timeout: 10000 },
  );
};

const expectWizardStep = (stepName: string) => {
  expect(
    screen.getByRole("tab", {
      name: new RegExp(stepName, "i"),
      current: "step",
    }),
  ).toBeInTheDocument();
};

const expectSuccessNotification = async () => {
  await waitFor(
    () => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    },
    { timeout: 30000 },
  );
};
