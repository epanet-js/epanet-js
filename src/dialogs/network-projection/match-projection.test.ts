import { describe, it, expect } from "vitest";
import { matchesProjection } from "./match-projection";

const projection = (id: string, name: string) => ({ id, name });

describe("matchesProjection", () => {
  describe("code matching", () => {
    it("matches with colon", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "epsg:3456")).toBe(
        true,
      );
    });

    it("matches without colon", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "epsg3456")).toBe(
        true,
      );
    });

    it("matches with space instead of colon", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "epsg 3456")).toBe(
        true,
      );
    });

    it("matches partial numeric", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "3456")).toBe(true);
    });

    it("does not match wrong code", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "9999")).toBe(
        false,
      );
    });
  });

  describe("name matching", () => {
    it("matches by name case-insensitively", () => {
      expect(
        matchesProjection(projection("EPSG:1234", "Some Name"), "some name"),
      ).toBe(true);
    });

    it("does not normalize spaces in name matching", () => {
      expect(
        matchesProjection(
          projection("EPSG:1234", "Abidjan 1987"),
          "abidjan1987",
        ),
      ).toBe(false);
    });
  });
});
