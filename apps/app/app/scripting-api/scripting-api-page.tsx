import {
  appendixOf,
  sectionLevel,
  sectionTitle,
  type ScriptingDocs,
} from "@epanet-js/scripting-docs";
import { CodeBlock } from "./code-block";
import { Prose, inline } from "./prose";
import { SectionHeading, SectionView, anchorsOf } from "./reference";

const linkClassName =
  "text-accent underline decoration-dotted underline-offset-2";

export const ScriptingApiPage = ({
  docs,
  llmsPath,
  isCandidate,
}: {
  docs: ScriptingDocs;
  llmsPath: string;
  isCandidate: boolean;
}) => {
  const anchors = anchorsOf(docs);
  const { agentNotes, workedExamples } = appendixOf(docs);
  const contents = [...docs.sections, agentNotes, workedExamples];

  return (
    <div className="min-h-screen bg-base text-default">
      <header className="border-b bg-panel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <a href="/" className="text-size-base font-semibold text-default">
            epanet-js
          </a>
          <span className="text-size-base text-subtle">Scripting API</span>
          <span className="rounded bg-warning-subtle px-2 py-0.5 text-size-small text-warning">
            Experimental — names may change
          </span>
          {isCandidate && (
            <span className="rounded bg-warning-subtle px-2 py-0.5 text-size-small text-warning">
              Release candidate — includes unreleased API
            </span>
          )}
          <a
            href={llmsPath}
            className={`ml-auto text-size-small ${linkClassName}`}
          >
            {llmsPath.slice(1)}
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 sm:px-6">
        <nav
          aria-label="Contents"
          className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto py-8 pr-4 text-size-small lg:block"
        >
          <div className="mb-3 font-semibold uppercase tracking-wide text-subtle">
            Globals
          </div>
          <ul className="space-y-1">
            {docs.globals.map((global) => (
              <li key={global.name}>
                <a
                  href={`#${global.section}`}
                  className="font-mono text-default hover:text-accent"
                >
                  {global.name}
                </a>
                <span className="text-subtle">
                  {" "}
                  — {inline(global.summary, new Map())}
                </span>
              </li>
            ))}
          </ul>
          <div className="mb-3 mt-6 font-semibold uppercase tracking-wide text-subtle">
            Contents
          </div>
          <ul className="space-y-1">
            {contents.map((section) => (
              <li
                key={section.id}
                style={{
                  paddingLeft: `${(sectionLevel(section) - 1) * 0.75}rem`,
                }}
              >
                <a
                  href={`#${section.id}`}
                  className="text-default hover:text-accent"
                >
                  {inline(sectionTitle(section), new Map())}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 py-8">
          <h1 className="text-size-heading-1 font-semibold">{docs.title}</h1>
          <p className="mt-2 text-size-base text-subtle">
            {inline(docs.summary, anchors)}
          </p>
          <p className="mt-2 text-size-base text-subtle">
            To have an LLM write a script, give it{" "}
            <a href={llmsPath} className={linkClassName}>
              {llmsPath}
            </a>
            : this reference as one plain-text file.
          </p>
          <Prose markdown={docs.intro} anchors={anchors} />

          {docs.sections.map((section) => (
            <SectionView
              key={section.id}
              docs={docs}
              section={section}
              anchors={anchors}
            />
          ))}

          <section>
            <SectionHeading section={agentNotes} anchors={anchors} />
            <ul className="my-3 list-disc space-y-2 pl-6 text-size-base">
              {docs.agentRules.map((rule, index) => (
                <li key={index}>{inline(rule, anchors)}</li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHeading section={workedExamples} anchors={anchors} />
            <p className="my-2 text-size-base">
              The built-in examples from the Scripts panel.
            </p>
            {docs.exampleScripts.map((example) => (
              <details
                key={example.id}
                id={`example-${example.id}`}
                className="my-3 scroll-mt-6 rounded border"
              >
                <summary className="cursor-pointer px-3 py-2 text-size-base font-semibold hover:bg-base-hover">
                  {example.name}
                </summary>
                <div className="px-3 pb-3">
                  <CodeBlock code={example.source.trimEnd()} />
                </div>
              </details>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
};
