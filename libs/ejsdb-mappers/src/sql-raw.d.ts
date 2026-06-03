// `@epanet-js/ejsdb`'s migrations import `*.sql?raw`. Because ambient module
// declarations don't cross package boundaries under plain `tsc`, mirror ejsdb's
// declaration here so type-checking this package resolves those imports.
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
