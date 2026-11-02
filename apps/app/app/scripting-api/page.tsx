import type { Metadata } from "next";
import { scriptingDocs } from "@epanet-js/scripting-docs";
import { ScriptingApiPage } from "./scripting-api-page";

export const metadata: Metadata = {
  title: "Scripting API · epanet-js",
  description:
    "The epanet-js scripting API: every global, member and type a script can use, with worked examples.",
  robots: { index: false },
};

export const dynamic = "force-static";

export default function Page() {
  return (
    <ScriptingApiPage
      docs={scriptingDocs}
      llmsPath="/llms.txt"
      isCandidate={false}
    />
  );
}
