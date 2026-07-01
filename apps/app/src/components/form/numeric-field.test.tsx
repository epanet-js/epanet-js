import { render, screen, waitFor } from "@testing-library/react";
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
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "42");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(42, false);
    });

    it("sets input to empty string when display value is empty", () => {
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue=""
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).toHaveValue("");
    });
  });

  describe("non-numeric input rejection", () => {
    it("ignores non-numeric characters typed into a field with a value", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="42" />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abc");

      expect(input).toHaveValue("42");
    });

    it("does not clear the field when selecting all and typing a letter", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="42" />);

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

      render(<NumericField label="test" displayValue="5" />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);

      expect(input).toHaveValue("");
    });

    it("allows typing valid numbers after rejecting invalid input", async () => {
      const user = userEvent.setup();

      render(<NumericField label="test" displayValue="10" />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "abc");
      expect(input).toHaveValue("10");

      await user.clear(input);
      await user.type(input, "99");
      expect(input).toHaveValue("99");
    });
  });

  describe("commitInvalidValues (informational mode)", () => {
    const nonNegative = (n: number) => n >= 0;

    it("blocks the invalid commit when commitInvalidValues is off", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue="5"
          onChangeValue={onChangeValue}
          validate={nonNegative}
          commitInvalidValues={false}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      // `validate` supersedes the legacy positiveOnly block: the negative is
      // typeable but fails validation, so the commit is blocked and reverts.
      await user.type(input, "-3");
      expect(input).toHaveValue("-3");
      await user.keyboard("{Enter}");
      expect(onChangeValue).not.toHaveBeenCalled();
      expect(input).toHaveValue("5");
    });

    it("allows negative input and commits it (warning) when on", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue="5"
          onChangeValue={onChangeValue}
          validate={nonNegative}
          commitInvalidValues={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "-3");
      expect(input).toHaveValue("-3");
      await user.keyboard("{Enter}");
      expect(onChangeValue).toHaveBeenCalledWith(-3, false);
    });
  });

  describe("validation on load", () => {
    const nonNegative = (n: number) => n >= 0;

    it("shows the warning style when the initial value fails validation", async () => {
      render(
        <NumericField
          label="test"
          displayValue="-3"
          validate={nonNegative}
          commitInvalidValues={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await waitFor(() => {
        expect(input.className).toContain("border-orange-500");
      });
    });

    it("shows the warning style when a required field loads empty", async () => {
      render(<NumericField label="test" displayValue="" isRequired={true} />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await waitFor(() => {
        expect(input.className).toContain("border-orange-500");
      });
    });

    it("does not show the warning style when the initial value is valid", async () => {
      render(
        <NumericField
          label="test"
          displayValue="5"
          validate={nonNegative}
          isRequired={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await waitFor(() => {
        expect(input).toHaveValue("5");
      });
      expect(input.className).not.toContain("border-orange-500");
    });
  });

  describe("isRequired (required vs optional empty)", () => {
    it("warns on empty for a required field that still allows committing", async () => {
      render(
        <NumericField
          label="test"
          displayValue=""
          isRequired={true}
          commitInvalidValues={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await waitFor(() => {
        expect(input.className).toContain("border-orange-500");
      });
    });

    it("does not block the empty commit for a required-nullable field", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <NumericField
          label="test"
          displayValue="5"
          onChangeValue={onChangeValue}
          isRequired={true}
          commitInvalidValues={true}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.keyboard("{Enter}");

      // Missing-but-required still commits (as empty/null) — enforcement is
      // deferred to the pre-simulation check; it only warns in the input.
      expect(onChangeValue).toHaveBeenCalledWith(expect.anything(), true);
    });

    it("does not warn on empty for an optional field", async () => {
      render(<NumericField label="test" displayValue="" isRequired={false} />);

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await waitFor(() => {
        expect(input).toHaveValue("");
      });
      expect(input.className).not.toContain("border-orange-500");
    });
  });
});
