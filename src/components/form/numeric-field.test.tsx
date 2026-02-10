import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumericField } from "./numeric-field";

describe("NumericField", () => {
  describe("isEmpty parameter", () => {
    it("calls onChangeValue with isEmpty=true when user clears input", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue="42"
          onChangeValue={onChangeValue}
          isNullable={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(0, true);
    });

    it("calls onChangeValue with isEmpty=false when user enters 0", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue=""
          onChangeValue={onChangeValue}
          isNullable={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "0");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(0, false);
    });

    it("calls onChangeValue with isEmpty=false when user enters a non-zero number", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue=""
          onChangeValue={onChangeValue}
          isNullable={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "42");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(42, false);
    });

    it("sets input to empty string when isNullable=true and display value is empty", () => {
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue=""
          onChangeValue={onChangeValue}
          isNullable={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).toHaveValue("");
    });
  });

  describe("non-numeric input rejection", () => {
    it("ignores non-numeric characters typed into a field with a value", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="42" isNullable={true} />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abc");

      expect(input).toHaveValue("42");
    });

    it("does not clear the field when selecting all and typing a letter", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="42" isNullable={true} />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "123");
      // Select all and type a non-numeric character
      await user.tripleClick(input);
      await user.type(input, "x");

      expect(input).toHaveValue("123");
    });

    it("still allows clearing the field with backspace", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="5" isNullable={true} />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);

      expect(input).toHaveValue("");
    });

    it("allows typing valid numbers after rejecting invalid input", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="10" isNullable={true} />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abc");
      expect(input).toHaveValue("10");

      await user.clear(input);
      await user.type(input, "99");
      expect(input).toHaveValue("99");
    });
  });
});
