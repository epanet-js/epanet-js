# Converters

The contract between a vendor model file and the app: what a parser is handed,
what it returns, and the vocabulary it reports problems in. **This package holds
no parsing.** Implementations live in their own packages and depend on this one.

## The interface every implementation satisfies

```ts
type Converter = {
  name: string;
  extensions: string[];
  parseNetworkData(input: ParserInput): Promise<ParserResult>;
};
```

- **A vendor ships one `Converter`, not a bare function.** What files the format
  uses and what the format is called are vendor knowledge like any other, so they
  travel with the parser instead of being restated by whichever surface offers the
  import. A consumer picks a converter and then reads `converter.extensions`,
  `converter.name` and `converter.parseNetworkData` off it without naming a vendor,
  which is what lets one command serve every format. Expect this record to grow —
  anything a consumer would otherwise hardcode per vendor belongs on it.
- **`name` is the format as a person would say it** ("Synergi"), not an id and not
  a sentence. It is a proper noun, so it is never translated; it is the one string
  in this package for that reason.

- **`ParserInput` carries files**, not a decoded database — `{ files: SourceFile[] }`.
  A browser `File` satisfies `SourceFile` structurally (`name` + `arrayBuffer()`),
  and so does anything a test or a worker hands it. It is an array because a
  source can be a folder of files as easily as a single one; when a format needs
  the user to map files to roles, that mapping becomes another field on
  `ParserInput` rather than a second parameter.
- **`ParserResult` is `{ network, issues }`.** A parser never throws for a bad
  model — an unreadable or absent file is an `error` issue with an empty network.
- **`NetworkData` is plain and cloneable.** No classes, no app ids, no labels, no
  unit conversion, no indexes. That is what lets a parse move to a worker without
  changing the contract, and what keeps every domain decision on the app side.

## Optionality is the contract

`?:` on a record field means **the source did not say**, and the consumer decides
the default. A junction with no `elevation` is a junction whose elevation the
file never stated — it is not a junction at zero.

Collapsing "absent" into a default here makes every implementation default
independently and invisibly, and the model then carries fabricated values that
nothing downstream can distinguish from real ones.

## Units are named quantities, not a system

`SourceUnits` states what the numbers are in, one quantity at a time (`flow`,
`pressure`, `elevation`), using unit strings from `@epanet-js/quantity`. Taking
them from there rather than restating them means a drifted literal is a type
error where the conversion happens.

It is deliberately not a unit-system preset: a source is free to state pressure
in `psi` while flowing `l/s`, and the set of quantities grows as more of the
model is parsed.

## Issues carry structure, not sentences

`ParserIssue` is `{ code, severity, ref?, context? }`. `code` is a short leaf id —
the UI composes the i18n key and interpolates `context`, so no English lives
here. `severity` says whether the import can proceed; that decision must not be
re-derived from the code list in the app.

Issues raised by a parser are **source-level** only: this row is malformed, this
reference does not resolve, this file cannot be read. Domain policy — a truncated
label, a declared length that disagrees with geometry — belongs to whatever
builds the model, so it is written once instead of once per implementation.
