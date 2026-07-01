import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import {
  pipeMaterialsAtom,
  selectedMaterialLabelAtom,
} from "src/state/pipe-library";
import { projectFileInfoAtom } from "src/state/file-system";
import { Store } from "src/state";
import { PipeLibraryDialog } from "./pipe-library-dialog";

const mockTransact = vi.fn();
vi.mock("src/hooks/persistence/use-moment-transaction", () => ({
  useMomentTransaction: () => ({ transact: mockTransact }),
}));

let activeStore: Store | null = null;
const mockPipeLibraryTransact = vi.fn(async (materials: unknown[]) => {
  activeStore?.set(pipeMaterialsAtom, materials as never);
  return Promise.resolve(true);
});
vi.mock("src/hooks/persistence/use-pipe-library-transaction", () => ({
  usePipeLibraryTransaction: () => ({ transact: mockPipeLibraryTransact }),
}));

vi.mock("src/lib/pipe-library/apply-roughness", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("src/lib/pipe-library/apply-roughness")
    >();
  return {
    ...original,
    applyRoughnessMoment: vi.fn(original.applyRoughnessMoment),
  };
});

vi.mock("src/lib/pipe-library/rename-materials", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("src/lib/pipe-library/rename-materials")
    >();
  return {
    ...original,
    renameMaterialsMoment: vi.fn(original.renameMaterialsMoment),
  };
});

import { applyRoughnessMoment } from "src/lib/pipe-library/apply-roughness";
import { renameMaterialsMoment } from "src/lib/pipe-library/rename-materials";

vi.mock("src/lib/pipe-library/export-csv", () => ({
  exportCsv: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("src/lib/pipe-library/export-xlsx", () => ({
  exportXlsx: vi.fn().mockResolvedValue(undefined),
}));

import { exportCsv } from "src/lib/pipe-library/export-csv";
import { exportXlsx } from "src/lib/pipe-library/export-xlsx";

vi.mock("src/components/notifications", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("src/components/notifications")>();
  return {
    ...original,
    notify: vi.fn(),
  };
});

describe("PipeLibraryDialog", () => {
  beforeEach(() => {
    stubUserTracking();
    vi.clearAllMocks();
  });

  it("creates a material with a default age 0 entry", async () => {
    const user = setupUser();
    const store = setInitialState();
    renderDialog(store);

    await addMaterial(user, "Cast Iron");

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Cast Iron");
    expect(materials[0].entries).toEqual([{ age: 0, roughness: 140 }]);
  });

  it("edits roughness and saves", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 130 },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await editCell(user, 0, 1, "120");

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
    expect(materials[0].entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ age: 0, roughness: 120 }),
        expect.objectContaining({ age: 10, roughness: 130 }),
      ]),
    );
  });

  it("renames a material and values stay in place", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 5, roughness: 120 },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Ductile Iron" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Ductile Iron");
    expect(materials[0].entries).toEqual([
      { age: 0, roughness: 100 },
      { age: 5, roughness: 120 },
    ]);
  });

  it("duplicates a material with the same values", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 5, roughness: 120 },
          { age: 10, roughness: 130 },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Cast Iron Copy" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
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
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 20, roughness: 140 },
          { age: 0, roughness: 100 },
          { age: 10, roughness: 130 },
          { age: 5, roughness: 120 },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await editCell(user, 0, 1, "999");

    await clickSave(user);

    const entries = store.get(pipeMaterialsAtom)[0].entries;
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
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      { label: "Cast Iron", entries: [{ age: 5, roughness: 120 }] },
      { label: "PVC", entries: [{ age: 0, roughness: 150 }] },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(
      screen.queryByRole("button", { name: "Cast Iron" }),
    ).not.toBeInTheDocument();

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("PVC");
  });

  it("does not persist changes when cancel is clicked", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      { label: "Cast Iron", entries: [{ age: 5, roughness: 120 }] },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /discard/i }));

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Cast Iron");
  });

  it("disables save when there are no changes", () => {
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      { label: "Cast Iron", entries: [{ age: 5, roughness: 120 }] },
    ]);
    renderDialog(store);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("applies roughness to pipes to hydraulic model when apply button is clicked", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: 120 },
        ],
      },
    ]);
    renderDialog(store);

    const mockMoment = {
      note: "Apply roughness from pipe library",
      patchAssetsAttributes: [
        { id: 1, type: "pipe", properties: { roughness: 120 } },
      ],
    };
    vi.mocked(applyRoughnessMoment).mockReturnValue(mockMoment as never);

    await user.click(screen.getByRole("button", { name: /apply roughness/i }));

    expect(applyRoughnessMoment).toHaveBeenCalled();
    expect(mockTransact).toHaveBeenCalledWith(mockMoment);
  });

  it("propagates material renames to pipes on save", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 120 }] },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    const mockMoment = {
      note: "Rename pipe materials",
      patchAssetsAttributes: [
        { id: 1, type: "pipe", properties: { material: "Ductile Iron" } },
      ],
    };
    vi.mocked(renameMaterialsMoment).mockReturnValue(mockMoment as never);

    await openActionsMenu(user, "Cast Iron");
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));

    const input = screen.getByPlaceholderText("Pipe materials");
    fireEvent.change(input, { target: { value: "Ductile Iron" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await clickSave(user);

    expect(renameMaterialsMoment).toHaveBeenCalled();
    expect(mockTransact).toHaveBeenCalledWith(mockMoment);
  });

  it("highlights cells that fail validation", () => {
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 10, roughness: null },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    expect(getCell(1, 1)).toHaveClass("bg-warning-subtle");
    expect(getCell(1, 0)).not.toHaveClass("bg-warning-subtle");
    expect(getCell(0, 0)).not.toHaveClass("bg-warning-subtle");
    expect(getCell(0, 1)).not.toHaveClass("bg-warning-subtle");
  });

  it("calls exportXlsx when xlsx menu item is clicked", async () => {
    stubFeatureOn("FLAG_EXPORT_PIPE_LIBRARY");
    const user = setupUser();
    const store = setInitialState();
    const materials = [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
    ];
    store.set(pipeMaterialsAtom, materials);
    store.set(projectFileInfoAtom, {
      name: "my-network.inp",
      modelVersion: "1",
    });
    renderDialog(store);

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(
      screen.getByRole("menuitem", {
        name: /microsoft excel spreadsheet/i,
      }),
    );

    expect(exportXlsx).toHaveBeenCalledWith(materials, "my-network");
  });

  it("calls exportCsv when csv menu item is clicked", async () => {
    stubFeatureOn("FLAG_EXPORT_PIPE_LIBRARY");
    const user = setupUser();
    const store = setInitialState();
    const materials = [
      { label: "Cast Iron", entries: [{ age: 0, roughness: 100 }] },
    ];
    store.set(pipeMaterialsAtom, materials);
    store.set(projectFileInfoAtom, {
      name: "my-network.inp",
      modelVersion: "1",
    });
    renderDialog(store);

    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(
      screen.getByRole("menuitem", {
        name: /csv/i,
      }),
    );

    expect(exportCsv).toHaveBeenCalledWith(materials, "my-network");
  });

  it("disables apply roughness when a material fails validation", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 100 },
          { age: 5, roughness: 120 },
          { age: 10, roughness: null },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    expect(
      screen.getByRole("button", { name: /apply roughness/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/cast iron contains invalid values/i),
    ).toBeVisible();

    await editCell(user, 2, 1, "130", "tab");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /apply roughness/i }),
      ).toBeEnabled();
    });
  });
});

const renderDialog = (store: Store) => {
  activeStore = store;
  return render(
    <JotaiProvider store={store}>
      <PipeLibraryDialog />
    </JotaiProvider>,
  );
};

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
