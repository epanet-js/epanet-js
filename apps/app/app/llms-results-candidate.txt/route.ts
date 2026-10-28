import { renderLlmsTxt, resultsCandidateDocs } from "@epanet-js/scripting-docs";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(resultsCandidateDocs), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
