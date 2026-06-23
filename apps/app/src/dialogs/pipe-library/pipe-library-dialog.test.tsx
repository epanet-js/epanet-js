import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import {
  pipeMaterialsAtom,
  selectedMaterialLabelAtom,
} from "src/state/pipe-library";
import { Store } from "src/state";
import { PipeLibraryDialog } from "./pipe-library-dialog";

const mockTransact = vi.fn();
vi.mock("src/hooks/persistence/use-model-transaction", () => ({
  useModelTransaction: () => ({ transact: mockTransact }),
}));

vi.mock("./apply-roughness", async (importOriginal) => {
  const original = await importOriginal<typeof import("./apply-roughness")>();
  return {
    ...original,
    applyRoughnessMoment: vi.fn(original.applyRoughnessMoment),
  };
});

import { applyRoughnessMoment } from "./apply-roughness";

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

  it("creates a material and sets values in two rows", async () => {
    const user = setupUser();
    const store = setInitialState();
    renderDialog(store);

    await addMaterial(user, "Cast Iron");

    await editCell(user, 0, 0, "5");
    await editCell(user, 0, 1, "120");
    await editCell(user, 1, 0, "10");
    await editCell(user, 1, 1, "130");

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Cast Iron");
    expect(materials[0].entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ age: 5, roughness: 120 }),
        expect.objectContaining({ age: 10, roughness: 130 }),
      ]),
    );
  });

  it("renames a material and values stay in place", async () => {
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
    fireEvent.change(input, { target: { value: "Ductile Iron" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await clickSave(user);

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("Ductile Iron");
    expect(materials[0].entries).toEqual([{ age: 5, roughness: 120 }]);
  });

  it("duplicates a material with the same values", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
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
      { age: 5, roughness: 120 },
      { age: 10, roughness: 130 },
    ]);
  });

  it("sorts entries by age ascending, empty ages at bottom", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
          { age: 20, roughness: 140 },
          { age: 5, roughness: 120 },
          { age: null, roughness: null },
          { age: 10, roughness: 130 },
        ],
      },
    ]);
    store.set(selectedMaterialLabelAtom, "Cast Iron");
    renderDialog(store);

    await editCell(user, 0, 1, "999");

    await clickSave(user);

    const entries = store.get(pipeMaterialsAtom)[0].entries;
    const nonEmpty = entries.filter(
      (e) => e.age !== null || e.roughness !== null,
    );
    expect(nonEmpty).toEqual([
      { age: 5, roughness: 999 },
      { age: 10, roughness: 130 },
      { age: 20, roughness: 140 },
    ]);
    expect(entries[entries.length - 1]).toEqual({
      age: null,
      roughness: null,
    });
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
      { label: "Cast Iron", entries: [{ age: 10, roughness: 120 }] },
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

  it("disables apply roughness when a material fails validation", async () => {
    const user = setupUser();
    const store = setInitialState();
    store.set(pipeMaterialsAtom, [
      {
        label: "Cast Iron",
        entries: [
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

    await editCell(user, 1, 1, "130");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /apply roughness/i }),
      ).toBeEnabled();
    });
  });
});

const renderDialog = (store: Store) => {
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
) => {
  const cell = getCell(rowIndex, colIndex);
  await user.dblClick(cell);
  await waitFor(() => {
    expect(within(cell).getByRole("textbox")).not.toHaveAttribute("readonly");
  });
  const input = within(cell).getByRole("textbox");
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
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
