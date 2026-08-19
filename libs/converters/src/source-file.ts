export type SourceFile = {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ParserInput = {
  files: SourceFile[];
};
