import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import {
  pipeMaterialsAtom,
  selectedMaterialLabelAtom,
} from "src/state/pipe-library";
import { Store } from "src/state";
import { PipeLibraryDialog } from "./pipe-library-dialog";

describe("PipeLibraryDialog", () => {
  beforeEach(() => {
    stubUserTracking();
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
    await user.clear(input);
    await user.type(input, "Ductile Iron{Enter}");

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
    await user.clear(input);
    await user.type(input, "Cast Iron Copy{Enter}");

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(2);
    expect(materials[1].label).toBe("Cast Iron Copy");
    expect(materials[1].entries).toEqual([
      { age: 5, roughness: 120 },
      { age: 10, roughness: 130 },
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

    const materials = store.get(pipeMaterialsAtom);
    expect(materials).toHaveLength(1);
    expect(materials[0].label).toBe("PVC");
    expect(
      screen.queryByRole("button", { name: "Cast Iron" }),
    ).not.toBeInTheDocument();
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
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
};

const addMaterial = async (
  user: ReturnType<typeof setupUser>,
  name: string,
) => {
  await user.click(screen.getByRole("button", { name: "Pipe materials" }));
  const input = screen.getByRole("textbox");
  await user.type(input, `${name}{Enter}`);
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
