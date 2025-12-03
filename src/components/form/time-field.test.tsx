import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeField } from "./time-field";

describe("TimeField", () => {
  describe("display formatting", () => {
    it("displays empty string when value is undefined", () => {
      render(
        <TimeField label="test" value={undefined} onChangeValue={vi.fn()} />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).toHaveValue("");
    });

    it("displays HH:MM format when minutes are zero", () => {
      render(
        <TimeField label="test" value={24 * 3600} onChangeValue={vi.fn()} />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).toHaveValue("24:00");
    });

    it("displays HH:MM format when minutes are non-zero", () => {
      render(
        <TimeField
          label="test"
          value={1 * 3600 + 30 * 60}
          onChangeValue={vi.fn()}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).toHaveValue("1:30");
    });

    it("pads minutes with zero when less than 10", () => {
      render(
        <TimeField
          label="test"
          value={2 * 3600 + 5 * 60}
          onChangeValue={vi.fn()}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      expect(input).toHaveValue("2:05");
    });
  });

  describe("input parsing", () => {
    it("parses plain hours and converts to seconds", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <TimeField
          label="test"
          value={undefined}
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "24");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(24 * 3600);
    });

    it("parses HH:MM format and converts to seconds", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <TimeField
          label="test"
          value={undefined}
          onChangeValue={onChangeValue}
        />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "1:30");
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(1 * 3600 + 30 * 60);
    });

    it("calls onChangeValue with undefined when input is cleared", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <TimeField label="test" value={3600} onChangeValue={onChangeValue} />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.keyboard("{Enter}");

      expect(onChangeValue).toHaveBeenCalledWith(undefined);
    });
  });

  describe("input validation", () => {
    it("only allows digits and colon characters", async () => {
      const user = userEvent.setup();

      render(
        <TimeField label="test" value={undefined} onChangeValue={vi.fn()} />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "12abc:30xyz");

      expect(input).toHaveValue("12:30");
    });

    it("resets to original value on Escape", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <TimeField label="test" value={3600} onChangeValue={onChangeValue} />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, "99");
      await user.keyboard("{Escape}");

      expect(input).toHaveValue("1:00");
      expect(onChangeValue).not.toHaveBeenCalled();
    });

    it("resets invalid input on Enter", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <TimeField label="test" value={3600} onChangeValue={onChangeValue} />,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, ":");
      await user.keyboard("{Enter}");

      expect(input).toHaveValue("1:00");
      expect(onChangeValue).not.toHaveBeenCalled();
    });
  });

  describe("commit on blur", () => {
    it("commits valid value on blur", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <>
          <TimeField
            label="test"
            value={undefined}
            onChangeValue={onChangeValue}
          />
          <button>other</button>
        </>,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.type(input, "2");
      await user.click(screen.getByRole("button", { name: "other" }));

      expect(onChangeValue).toHaveBeenCalledWith(2 * 3600);
    });

    it("resets invalid value on blur", async () => {
      const user = userEvent.setup();
      const onChangeValue = vi.fn();

      render(
        <>
          <TimeField label="test" value={3600} onChangeValue={onChangeValue} />
          <button>other</button>
        </>,
      );

      const input = screen.getByRole("textbox", { name: /value for: test/i });
      await user.click(input);
      await user.clear(input);
      await user.type(input, ":");
      await user.click(screen.getByRole("button", { name: "other" }));

      expect(input).toHaveValue("1:00");
      expect(onChangeValue).not.toHaveBeenCalled();
    });
  });
});
