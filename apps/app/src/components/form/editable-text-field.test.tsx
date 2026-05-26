import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableTextField } from "./editable-text-field";

describe("EditableTextField", () => {
  describe("allowedChars", () => {
    it("filters out characters not matching the pattern", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
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
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
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

    it("excludes specific special characters", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      // Pattern that excludes +, -, *, /, ^, ;, ", ', \, and whitespace
      render(
        <EditableTextField
          label="test"
          value=""
          onChangeValue={onChangeValue}
          allowedChars={/[a-zA-Z0-9_]/}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abc+def-ghi");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("abcdefghi");
    });
  });

  describe("maxByteLength", () => {
    it("limits ASCII input to maxByteLength bytes", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
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
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
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

    it("handles mixed ASCII and multi-byte characters", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value=""
          onChangeValue={onChangeValue}
          maxByteLength={5}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      // 'a' = 1 byte, 'é' = 2 bytes, 'b' = 1 byte, 'ñ' = 2 bytes
      // Total would be 6 bytes, should truncate to 5 bytes = "aéb"
      await user.type(input, "aébñ");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith("aéb");
    });
  });

  describe("combined allowedChars and maxByteLength", () => {
    it("applies both filters correctly", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <EditableTextField
          label="test"
          value=""
          onChangeValue={onChangeValue}
          allowedChars={/[a-zA-Z]/}
          maxByteLength={3}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "a1b2c3d4");
      await user.keyboard("{Enter}");

      // First filters to "abcd", then truncates to 3 bytes = "abc"
      expect(onChangeValue).toHaveBeenCalledWith("abc");
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
