import type { Metadata } from "next";
import { resultsCandidateDocs } from "@epanet-js/scripting-docs";
import { ScriptingApiPage } from "../scripting-api/scripting-api-page";

export const metadata: Metadata = {
  title: "Scripting API (results candidate) · epanet-js",
  description:
    "A release candidate of the epanet-js scripting API that includes simulation results.",
  robots: { index: false },
};

export const dynamic = "force-static";

export default function Page() {
  return (
    <ScriptingApiPage
      docs={resultsCandidateDocs}
      llmsPath="/llms-results-candidate.txt"
      isCandidate={true}
    />
  );
}
