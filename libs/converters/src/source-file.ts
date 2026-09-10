export type SourceFile = {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text?(): Promise<string>;
};

export type ParserInput = {
  files: SourceFile[];
};
