import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { selectedMaterialLabelAtom } from "src/state/pipe-library";
import { Store } from "src/state";
import { PipeLibraryDialog } from "./pipe-library-dialog";

const mockTransact = vi.fn();
vi.mock("src/hooks/persistence/use-moment-transaction", () => ({
  useMomentTransaction: () => ({ transact: mockTransact }),
}));

const { mockRenameAssignments, mockChangeProperty } = vi.hoisted(() => ({
  mockRenameAssignments: vi.fn(),
  mockChangeProperty: vi.fn(),
}));

vi.mock("src/dialogs/pipe-library/rename-materials", () => ({
  renameAssignments: mockRenameAssignments,
}));
vi.mock("src/hydraulic-model/model-operations/change-property", () => ({
  changeProperty: mockChangeProperty,
}));

const mockImportFromFile = vi.fn();
vi.mock("src/commands/import-pipe-library", () => ({
  useImportPipeLibrary: () => mockImportFromFile,
}));

const mockExportToCsv = vi.fn().mockResolvedValue(undefined);
const mockExportToXlsx = vi.fn().mockResolvedValue(undefined);
vi.mock("src/commands/export-pipe-library", () => ({
  useExportPipeLibrary: () => ({
    exportToCsv: mockExportToCsv,
    exportToXlsx: mockExportToXlsx,
  }),
}));

vi.mock("src/components/notifications", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("src/components/notifications")>();
  return {
    ...original,
    notify: vi.fn(),
  };
});

// The library lives on the model now; seed it there and read back the
// materials from the emitted `putPipeMaterials` moment (transact is mocked).
const seededStore = (
  pipeMaterials: PipeMaterial[],
  selectedLabel?: string,
): Store => {
  const builder = HydraulicModelBuilder.with();
  pipeMaterials.forEach((material) => builder.aPipeMaterial(material));
  const store = setInitialState({ hydraulicModel: builder.build() });
  if (selectedLabel) store.set(selectedMaterialLabelAtom, selectedLabel);
  return store;
};

const lastSavedMaterials = (): PipeMaterial[] => {
  const calls = mockTransact.mock.calls;
  return calls[calls.length - 1][0].putPipeMaterials as PipeMaterial[];
};

describe("PipeLibraryDialog", () => {
  beforeEach(() => {
    stubUserTracking();
    vi.clearAllMocks();
    mockRenameAssignments.mockReturnValue([]);
    mockChangeProperty.mockReturnValue({ patchAssetsAttributes: [] });
  });

  it("creates a material with a default age 0 entry", async () => {
    const user = setupUser();
    const store = seededStore([]);
    renderDialog(store);

    await addMaterial(user, "Cast Iron");

    await clickSave(user);

    const materials = lastSavedMaterials();
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Cast Iron");
    expect(materials[0].entries).toEqual([{ age: 0, roughness: 140 }]);
  });

  it("edits roughness and saves", async () => {
    const user = setupUser();
    const store = seededStore(
      [
        {
          label: "Cast Iron",
          entries: [
            { age: 0, roughness: 100 },
            { age: 10, roughness: 130 },
          ],
        },
      ],
      "Cast Iron",
    );
    renderDialog(store);

    await editCell(user, 0, 1, "120");

    await clickSave(user);

    const materials = lastSavedMaterials();
    expect(materials[0].entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ age: 0, roughness: 120 }),
        expect.objectContaining({ age: 10, roughness: 130 }),
      ]),
    );
  });

  it("renames a material, preserves values, and propagates to pipes on save", async () => {
    const user = setupUser();
    const store = seededStore(
      [
        {
          label: "Cast Iron",
          entries: [
            { age: 0, roughness: 100 },
            { age: 5, roughness: 120 },
          ],
        },
      ],
      "Cast Iron",
    );
    renderDialog(store);

    const patch = {
      id: 1,
      type: "pipe",
      properties: { material: "Ductile Iron" },
    };
    mockRenameAssignments.mockReturnValue([
      { assetIds: [1], material: "Ductile Iron" },
    ]);
    mockChangeProperty.mockReturnValue({ patchAssetsAttributes: [patch] });

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Ductile Iron" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await clickSave(user);

    const materials = lastSavedMaterials();
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Ductile Iron");
    expect(materials[0].entries).toEqual([
      { age: 0, roughness: 100 },
      { age: 5, roughness: 120 },
    ]);

    expect(mockRenameAssignments).toHaveBeenCalled();
    expect(mockChangeProperty).toHaveBeenCalledWith(expect.anything(), {
      assetIds: [1],
      property: "material",
      value: "Ductile Iron",
    });
    // One atomic moment carries both the library replacement and the
    // material rename patches.
    expect(mockTransact).toHaveBeenCalledWith(
      expect.objectContaining({ patchAssetsAttributes: [patch] }),
    );
  });

  it("duplicates a material with the same values", async () => {
    const user = setupUser();
    const store = seededStore(
      [
        {
          label: "Cast Iron",
          entries: [
            { age: 0, roughness: 100 },
            { age: 5, roughness: 120 },
            { age: 10, roughness: 130 },
          ],
        },
      ],
      "Cast Iron",
    );
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Cast Iron Copy" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await clickSave(user);

    const materials = lastSavedMaterials();
    expect(materials).toHaveLength(2);
    expect(materials[1].label).toBe("Cast Iron Copy");
    expect(materials[1].entries).toEqual([
      { age: 0, roughness: 100 },
      { age: 5, roughness: 120 },
      { age: 10, roughness: 130 },
    ]);
  });

  it("sorts entries by age ascending", async () => {
    const user = setupUser();
    const store = seededStore(
      [
        {
          label: "Cast Iron",
          entries: [
            { age: 20, roughness: 140 },
            { age: 0, roughness: 100 },
            { age: 10, roughness: 130 },
            { age: 5, roughness: 120 },
          ],
        },
      ],
      "Cast Iron",
    );
    renderDialog(store);

    await editCell(user, 0, 1, "999");

    await clickSave(user);

    const entries = lastSavedMaterials()[0].entries;
    const filled = entries.filter(
      (e) => e.age !== null || e.roughness !== null,
    );
    expect(filled).toEqual([
      { age: 0, roughness: 999 },
      { age: 5, roughness: 120 },
      { age: 10, roughness: 130 },
      { age: 20, roughness: 140 },
    ]);
  });

  it("removes a material", async () => {
    const user = setupUser();
    const store = seededStore(
      [
        { label: "Cast Iron", entries: [{ age: 5, roughness: 120 }] },
        { label: "PVC", entries: [{ age: 0, roughness: 150 }] },
      ],
      "Cast Iron",
    );
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(
      screen.queryByRole("button", { name: "Cast Iron" }),
    ).not.toBeInTheDocument();

    await clickSave(user);

    const materials = lastSavedMaterials();
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("PVC");
  });

  it("does not persist changes when cancel is clicked", async () => {
    const user = setupUser();
    const store = seededStore(
      [{ label: "Cast Iron", entries: [{ age: 5, roughness: 120 }] }],
      "Cast Iron",
    );
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /discard/i }));

    expect(mockTransact).not.toHaveBeenCalled();
  });

  it("disables save when there are no changes", () => {
    const store = seededStore([
      { label: "Cast Iron", entries: [{ age: 5, roughness: 120 }] },
    ]);
    renderDialog(store);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("highlights invalid cells and disables save until fixed", async () => {
    const user = setupUser();
    const store = seededStore(
      [
        {
          label: "Cast Iron",
          entries: [
            { age: 0, roughness: 100 },
            { age: 5, roughness: 120 },
            { age: 10, roughness: null },
          ],
        },
      ],
      "Cast Iron",
    );
    renderDialog(store);

    expect(getCell(2, 1)).toHaveClass("bg-warning-subtle");
    expect(getCell(0, 0)).not.toHaveClass("bg-warning-subtle");
    expect(getCell(0, 1)).not.toHaveClass("bg-warning-subtle");
    expect(getCell(1, 0)).not.toHaveClass("bg-warning-subtle");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      screen.getByText(/cast iron contains invalid values/i),
    ).toBeVisible();

    await editCell(user, 2, 1, "130", "tab");

    await waitFor(() => {
      expect(getCell(2, 1)).not.toHaveClass("bg-warning-subtle");
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("exports in csv and xlsx formats", async () => {
    const user = setupUser();
    const materials = [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
    ];
    const store = seededStore(materials);
    renderDialog(store);

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("menuitem", { name: /csv/i }));
    expect(mockExportToCsv).toHaveBeenCalledWith(materials);

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(
      screen.getByRole("menuitem", {
        name: /microsoft excel spreadsheet/i,
      }),
    );
    expect(mockExportToXlsx).toHaveBeenCalledWith(materials);
  });

  describe("importing from a file", () => {
    const importing = (
      pipeLibrary: PipeMaterial[],
      status: "success" | "partial" | "error" = "success",
    ) =>
      mockImportFromFile.mockResolvedValue({
        status,
        format: "csv",
        pipeLibrary,
        errors: [],
      });

    const confirmImport = async (user: ReturnType<typeof setupUser>) => {
      await user.click(screen.getByRole("button", { name: /^import$/i }));
      await user.click(screen.getByRole("menuitem", { name: /from file/i }));
      await user.click(screen.getByRole("button", { name: /continue/i }));
    };

    it("reports over the empty state, dropping the selected material", async () => {
      const user = setupUser();
      const store = seededStore(
        [{ label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] }],
        "Cast Iron",
      );
      importing([{ label: "PVC", entries: [{ age: 0, roughness: 150 }] }]);

      renderDialog(store);
      await confirmImport(user);

      expect(await screen.findByText(/imported 1 material/i)).toBeVisible();
      expect(screen.getByText(/select a material/i)).toBeVisible();
      expect(screen.getByRole("button", { name: /^import$/i })).toBeVisible();
    });

    it("forgets the report once a material is selected", async () => {
      const user = setupUser();
      const store = seededStore([
        { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
      ]);
      importing([{ label: "PVC", entries: [{ age: 0, roughness: 150 }] }]);

      renderDialog(store);
      await confirmImport(user);
      const report = await screen.findByText(/imported 1 material/i);

      await user.click(screen.getByRole("button", { name: "PVC" }));

      expect(report).not.toBeInTheDocument();
    });

    it("reports a failure without touching the draft", async () => {
      const user = setupUser();
      const materials = [
        { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
      ];
      const store = seededStore(materials);
      mockImportFromFile.mockResolvedValue({
        status: "error",
        format: "csv",
        errors: [{ message: "pipeLibrary.import.emptyFile" }],
      });

      renderDialog(store);
      await confirmImport(user);

      expect(await screen.findByText(/failed to import/i)).toBeVisible();
      expect(screen.getByRole("button", { name: "Cast Iron" })).toBeVisible();
    });
  });
});

const renderDialog = (store: Store) =>
  render(
    <JotaiProvider store={store}>
      <PipeLibraryDialog />
    </JotaiProvider>,
  );

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const getCell = (rowIndex: number, colIndex: number) => {
  const gridCells = screen.getAllByRole("gridcell");
  return gridCells[rowIndex * 3 + colIndex];
};

const editCell = async (
  user: ReturnType<typeof setupUser>,
  rowIndex: number,
  colIndex: number,
  value: string,
  commit: "enter" | "tab" = "enter",
) => {
  const cell = getCell(rowIndex, colIndex);
  await user.dblClick(cell);
  await waitFor(() => {
    expect(within(cell).getByRole("textbox")).not.toHaveAttribute("readonly");
  });
  const input = within(cell).getByRole("textbox");
  fireEvent.change(input, { target: { value } });
  if (commit === "tab") {
    await user.tab();
  } else {
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  }
};

const addMaterial = async (
  user: ReturnType<typeof setupUser>,
  name: string,
) => {
  await user.click(screen.getByRole("button", { name: "Pipe materials" }));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
};

const openActionsMenu = async (
  user: ReturnType<typeof setupUser>,
  materialName: string,
) => {
  await user.click(screen.getByRole("button", { name: materialName }));
  const listItem = screen.getByRole("button", { name: materialName });
  const actionsButton = within(listItem.closest("li")!).getByRole("button", {
    name: "Actions",
  });
  await user.click(actionsButton);
};

const clickSave = async (user: ReturnType<typeof setupUser>) => {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
  await user.click(screen.getByRole("button", { name: "Save" }));
};
