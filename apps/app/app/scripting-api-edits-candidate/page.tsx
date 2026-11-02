import type { Metadata } from "next";
import { editsCandidateDocs } from "@epanet-js/scripting-docs";
import { ScriptingApiPage } from "../scripting-api/scripting-api-page";

export const metadata: Metadata = {
  title: "Scripting API (edits candidate) · epanet-js",
  description:
    "A release candidate of the epanet-js scripting API that lets scripts edit the network.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function Page() {
  return (
    <ScriptingApiPage
      docs={editsCandidateDocs}
      llmsPath="/llms-edits-candidate.txt"
      isCandidate={true}
    />
  );
}
