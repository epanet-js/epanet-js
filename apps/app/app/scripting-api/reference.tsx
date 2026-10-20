import {
  callForm,
  ownersOf,
  parseSignature,
  sectionLevel,
  sectionTitle,
  splitMembers,
  type InterfaceDef,
  type Member,
  type ScriptingDocs,
  type Section,
  type TypeDef,
} from "@epanet-js/scripting-docs";
import type { ReactNode } from "react";
import { CodeBlock } from "./code-block";
import { Prose, inline, type Anchors } from "./prose";

export const memberAnchor = (iface: InterfaceDef, member: Member): string =>
  `${iface.path}.${member.name}`;

export const typeAnchor = (type: TypeDef): string => `type-${type.name}`;

const interfaceAnchor = (section: Section, iface: InterfaceDef): string =>
  `${section.id}-${iface.path}`;

const TYPE_NAME = /([A-Z][A-Za-z]*(?:\.[A-Z][A-Za-z]*)?)/;

const TypeText = ({ text, anchors }: { text: string; anchors: Anchors }) => (
  <>
    {text.split(TYPE_NAME).map((part, index) => {
      const anchor = index % 2 === 1 ? anchors.get(part) : undefined;
      return anchor ? (
        <a
          key={index}
          href={`#${anchor}`}
          className="text-accent underline decoration-dotted underline-offset-2"
        >
          {part}
        </a>
      ) : (
        part
      );
    })}
  </>
);

export const anchorsOf = (docs: ScriptingDocs): Anchors => {
  const anchors = new Map<string, string>();
  for (const global of docs.globals) anchors.set(global.type, global.section);
  for (const section of docs.sections) {
    const owners = ownersOf(docs, section);
    for (const { iface, members } of owners) {
      if (owners.length > 1 && !anchors.has(iface.name)) {
        anchors.set(iface.name, interfaceAnchor(section, iface));
      }
      for (const member of members) {
        const anchor = memberAnchor(iface, member);
        anchors.set(anchor, anchor);
      }
    }
    for (const type of section.types ?? []) {
      anchors.set(type.name, typeAnchor(type));
    }
  }
  return anchors;
};

const Heading = ({
  level,
  id,
  className,
  children,
}: {
  level: number;
  id?: string;
  className: string;
  children: ReactNode;
}) => {
  const content = id ? (
    <a href={`#${id}`} className="text-default no-underline hover:text-accent">
      {children}
    </a>
  ) : (
    children
  );
  const props = { id, className: `scroll-mt-6 ${className}` };
  switch (Math.min(6, level)) {
    case 2:
      return <h2 {...props}>{content}</h2>;
    case 3:
      return <h3 {...props}>{content}</h3>;
    case 4:
      return <h4 {...props}>{content}</h4>;
    case 5:
      return <h5 {...props}>{content}</h5>;
    default:
      return <h6 {...props}>{content}</h6>;
  }
};

const SECTION_HEADING: Record<number, string> = {
  1: "mt-14 border-t pt-8 text-size-heading-1 font-semibold",
  2: "mt-10 text-size-heading-2 font-semibold",
};

export const SectionHeading = ({
  section,
  anchors,
}: {
  section: { id: string; number?: string; title: string };
  anchors: Anchors;
}) => {
  const level = sectionLevel(section);
  return (
    <Heading
      level={level + 1}
      id={section.id}
      className={SECTION_HEADING[level] ?? SECTION_HEADING[2]}
    >
      {inline(sectionTitle(section), anchors)}
    </Heading>
  );
};

const Label = ({ children }: { children: ReactNode }) => (
  <div className="mt-3 text-size-small font-semibold uppercase tracking-wide text-subtle">
    {children}
  </div>
);

const PropertyTable = ({
  iface,
  members,
  anchors,
}: {
  iface: InterfaceDef;
  members: Member[];
  anchors: Anchors;
}) => (
  <div className="my-4 overflow-x-auto">
    <table className="w-full border-collapse text-size-small">
      <thead>
        <tr>
          {["Property", "Type", "Description"].map((column) => (
            <th
              key={column}
              className="border-b border-strong px-2 py-1 text-left font-semibold"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {members.map((member) => {
          const parsed = parseSignature(member.signature);
          const anchor = memberAnchor(iface, member);
          return (
            <tr
              key={member.name}
              id={anchor}
              className="scroll-mt-6 border-b align-top"
            >
              <td className="whitespace-nowrap px-2 py-1 font-mono">
                <a
                  href={`#${anchor}`}
                  className="text-default no-underline hover:text-accent"
                >
                  {anchor}
                </a>
              </td>
              <td className="px-2 py-1 font-mono text-subtle">
                {parsed.kind === "property" ? (
                  <TypeText text={parsed.type} anchors={anchors} />
                ) : null}
              </td>
              <td className="px-2 py-1">
                {inline(member.summary, anchors)}
                {member.description ? (
                  <Prose markdown={member.description} anchors={anchors} />
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const Method = ({
  iface,
  member,
  level,
  anchors,
}: {
  iface: InterfaceDef;
  member: Member;
  level: number;
  anchors: Anchors;
}) => {
  const anchor = memberAnchor(iface, member);
  return (
    <article className="my-6 border-t pt-4">
      <Heading
        level={level}
        id={anchor}
        className="font-mono text-size-base font-semibold"
      >
        {`${iface.path}.${callForm(member.signature)}`}
      </Heading>
      <p className="my-2 text-size-base">{inline(member.summary, anchors)}</p>
      <CodeBlock code={member.signature} language="ts" />
      {member.description ? (
        <Prose markdown={member.description} anchors={anchors} />
      ) : null}
      {member.params?.length ? (
        <>
          <Label>Parameters</Label>
          <ul className="my-1 list-disc space-y-1 pl-6 text-size-base">
            {member.params.map((param) => (
              <li key={param.name}>
                <code className="font-mono text-size-small">{param.name}</code>{" "}
                — {inline(param.description, anchors)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {member.returns ? (
        <>
          <Label>Returns</Label>
          <p className="my-1 text-size-base">
            {inline(member.returns, anchors)}
          </p>
        </>
      ) : null}
      {member.throws?.length ? (
        <>
          <Label>Throws</Label>
          <ul className="my-1 list-disc space-y-1 pl-6 text-size-base">
            {member.throws.map((text, index) => (
              <li key={index}>{inline(text, anchors)}</li>
            ))}
          </ul>
        </>
      ) : null}
      {(member.examples ?? []).map((example, index) => (
        <div key={index} className="my-3">
          {example.title ? (
            <div className="text-size-small italic text-subtle">
              {example.title}
            </div>
          ) : null}
          <CodeBlock code={example.code} />
        </div>
      ))}
    </article>
  );
};

const TypeCard = ({ type, anchors }: { type: TypeDef; anchors: Anchors }) => (
  <article id={typeAnchor(type)} className="my-4 scroll-mt-6">
    <div className="font-mono text-size-base font-semibold">
      <a
        href={`#${typeAnchor(type)}`}
        className="text-default no-underline hover:text-accent"
      >
        {type.name}
      </a>
    </div>
    <p className="my-2 text-size-base">{inline(type.summary, anchors)}</p>
    <CodeBlock code={type.definition} language="ts" />
    {type.description ? (
      <Prose markdown={type.description} anchors={anchors} />
    ) : null}
  </article>
);

const Members = ({
  iface,
  members,
  level,
  anchors,
}: {
  iface: InterfaceDef;
  members: Member[];
  level: number;
  anchors: Anchors;
}) => {
  const { properties, methods } = splitMembers(members);
  return (
    <>
      {properties.length > 0 ? (
        <PropertyTable iface={iface} members={properties} anchors={anchors} />
      ) : null}
      {methods.map((member) => (
        <Method
          key={member.name}
          iface={iface}
          member={member}
          level={level}
          anchors={anchors}
        />
      ))}
    </>
  );
};

export const SectionView = ({
  docs,
  section,
  anchors,
}: {
  docs: ScriptingDocs;
  section: Section;
  anchors: Anchors;
}) => {
  const level = sectionLevel(section) + 2;
  const owners = ownersOf(docs, section);
  const grouped = owners.length > 1;
  return (
    <section>
      <SectionHeading section={section} anchors={anchors} />
      {section.intro ? (
        <Prose markdown={section.intro} anchors={anchors} />
      ) : null}
      {owners.map(({ iface, members }) =>
        grouped ? (
          <div key={iface.name}>
            <Heading
              level={level}
              id={interfaceAnchor(section, iface)}
              className="mt-8 font-mono text-size-heading-3 font-semibold"
            >
              {iface.name}
            </Heading>
            <p className="my-2 text-size-base text-subtle">
              As <code className="font-mono">{iface.path}</code>.{" "}
              {inline(iface.summary, anchors)}
              {iface.extends ? (
                <>
                  {" "}
                  Has every {inline(`\`${iface.extends}\``, anchors)} member.
                </>
              ) : null}
            </p>
            <Members
              iface={iface}
              members={members}
              level={level + 1}
              anchors={anchors}
            />
          </div>
        ) : (
          <Members
            key={iface.name}
            iface={iface}
            members={members}
            level={level}
            anchors={anchors}
          />
        ),
      )}
      {section.types?.length ? (
        <div className="my-6">
          <Label>Types</Label>
          {section.types.map((type) => (
            <TypeCard key={type.name} type={type} anchors={anchors} />
          ))}
        </div>
      ) : null}
      {section.notes ? (
        <Prose markdown={section.notes} anchors={anchors} />
      ) : null}
    </section>
  );
};
