import { renderLlmsTxt, editsCandidateDocs } from "@epanet-js/scripting-docs";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(editsCandidateDocs), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
