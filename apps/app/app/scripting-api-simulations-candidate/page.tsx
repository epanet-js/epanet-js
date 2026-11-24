import type { Metadata } from "next";
import { simulationsCandidateDocs } from "@epanet-js/scripting-docs";
import { ScriptingApiPage } from "../scripting-api/scripting-api-page";

export const metadata: Metadata = {
  title: "Scripting API (simulations candidate) · epanet-js",
  description:
    "A release candidate of the epanet-js scripting API that lets scripts run simulations.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function Page() {
  return (
    <ScriptingApiPage
      docs={simulationsCandidateDocs}
      llmsPath="/llms-simulations-candidate.txt"
      isCandidate={true}
    />
  );
}
