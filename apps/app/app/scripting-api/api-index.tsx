import {
  callForm,
  parseSignature,
  sectionTitle,
  type Appendix,
  type InterfaceDef,
  type Member,
  type ObjectIndex,
  type ObjectIndexGroup,
  type ScriptingDocs,
} from "@epanet-js/scripting-docs";
import { inline, type Anchors } from "./prose";
import {
  Heading,
  SectionHeading,
  TypeText,
  memberAnchor,
  typeAnchor,
} from "./reference";

export const indexAnchor = (iface: InterfaceDef): string =>
  `index-${iface.path}`;

export const typesAnchor = "index-types";

const cellClassName = "px-2 py-1";

const typeOf = (member: Member): string => {
  const parsed = parseSignature(member.signature);
  return parsed.kind === "method" ? parsed.returns : parsed.type;
};

const GroupTitle = ({
  iface,
  group,
  anchors,
}: {
  iface: InterfaceDef;
  group: ObjectIndexGroup;
  anchors: Anchors;
}) => {
  if (group.from !== iface) {
    return (
      <p className="mt-4 text-size-small font-semibold text-subtle">
        From {inline(`\`${group.from.name}\``, anchors)}
      </p>
    );
  }
  if (!group.section) return null;
  return (
    <p className="mt-4 text-size-small font-semibold text-subtle">
      <a href={`#${group.section.id}`} className="hover:text-accent">
        {inline(sectionTitle(group.section), new Map())}
      </a>
    </p>
  );
};

const GroupTable = ({
  group,
  anchors,
}: {
  group: ObjectIndexGroup;
  anchors: Anchors;
}) => (
  <div className="my-2 overflow-x-auto">
    <table className="w-full border-collapse text-size-small">
      <tbody>
        {group.members.map((member) => (
          <tr key={member.name} className="border-b align-top">
            <td className={`${cellClassName} whitespace-nowrap font-mono`}>
              <a
                href={`#${memberAnchor(group.from, member)}`}
                className="text-accent underline decoration-dotted underline-offset-2"
              >
                {callForm(member.signature)}
              </a>
            </td>
            <td className={`${cellClassName} font-mono text-subtle`}>
              <TypeText text={typeOf(member)} anchors={anchors} />
            </td>
            <td className={cellClassName}>{inline(member.summary, anchors)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ApiIndex = ({
  docs,
  section,
  objects,
  anchors,
}: {
  docs: ScriptingDocs;
  section: Appendix;
  objects: ObjectIndex[];
  anchors: Anchors;
}) => {
  const types = docs.sections
    .flatMap((candidate) => candidate.types ?? [])
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section>
      <SectionHeading section={section} anchors={anchors} />
      <p className="my-2 text-size-base">
        Everything each object has, including what it inherits. Each name links
        to its full entry, where the rules and examples are.
      </p>
      {objects.map(({ iface, groups }) => (
        <div key={iface.name}>
          <Heading
            level={3}
            id={indexAnchor(iface)}
            className="mt-8 font-mono text-size-heading-3 font-semibold"
          >
            {iface.name}
          </Heading>
          <p className="my-2 text-size-base text-subtle">
            As <code className="font-mono">{iface.path}</code>.{" "}
            {inline(iface.summary, anchors)}
          </p>
          {groups.map((group, index) => (
            <div key={index}>
              <GroupTitle iface={iface} group={group} anchors={anchors} />
              <GroupTable group={group} anchors={anchors} />
            </div>
          ))}
        </div>
      ))}
      <Heading
        level={3}
        id={typesAnchor}
        className="mt-8 text-size-heading-3 font-semibold"
      >
        All types
      </Heading>
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-size-small">
          <tbody>
            {types.map((type) => (
              <tr key={type.name} className="border-b align-top">
                <td className={`${cellClassName} whitespace-nowrap font-mono`}>
                  <a
                    href={`#${typeAnchor(type)}`}
                    className="text-accent underline decoration-dotted underline-offset-2"
                  >
                    {type.name}
                  </a>
                </td>
                <td className={cellClassName}>
                  {inline(type.summary, anchors)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
