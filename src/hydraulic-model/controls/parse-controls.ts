import { AssetId } from "../asset-types";
import { AssetsMap } from "../assets-map";
import {
  SimpleControl,
  RuleBasedControl,
  AssetReference,
  Controls,
} from "./types";

export type LabelResolver = (
  assetType: "link" | "node",
  label: string,
) => AssetId | undefined;

const ASSET_KEYWORDS = ["LINK", "NODE", "TANK", "PUMP", "PIPE", "VALVE"];
const LINK_KEYWORDS = ["LINK", "PIPE", "PUMP", "VALVE"];

export const parseSimpleControlsFromText = (
  text: string,
  resolveLabel: LabelResolver,
): SimpleControl[] => {
  if (!text.trim()) return [];

  const lines = text.split("\n").filter((line) => line.trim());

  return lines.map((line) => parseSimpleControl(line, resolveLabel));
};

const parseSimpleControl = (
  line: string,
  resolveLabel: LabelResolver,
): SimpleControl => {
  const tokens = line.split(/\s+/);

  if (tokens.length < 2) {
    return { template: line, assetReferences: [] };
  }

  const linkLabel = tokens[1];
  const linkAssetId = resolveLabel("link", linkLabel);

  if (linkAssetId === undefined) {
    return { template: line, assetReferences: [] };
  }

  const assetReferences: AssetReference[] = [
    { assetId: linkAssetId, isActionTarget: true },
  ];

  tokens[1] = "{{0}}";

  const ifIndex = tokens.findIndex((t) => t.toUpperCase() === "IF");
  if (ifIndex !== -1 && ifIndex + 2 < tokens.length) {
    const nodeLabel = tokens[ifIndex + 2];
    const nodeAssetId = resolveLabel("node", nodeLabel);

    if (nodeAssetId !== undefined) {
      assetReferences.push({ assetId: nodeAssetId, isActionTarget: false });
      tokens[ifIndex + 2] = "{{1}}";
    }
  }

  return { template: tokens.join(" "), assetReferences };
};

export const parseRulesFromText = (
  text: string,
  resolveLabel: LabelResolver,
): RuleBasedControl[] => {
  if (!text.trim()) return [];

  const ruleBlocks = splitIntoRuleBlocks(text);

  return ruleBlocks.map((block) => parseRuleBasedControl(block, resolveLabel));
};

export const parseControlsFromText = (
  simpleText: string,
  rulesText: string,
  assets: AssetsMap,
): Controls => {
  const resolveLabel = createLabelResolverFromAssets(assets);
  return {
    simple: parseSimpleControlsFromText(simpleText, resolveLabel),
    rules: parseRulesFromText(rulesText, resolveLabel),
  };
};

export const createLabelResolverFromAssets = (
  assets: AssetsMap,
): LabelResolver => {
  const nodeLabels = new Map<string, AssetId>();
  const linkLabels = new Map<string, AssetId>();

  for (const [id, asset] of assets) {
    const normalizedLabel = asset.label.toUpperCase();
    if (asset.isLink) {
      linkLabels.set(normalizedLabel, id);
    } else {
      nodeLabels.set(normalizedLabel, id);
    }
  }

  return (assetType: "link" | "node", label: string): AssetId | undefined => {
    const normalizedLabel = label.toUpperCase();
    return assetType === "link"
      ? linkLabels.get(normalizedLabel)
      : nodeLabels.get(normalizedLabel);
  };
};

const splitIntoRuleBlocks = (raw: string): string[] => {
  const blocks: string[] = [];
  let currentBlock = "";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith("RULE ") && currentBlock) {
      blocks.push(currentBlock.trim());
      currentBlock = line;
    } else {
      currentBlock += (currentBlock ? "\n" : "") + line;
    }
  }

  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }

  return blocks;
};

const parseRuleHeader = (
  line: string,
): { ruleId: string; template: string } => {
  const [code, comment] = line.split(";");
  const tokens = code.split(/\s+/);

  if (tokens.length < 2 || tokens[0].toUpperCase() !== "RULE") {
    return { ruleId: "", template: line };
  }

  const ruleId = tokens[1];
  tokens[1] = "{{id}}";

  const template =
    comment !== undefined
      ? `${tokens.join(" ")} ;${comment}`
      : tokens.join(" ");

  return { ruleId, template };
};

const isActionClause = (line: string): boolean => {
  const clause = line.trim().split(/\s+/)[0]?.toUpperCase();
  return clause === "THEN" || clause === "ELSE";
};

type RuleSections = {
  headerLine: string;
  conditionLines: string[];
  actionLines: string[];
};

const splitRuleIntoSections = (lines: string[]): RuleSections => {
  const headerLine = lines[0] || "";
  const clauseLines = lines.slice(1);

  const firstActionIndex = clauseLines.findIndex(isActionClause);

  if (firstActionIndex === -1) {
    return { headerLine, conditionLines: clauseLines, actionLines: [] };
  }

  return {
    headerLine,
    conditionLines: clauseLines.slice(0, firstActionIndex),
    actionLines: clauseLines.slice(firstActionIndex),
  };
};

const parseRuleClauseLine = (
  line: string,
  resolveLabel: LabelResolver,
  assetReferences: AssetReference[],
  isActionTarget: boolean,
): string => {
  const tokens = line.split(/\s+/);

  if (tokens.length < 3) {
    return tokens.join(" ");
  }

  const keyword = tokens[1].toUpperCase();

  if (ASSET_KEYWORDS.includes(keyword)) {
    const label = tokens[2];
    const assetType = LINK_KEYWORDS.includes(keyword) ? "link" : "node";
    const assetId = resolveLabel(assetType, label);

    if (assetId !== undefined) {
      const placeholderIndex = assetReferences.length;
      assetReferences.push({ assetId, isActionTarget });
      tokens[2] = `{{${placeholderIndex}}}`;
    }
  }

  return tokens.join(" ");
};

const parseRuleBasedControl = (
  text: string,
  resolveLabel: LabelResolver,
): RuleBasedControl => {
  const assetReferences: AssetReference[] = [];
  const lines = text.split("\n");

  const { headerLine, conditionLines, actionLines } =
    splitRuleIntoSections(lines);

  const { ruleId, template: headerTemplate } = parseRuleHeader(headerLine);

  const conditionTemplates = conditionLines.map((line) =>
    parseRuleClauseLine(line, resolveLabel, assetReferences, false),
  );

  const actionTemplates = actionLines.map((line) =>
    parseRuleClauseLine(line, resolveLabel, assetReferences, true),
  );

  const template = [
    headerTemplate,
    ...conditionTemplates,
    ...actionTemplates,
  ].join("\n");

  return { ruleId, template, assetReferences };
};
