import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListItem } from "./list-item";
import { ItemAction } from "./item-actions";

const setupUser = () => userEvent.setup();

const actions: ItemAction[] = [
  { action: "rename", label: "Rename" },
  { action: "delete", label: "Delete" },
];

describe("ListItem", () => {
  const defaultProps = {
    item: { id: 1, label: "Item One" },
    isSelected: false,
    onSelect: vi.fn(),
  };

  const renderItem = (overrides: Partial<typeof defaultProps> = {}) =>
    render(
      <ul>
        <ListItem {...defaultProps} {...overrides} />
      </ul>,
    );

  it("renders label as a button", () => {
    renderItem();

    expect(
      screen.getByRole("button", { name: "Item One" }),
    ).toBeInTheDocument();
  });

  it("calls onSelect with item id when clicking the button", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    renderItem({ item: { id: 7, label: "Item Seven" }, onSelect });

    await user.click(screen.getByRole("button", { name: "Item Seven" }));

    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("shows actions menu button when actions are provided", () => {
    render(
      <ul>
        <ListItem {...defaultProps} actions={actions} onAction={vi.fn()} />
      </ul>,
    );

    expect(
      screen.getByRole("button", { name: /actions/i }),
    ).toBeInTheDocument();
  });

  it("hides actions menu button when no actions are provided", () => {
    renderItem();

    expect(
      screen.queryByRole("button", { name: /actions/i }),
    ).not.toBeInTheDocument();
  });

  it("hides actions menu button in readOnly mode", () => {
    render(
      <ul>
        <ListItem
          {...defaultProps}
          actions={actions}
          onAction={vi.fn()}
          readOnly
        />
      </ul>,
    );

    expect(
      screen.queryByRole("button", { name: /actions/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onAction with action name and item when a menu item is clicked", async () => {
    const user = setupUser();
    const item = { id: 3, label: "Item Three" };
    const onAction = vi.fn();

    render(
      <ul>
        <ListItem
          item={item}
          isSelected={false}
          onSelect={vi.fn()}
          actions={actions}
          onAction={onAction}
        />
      </ul>,
    );

    await user.click(screen.getByRole("button", { name: /actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /rename/i }));

    expect(onAction).toHaveBeenCalledWith("rename", item);
  });
});
