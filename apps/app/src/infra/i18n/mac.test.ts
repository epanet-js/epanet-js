import { expect, test } from "vitest";
import { cmdSymbol, localizeKeybinding } from "./mac";

test("localizeKeybinding", () => {
  expect(localizeKeybinding("a", true)).toEqual("A");
  expect(localizeKeybinding("a", false)).toEqual("A");
  expect(localizeKeybinding("Command+a", true)).toEqual(`${cmdSymbol}A`);
  expect(localizeKeybinding("Command+a", false)).toEqual("Ctrl+A");
  expect(localizeKeybinding("ctrl", true)).toEqual("⌘");
  expect(localizeKeybinding("ctrl", false)).toEqual("Ctrl");
  expect(localizeKeybinding("ctrl+shift+s", true)).toEqual("⇧⌘S");
  expect(localizeKeybinding("ctrl+shift+s", false)).toEqual("Ctrl+Shift+S");
  expect(localizeKeybinding("shift+s", false)).toEqual("Shift+S");
  expect(localizeKeybinding("shift+s", true)).toEqual("⇧S");
});
