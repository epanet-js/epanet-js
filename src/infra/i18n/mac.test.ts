import { expect, test } from "vitest";
import { cmdSymbol, localizeKeybinding } from "./mac";

test("localizeKeybinding", () => {
  expect(localizeKeybinding("a", true)).toEqual("A");
  expect(localizeKeybinding("a", false)).toEqual("A");
  expect(localizeKeybinding("Command+a", true)).toEqual(`${cmdSymbol}A`);
  expect(localizeKeybinding("Command+a", false)).toEqual("Ctrl+A");
});
