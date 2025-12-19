import { AssetId } from "../asset-types";
import { AssetsMap } from "../assets-map";
import {
  SimpleControl,
  RuleBasedControl,
  AssetReference,
  Controls,
} from "./types";

export type LabelResolver = (
  keyword: string,
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

  return (keyword: string, label: string): AssetId | undefined => {
    const isLinkKeyword = LINK_KEYWORDS.includes(keyword);
    const normalizedLabel = label.toUpperCase();
    return isLinkKeyword
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

const parseSimpleControl = (
  line: string,
  resolveLabel: LabelResolver,
): SimpleControl => {
  const { template, assetReferences } = convertToTemplate(line, resolveLabel);

  markSimpleControlActionTargets(assetReferences);

  return {
    template,
    assetReferences,
  };
};

const parseRuleBasedControl = (
  block: string,
  resolveLabel: LabelResolver,
): RuleBasedControl => {
  const ruleId = extractRuleId(block);
  const blockWithIdPlaceholder = replaceRuleIdWithPlaceholder(block);
  const { template, assetReferences } = convertToTemplate(
    blockWithIdPlaceholder,
    resolveLabel,
  );

  markRuleActionTargets(template, assetReferences);

  return {
    ruleId,
    template,
    assetReferences,
  };
};

const extractRuleId = (block: string): string => {
  const firstLine = block.split("\n")[0].trim();
  // Match rule ID, stopping at whitespace or semicolon (comment)
  const match = firstLine.match(/^RULE\s+([^\s;]+)/i);
  return match ? match[1].trim() : "";
};

const replaceRuleIdWithPlaceholder = (block: string): string => {
  // Replace the rule ID but preserve any inline comment
  return block.replace(
    /^(RULE\s+)([^\s;]+)(.*)$/im,
    (_, prefix, _id, rest) => `${prefix}{{id}}${rest}`,
  );
};

const convertToTemplate = (
  text: string,
  resolveLabel: LabelResolver,
): { template: string; assetReferences: AssetReference[] } => {
  let template = text;
  const assetReferences: AssetReference[] = [];

  const keywordPattern = ASSET_KEYWORDS.join("|");
  const regex = new RegExp(
    `\\b(${keywordPattern})\\s+([A-Za-z0-9_\\-.]+)`,
    "gi",
  );

  const matches: Array<{
    fullMatch: string;
    keyword: string;
    label: string;
    index: number;
  }> = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      keyword: match[1].toUpperCase(),
      label: match[2],
      index: match.index,
    });
  }

  const validMatchIndices: number[] = [];
  for (let i = 0; i < matches.length; i++) {
    const { keyword, label } = matches[i];
    const assetId = resolveLabel(keyword, label);
    if (assetId !== undefined) {
      assetReferences.push({
        assetId,
        isActionTarget: false,
      });
      validMatchIndices.push(i);
    }
  }

  for (let refIdx = validMatchIndices.length - 1; refIdx >= 0; refIdx--) {
    const matchIdx = validMatchIndices[refIdx];
    const { fullMatch, keyword, index } = matches[matchIdx];

    const placeholder = `{{${refIdx}}}`;
    const newText = `${keyword} ${placeholder}`;

    template =
      template.substring(0, index) +
      newText +
      template.substring(index + fullMatch.length);
  }

  return { template, assetReferences };
};

const markSimpleControlActionTargets = (
  assetReferences: AssetReference[],
): void => {
  if (assetReferences.length > 0) {
    assetReferences[0].isActionTarget = true;
  }
};

const markRuleActionTargets = (
  template: string,
  assetReferences: AssetReference[],
): void => {
  const upperTemplate = template.toUpperCase();
  const thenPos = upperTemplate.indexOf("THEN");

  if (thenPos === -1) return;

  const placeholderRegex = /\{\{(\d+)\}\}/g;
  let match;

  while ((match = placeholderRegex.exec(template)) !== null) {
    const refIndex = parseInt(match[1], 10);
    if (match.index > thenPos && refIndex < assetReferences.length) {
      const textBeforeMatch = upperTemplate.substring(thenPos, match.index);
      const lastClauseMatch = textBeforeMatch.match(/\b(THEN|ELSE|AND)\b/g);

      if (lastClauseMatch) {
        const lastClause = lastClauseMatch[lastClauseMatch.length - 1];
        if (
          lastClause === "THEN" ||
          lastClause === "ELSE" ||
          lastClause === "AND"
        ) {
          assetReferences[refIndex].isActionTarget = true;
        }
      }
    }
  }
};
