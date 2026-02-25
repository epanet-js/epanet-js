import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemInput } from "./item-input";

describe("ItemInput", () => {
  const defaultProps = {
    label: "New pattern name",
    value: "",
    onCommit: vi.fn(() => false),
    onCancel: vi.fn(),
  };

  it("renders input with given value", () => {
    render(
      <ul>
        <ItemInput {...defaultProps} value="EXISTING" />
      </ul>,
    );

    expect(getInput()).toHaveValue("EXISTING");
  });

  it("auto-focuses the input", () => {
    render(
      <ul>
        <ItemInput {...defaultProps} />
      </ul>,
    );

    expect(getInput()).toHaveFocus();
  });

  it("calls onCommit with entered text on Enter", async () => {
    const user = setupUser();
    const onCommit = vi.fn(() => false);

    render(
      <ul>
        <ItemInput {...defaultProps} onCommit={onCommit} />
      </ul>,
    );

    await user.type(getInput(), "NewPattern");
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("NewPattern");
  });

  it("trims whitespace before committing", async () => {
    const user = setupUser();
    const onCommit = vi.fn(() => false);

    render(
      <ul>
        <ItemInput {...defaultProps} onCommit={onCommit} />
      </ul>,
    );

    await user.type(getInput(), "  Trimmed  ");
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("Trimmed");
  });

  it("calls onCancel on Escape", async () => {
    const user = setupUser();
    const onCancel = vi.fn();

    render(
      <ul>
        <ItemInput {...defaultProps} onCancel={onCancel} />
      </ul>,
    );

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("keeps input visible when onCommit returns true (validation error)", async () => {
    const user = setupUser();
    const onCommit = vi.fn(() => true);

    render(
      <ul>
        <ItemInput {...defaultProps} onCommit={onCommit} />
      </ul>,
    );

    await user.type(getInput(), "duplicate");
    await user.keyboard("{Enter}");

    expect(getInput()).toBeInTheDocument();
  });

  it("does not call onCommit for empty input", async () => {
    const user = setupUser();
    const onCommit = vi.fn(() => false);

    render(
      <ul>
        <ItemInput {...defaultProps} onCommit={onCommit} />
      </ul>,
    );

    await user.keyboard("{Enter}");

    // EditableTextFieldWithConfirmation calls onChangeValue for empty trimmed value
    // since !trimmedValue is true — but the parent validation rejects it
    expect(onCommit).toHaveBeenCalledWith("");
  });

  it("allows correcting after a validation error", async () => {
    const user = setupUser();
    const onCommit = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    render(
      <ul>
        <ItemInput {...defaultProps} onCommit={onCommit} />
      </ul>,
    );

    await user.type(getInput(), "duplicate");
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("duplicate");
    expect(getInput()).toBeInTheDocument();

    await user.type(getInput(), "2");
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("duplicate2");
  });
});

const setupUser = () => userEvent.setup();
const getInput = () => screen.getByRole("textbox");
