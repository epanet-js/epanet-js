export type ParsedParam = { name: string; optional: boolean; type: string };

export type ParsedSignature =
  | { kind: "method"; name: string; params: ParsedParam[]; returns: string }
  | { kind: "property"; name: string; readonly: boolean; type: string };

const splitTopLevel = (text: string, separator: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let quote: string | null = null;
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if ("([{<".includes(char)) depth++;
    if (")]}>".includes(char)) depth--;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((part) => part.trim());
};

const findMatchingParen = (text: string, open: number): number => {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const parseParam = (text: string): ParsedParam => {
  const [head, ...rest] = splitTopLevel(text, ":");
  const optional = head.endsWith("?");
  return {
    name: optional ? head.slice(0, -1).trim() : head,
    optional,
    type: rest.length > 0 ? rest.join(":").trim() : "unknown",
  };
};

export const parseSignature = (signature: string): ParsedSignature => {
  const text = signature.trim();
  const readonly = text.startsWith("readonly ");
  const body = readonly ? text.slice("readonly ".length).trim() : text;
  const paren = body.indexOf("(");
  const colon = body.indexOf(":");
  if (paren === -1 || (colon !== -1 && colon < paren)) {
    const [name, ...rest] = splitTopLevel(body, ":");
    return { kind: "property", name, readonly, type: rest.join(":").trim() };
  }
  const close = findMatchingParen(body, paren);
  if (close === -1) throw new Error(`Unbalanced signature: ${signature}`);
  const paramText = body.slice(paren + 1, close).trim();
  const after = body.slice(close + 1).trim();
  return {
    kind: "method",
    name: body.slice(0, paren).trim(),
    params:
      paramText.length === 0
        ? []
        : splitTopLevel(paramText, ",").map(parseParam),
    returns: after.startsWith(":") ? after.slice(1).trim() : "void",
  };
};

export const callForm = (signature: string): string => {
  const parsed = parseSignature(signature);
  if (parsed.kind === "property") return parsed.name;
  const params = parsed.params
    .map((param) => `${param.name}${param.optional ? "?" : ""}`)
    .join(", ");
  return `${parsed.name}(${params})`;
};
