import { renderLlmsTxt, scriptingDocs } from "@epanet-js/scripting-docs";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(scriptingDocs), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
