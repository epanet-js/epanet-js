import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableTextFieldWithConfirmation } from "./editable-text-field-with-confirmation";

const setupUser = () => userEvent.setup();

describe("EditableTextFieldWithConfirmation", () => {
  describe("allowedChars", () => {
    it("filters out characters not matching the pattern", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          onChangeValue={onChangeValue}
          allowedChars={/[a-zA-Z0-9]/}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abc123!@#");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("abc123");
    });

    it("allows Latin-1 extended characters when pattern includes them", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          onChangeValue={onChangeValue}
          allowedChars={/[a-zA-Z0-9\xA0-\xFF]/}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "caféñ");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("caféñ");
    });
  });

  describe("maxByteLength", () => {
    it("limits ASCII input to maxByteLength bytes", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          onChangeValue={onChangeValue}
          maxByteLength={5}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abcdefgh");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("abcde");
    });

    it("limits multi-byte characters by byte length, not character count", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          onChangeValue={onChangeValue}
          maxByteLength={4}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      // 'é' is 2 bytes in UTF-8, so 4 bytes max = 2 'é' characters
      await user.type(input, "éééé");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("éé");
    });
  });

  describe("commit behavior", () => {
    it("commits on Enter", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
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
      const user = setupUser();
      const onChangeValue = vi.fn();
      const onReset = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value="original"
          onChangeValue={onChangeValue}
          onReset={onReset}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "new value");
      await user.keyboard("{Escape}");

      expect(onChangeValue).not.toHaveBeenCalled();
      expect(onReset).toHaveBeenCalled();
      expect(input).toHaveValue("original");
    });

    it("does not commit if value is unchanged", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
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
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
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

  describe("validation error handling", () => {
    it("does not blur when validation returns error", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn().mockReturnValue(true); // returns error

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "invalid");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("invalid");
      expect(input).toHaveFocus();
    });

    it("allows re-trying after editing to fix validation error", async () => {
      const user = setupUser();
      const onChangeValue = vi
        .fn()
        .mockReturnValueOnce(true) // first call returns error
        .mockReturnValueOnce(false); // second call succeeds

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          onChangeValue={onChangeValue}
          hasError={false}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "invalid");
      await user.keyboard("{Enter}");

      // First attempt fails
      expect(onChangeValue).toHaveBeenCalledWith("invalid");
      expect(input).toHaveFocus();

      // Edit and retry
      await user.type(input, "2");
      await user.keyboard("{Enter}");

      // Second attempt succeeds
      expect(onChangeValue).toHaveBeenCalledWith("invalid2");
    });
  });

  describe("blur behavior", () => {
    it("commits on blur if dirty", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value="original"
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "new value");

      // Click outside to blur
      await user.click(document.body);

      await waitFor(() => {
        expect(onChangeValue).toHaveBeenCalledWith("new value");
      });
    });

    it("resets on blur if not dirty", async () => {
      const user = setupUser();
      const onChangeValue = vi.fn();
      const onReset = vi.fn();

      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value="original"
          onChangeValue={onChangeValue}
          onReset={onReset}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);

      // Click outside to blur without typing
      await user.click(document.body);

      await waitFor(() => {
        expect(onReset).toHaveBeenCalled();
      });
      expect(onChangeValue).not.toHaveBeenCalled();
    });
  });

  describe("autoFocus", () => {
    it("focuses input on mount when autoFocus is true", async () => {
      render(
        <EditableTextFieldWithConfirmation label="test" value="" autoFocus />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it("does not focus input on mount when autoFocus is false", () => {
      render(
        <EditableTextFieldWithConfirmation
          label="test"
          value=""
          autoFocus={false}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).not.toHaveFocus();
    });
  });
});
