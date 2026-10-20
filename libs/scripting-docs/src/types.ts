export type Markdown = string;

export type Example = { title?: string; code: string };

export type Member = {
  owner: string;
  name: string;
  signature: string;
  summary: Markdown;
  description?: Markdown;
  params?: { name: string; description: Markdown }[];
  returns?: Markdown;
  throws?: Markdown[];
  examples?: Example[];
};

export type InterfaceDef = {
  name: string;
  path: string;
  extends?: string;
  summary: Markdown;
};

export type GlobalDef = {
  name: string;
  type: string;
  summary: Markdown;
  section: string;
};

export type TypeDef = {
  name: string;
  definition: string;
  summary: Markdown;
  description?: Markdown;
};

export type Section = {
  id: string;
  number?: string;
  title: string;
  intro?: Markdown;
  types?: TypeDef[];
  members?: Member[];
  notes?: Markdown;
};

export type ExampleScript = { id: string; name: string; source: string };

export type ScriptingDocs = {
  title: string;
  summary: Markdown;
  intro: Markdown;
  globals: GlobalDef[];
  interfaces: InterfaceDef[];
  sections: Section[];
  agentRules: Markdown[];
  exampleScripts: ExampleScript[];
};
