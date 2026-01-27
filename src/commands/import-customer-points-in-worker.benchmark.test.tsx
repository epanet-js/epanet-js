/* eslint-disable no-console */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { Store, stagingModelAtom } from "src/state/jotai";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useImportCustomerPoints } from "./import-customer-points";
import toast from "react-hot-toast";
import { parseInp } from "src/import/inp";
import { promises as fs } from "fs";
import path from "path";

const discoverNetworks = async () => {
  const benchmarkDir = path.join(__dirname, ".benchmark");
  const networks: Array<{
    name: string;
    inpPath: string;
    customerPointsPath: string;
    fileExtension: string;
  }> = [];

  try {
    const entries = await fs.readdir(benchmarkDir, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory());

    for (const dir of directories) {
      const networkDir = path.join(benchmarkDir, dir.name);
      const inpPath = path.join(networkDir, "network.inp");

      // Check for both .geojsonl and .geojson files, prefer .geojsonl
      const geojsonlPath = path.join(networkDir, "customer-points.geojsonl");
      const geojsonPath = path.join(networkDir, "customer-points.geojson");

      let customerPointsPath = "";
      let fileExtension = "";

      try {
        await fs.access(geojsonlPath);
        customerPointsPath = geojsonlPath;
        fileExtension = "geojsonl";
      } catch {
        try {
          await fs.access(geojsonPath);
          customerPointsPath = geojsonPath;
          fileExtension = "geojson";
        } catch {
          console.warn(
            `DEBUG: ⚠️  Network '${dir.name}' skipped - missing customer points file (expected customer-points.geojsonl or customer-points.geojson)`,
          );
          continue;
        }
      }

      try {
        await fs.access(inpPath);
        networks.push({
          name: dir.name,
          inpPath,
          customerPointsPath,
          fileExtension,
        });
      } catch {
        console.warn(
          `DEBUG: ⚠️  Network '${dir.name}' skipped - missing network.inp file`,
        );
      }
    }

    if (networks.length === 0) {
      console.warn(`DEBUG: ⚠️  No valid networks found in ${benchmarkDir}

Expected structure:
  .benchmark/
  ├── network-name/
  │   ├── network.inp
  │   └── customer-points.geojsonl (or .geojson)
  └── another-network/
      ├── network.inp
      └── customer-points.geojson (or .geojsonl)

The benchmark tests will be skipped.`);
    } else {
      console.log(
        `DEBUG: 📊 Found ${networks.length} network(s) for benchmarking: ${networks.map((n) => n.name).join(", ")}`,
      );
    }
  } catch (error) {
    console.warn(`DEBUG: ⚠️  Benchmark directory not found: ${benchmarkDir}`);
  }

  return networks;
};

describe("importCustomerPoints benchmark", () => {
  let networks: Array<{
    name: string;
    inpPath: string;
    customerPointsPath: string;
    fileExtension: string;
  }> = [];

  beforeAll(async () => {
    networks = await discoverNetworks();

    if (networks.length === 0) {
      console.log(
        "DEBUG: No networks found for benchmarking, tests will be skipped",
      );
    } else {
      console.log(
        `DEBUG: 📊 Found ${networks.length} network(s) for benchmarking: ${networks.map((n) => n.name).join(", ")}`,
      );
    }
  });

  beforeEach(() => {
    toast.remove();
  });

  it("runs benchmarks for discovered networks", async () => {
    if (networks.length === 0) {
      console.log("DEBUG: No networks found for benchmarking, skipping test");
      return;
    }

    for (const {
      name,
      inpPath,
      customerPointsPath,
      fileExtension,
    } of networks) {
      console.log(`DEBUG: 🚀 Starting benchmark for network: ${name}`);

      await runSingleNetworkBenchmark({
        name,
        inpPath,
        customerPointsPath,
        fileExtension,
      });

      // Clean up DOM between network iterations to prevent state collision
      cleanup();
      toast.remove();

      console.log(`DEBUG: ✅ Completed benchmark for network: ${name}`);
    }

    console.log(
      `DEBUG: 🏁 Finished benchmarking ${networks.length} network(s)`,
    );
  });
});

const runSingleNetworkBenchmark = async ({
  name,
  inpPath,
  customerPointsPath,
  fileExtension,
}: {
  name: string;
  inpPath: string;
  customerPointsPath: string;
  fileExtension: string;
}) => {
  const inpContent = await fs.readFile(inpPath, "utf-8");
  const { hydraulicModel } = parseInp(inpContent);

  const customerPointsContent = await fs.readFile(customerPointsPath, "utf-8");
  const file = aTestFile({
    filename: `customer-points.${fileExtension}`,
    content: customerPointsContent,
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
  await userEvent.click(screen.getByRole("button", { name: /apply changes/i }));
  await expectSuccessNotification();

  const finishTime = performance.now() - stepStartTime;

  const finalModel = store.get(stagingModelAtom);
  const totalPoints = finalModel.customerPoints.size;
  const totalTime = uploadTime + previewTime + allocationTime + finishTime;

  console.log(
    `DEBUG: [${name}] File upload and parsing: ${uploadTime.toFixed(2)}ms`,
  );
  console.log(
    `DEBUG: [${name}] Data preview step: ${previewTime.toFixed(2)}ms`,
  );
  console.log(
    `DEBUG: [${name}] Customer allocation (full process): ${allocationTime.toFixed(2)}ms`,
  );
  console.log(
    `DEBUG: [${name}] Finish step and notification: ${finishTime.toFixed(2)}ms`,
  );
  console.log(
    `DEBUG: [${name}] Total customer points allocated: ${totalPoints}`,
  );
  console.log(`DEBUG: [${name}] Total time: ${totalTime.toFixed(2)}ms`);

  expect(totalPoints).toBeGreaterThan(0);
  expect(totalTime).toBeLessThan(600000); // 10 minutes max
};

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
      expect(screen.getByText(/Allocation summary/)).toBeInTheDocument();
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
