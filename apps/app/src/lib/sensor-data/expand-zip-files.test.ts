import { strToU8, zipSync } from "fflate";
import { expandZipFiles } from "./expand-zip-files";

const aZip = (name: string, entries: Record<string, Uint8Array>) =>
  new File([zipSync(entries)], name);

const namesOf = async (files: File[]) => {
  const { files: expanded, skipped } = await expandZipFiles(files);
  return {
    files: expanded.map(({ name }) => name),
    skipped: skipped.map(({ name, reason }) => [name, reason]),
  };
};

describe("expandZipFiles", () => {
  it("lists the files inside a zip, next to the files dropped as they are", async () => {
    const result = await namesOf([
      new File(["a"], "day-1.csv"),
      aZip("week.zip", {
        "day-2.csv": strToU8("b"),
        "data/day-3.xlsx": strToU8("c"),
      }),
    ]);

    expect(result).toEqual({
      files: ["day-1.csv", "day-2.csv", "data/day-3.xlsx"],
      skipped: [],
    });
  });

  it("skips folders, hidden files and the macOS metadata in a zip", async () => {
    const result = await namesOf([
      aZip("week.zip", {
        "day-1.csv": strToU8("a"),
        ".DS_Store": strToU8("x"),
        "__MACOSX/._day-1.csv": strToU8("x"),
        "data/": new Uint8Array(),
      }),
    ]);

    expect(result.files).toEqual(["day-1.csv"]);
  });

  it("opens a zip inside a zip", async () => {
    const inner = zipSync({ "day-1.csv": strToU8("a") });
    const result = await namesOf([aZip("month.zip", { "week.zip": inner })]);

    expect(result.files).toEqual(["week.zip/day-1.csv"]);
  });

  it("reports a zip it cannot open", async () => {
    const result = await namesOf([new File(["not a zip"], "broken.zip")]);

    expect(result).toEqual({
      files: [],
      skipped: [["broken.zip", "unreadable"]],
    });
  });

  it("reports a zip inside a zip that it cannot open", async () => {
    const result = await namesOf([
      aZip("month.zip", {
        "day-1.csv": strToU8("a"),
        "week.zip": strToU8("not a zip"),
      }),
    ]);

    expect(result).toEqual({
      files: ["day-1.csv"],
      skipped: [["week.zip", "unreadable"]],
    });
  });

  it("reports a zip nested too deep to open", async () => {
    const day = zipSync({ "day-1.csv": strToU8("a") });
    const week = zipSync({ "day.zip": day });
    const result = await namesOf([aZip("month.zip", { "week.zip": week })]);

    expect(result).toEqual({
      files: [],
      skipped: [["week.zip/day.zip", "tooDeep"]],
    });
  });

  it("keeps the folders in the names, so files with the same name stay apart", async () => {
    const result = await namesOf([
      aZip("week.zip", {
        "north/day-1.csv": strToU8("a"),
        "south/day-1.csv": strToU8("b"),
      }),
    ]);

    expect(result.files).toEqual(["north/day-1.csv", "south/day-1.csv"]);
  });

  it("ignores hidden files dropped next to the others", async () => {
    const result = await namesOf([
      new File(["x"], ".DS_Store"),
      new File(["a"], "day-1.csv"),
    ]);

    expect(result).toEqual({ files: ["day-1.csv"], skipped: [] });
  });
});
