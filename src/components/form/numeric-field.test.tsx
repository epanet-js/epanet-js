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
});
