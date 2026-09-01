import { issueCodes } from "@epanet-js/converters";
import enTranslations from "../../../public/locales/en/translation.json";

describe("issue messages", () => {
  it("has one for every code a parser can raise", () => {
    const messages: Record<string, string> = enTranslations.parserIssues;

    const missing = issueCodes.filter(
      (code) =>
        messages[code] === undefined && messages[`${code}_one`] === undefined,
    );

    expect(missing).toEqual([]);
  });
});
