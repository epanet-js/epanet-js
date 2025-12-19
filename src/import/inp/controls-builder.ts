import { AssetId } from "src/hydraulic-model/asset-types";
import {
  Controls,
  SimpleControl,
  RuleBasedControl,
  AssetReference,
} from "src/hydraulic-model/controls";
import { ItemData } from "./inp-data";

export type RawControls = {
  simple: string;
  ruleBased: string;
};

const ASSET_KEYWORDS = ["LINK", "NODE", "TANK", "PUMP", "PIPE", "VALVE"];

export class ControlsBuilder {
  constructor(
    private rawControls: RawControls,
    private nodeIds: ItemData<AssetId>,
    private linkIds: ItemData<AssetId>,
  ) {}

  build(): Controls {
    return {
      simple: this.buildSimpleControls(),
      rules: this.buildRuleBasedControls(),
    };
  }

  private buildSimpleControls(): SimpleControl[] {
    if (!this.rawControls.simple.trim()) return [];

    const lines = this.rawControls.simple
      .split("\n")
      .filter((line) => line.trim());

    return lines.map((line) => this.parseSimpleControl(line));
  }

  private buildRuleBasedControls(): RuleBasedControl[] {
    if (!this.rawControls.ruleBased.trim()) return [];

    const ruleBlocks = this.splitIntoRuleBlocks(this.rawControls.ruleBased);

    return ruleBlocks.map((block) => this.parseRuleBasedControl(block));
  }

  private splitIntoRuleBlocks(raw: string): string[] {
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
  }

  private parseSimpleControl(line: string): SimpleControl {
    const { template, assetReferences } = this.convertToTemplate(line, false);

    this.markSimpleControlActionTargets(assetReferences);

    return {
      template,
      assetReferences,
    };
  }

  private parseRuleBasedControl(block: string): RuleBasedControl {
    const ruleId = this.extractRuleId(block);
    const blockWithIdPlaceholder = this.replaceRuleIdWithPlaceholder(block);
    const { template, assetReferences } = this.convertToTemplate(
      blockWithIdPlaceholder,
      true,
    );

    this.markRuleActionTargets(template, assetReferences);

    return {
      ruleId,
      template,
      assetReferences,
    };
  }

  private extractRuleId(block: string): string {
    const firstLine = block.split("\n")[0].trim();
    // Match rule ID, stopping at whitespace or semicolon (comment)
    const match = firstLine.match(/^RULE\s+([^\s;]+)/i);
    return match ? match[1].trim() : "";
  }

  private replaceRuleIdWithPlaceholder(block: string): string {
    // Replace the rule ID but preserve any inline comment
    return block.replace(
      /^(RULE\s+)([^\s;]+)(.*)$/im,
      (_, prefix, _id, rest) => `${prefix}{{id}}${rest}`,
    );
  }

  private convertToTemplate(
    text: string,
    _isRule: boolean,
  ): { template: string; assetReferences: AssetReference[] } {
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

    // First pass: collect asset references and their match indices in order of appearance
    const validMatchIndices: number[] = [];
    for (let i = 0; i < matches.length; i++) {
      const { keyword, label } = matches[i];
      const assetId = this.resolveAssetId(keyword, label);
      if (assetId !== undefined) {
        assetReferences.push({
          assetId,
          isActionTarget: false, // Will be set later
        });
        validMatchIndices.push(i);
      }
    }

    // Second pass: replace labels with positional placeholders (reverse order to preserve indices)
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
  }

  private resolveAssetId(keyword: string, label: string): AssetId | undefined {
    const isLinkKeyword = ["LINK", "PIPE", "PUMP", "VALVE"].includes(keyword);

    if (isLinkKeyword) {
      return this.linkIds.get(label);
    } else {
      return this.nodeIds.get(label);
    }
  }

  private markSimpleControlActionTargets(
    assetReferences: AssetReference[],
  ): void {
    if (assetReferences.length > 0) {
      assetReferences[0].isActionTarget = true;
    }
  }

  private markRuleActionTargets(
    template: string,
    assetReferences: AssetReference[],
  ): void {
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
  }
}
