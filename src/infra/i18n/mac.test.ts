import { expect, test } from "vitest";
import { cmdSymbol, localizeKeybinding } from "./mac";

test("localizeKeybinding", () => {
  expect(localizeKeybinding("a", true)).toEqual("a");
  expect(localizeKeybinding("a", false)).toEqual("a");
  expect(localizeKeybinding("Command+a", true)).toEqual(`${cmdSymbol}+a`);
  expect(localizeKeybinding("Command+a", false)).toEqual("Ctrl+a");
});
