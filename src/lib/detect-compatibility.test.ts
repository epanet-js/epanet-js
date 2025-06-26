import { expect, test } from "vitest";

import { detectCompatibility } from "./detect-compatibility";

test("detectCompatibility", () => {
  expect(detectCompatibility()).toBeFalsy();
});
