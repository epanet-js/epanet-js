import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableTextField } from "./editable-text-field";

describe("EditableTextField", () => {
  describe("cleanLabel", () => {
    it("transforms typed input via the provided cleaner", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();
      const upper = (raw: string) => raw.toUpperCase();

      render(
        <EditableTextField
          label="test"
          value=""
          onChangeValue={onChangeValue}
          sanitize={upper}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "hello");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("HELLO");
    });

    it("does not transform input when cleanLabel is omitted", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value=""
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "anything; goes");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("anything; goes");
    });
  });

  describe("commit behavior", () => {
    it("commits on Enter", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value="original"
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "new value");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("new value");
    });

    it("resets on Escape", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value="original"
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "new value");
      await user.keyboard("{Escape}");

      expect(onChangeValue).not.toHaveBeenCalled();
      expect(input).toHaveValue("original");
    });

    it("does not commit if value is unchanged", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value="original"
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.keyboard("{Enter}");

      expect(onChangeValue).not.toHaveBeenCalled();
    });

    it("trims whitespace before committing", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value=""
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "  hello world  ");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("hello world");
    });
  });
});
