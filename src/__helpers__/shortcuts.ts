import Mousetrap from "mousetrap";
import * as Hotkeys from "react-hotkeys-hook";

export const triggerShortcut = (combo: string) => {
  Mousetrap.trigger(combo);
};

vi.mock("react-hotkeys-hook", () => {
  return {
    isHotkeyPressed: vi.fn(),
    useHotkeys: vi.fn(),
    useHotkeysContext: vi.fn(),
  };
});

export const stubKeyboardState = (
  keys: { ctrl?: boolean; shift?: boolean; space?: boolean } = {},
) => {
  const mockedHotkeys = vi.mocked(Hotkeys);

  mockedHotkeys.isHotkeyPressed.mockImplementation((key: string | string[]) => {
    if (Array.isArray(key)) {
      return false;
    }

    if (key === "ctrl" || key === "meta") return keys.ctrl || false;
    if (key === "shift") return keys.shift || false;
    if (key === "space") return keys.space || false;

    return false;
  });
};
