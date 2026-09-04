# @epanet-js/gis-importers — agent guidelines

Turns GIS files into the part of a model they describe. The model vocabulary — `NetworkData`, the units, the issue codes — belongs to `@epanet-js/converters`; read [its `AGENTS.md`](../converters/AGENTS.md) first. The `Importer` shape itself lives here, because every source it describes is geographic.

## Two roles, and the line between them

**A file parser reads bytes and hands back geometry and properties.** GeoJSON, GeoJSONL, shapefile bundles; encodings, projections, malformed records. It knows what a file *contains* and nothing about what any of it *means*. It lives in `file-parsers/` and is shared by every importer.

**An importer checks and transforms that parsed data into `NetworkData`.** Which records are customer points, which attribute the user mapped to a demand, what counts as a usable record, what to report when one is not. It lives in a folder of its own, one per source.

**The test, when it is not obvious:** a file parser that needs to name a `NetworkData` type has been given work that belongs to an importer. `grep NetworkData file-parsers/` should stay empty.

## A file parser: bytes to geometry and properties

- **Stop at parsed data, never at `NetworkData`.** Records and attributes are the whole output; which of them is a customer point is not this half's question.
- **Format handling belongs here, so a new importer inherits every format at once.** Reading is shared; interpreting is not.
- **Hand back WGS84, always.** Reprojecting needs no knowledge of what a record means, so it belongs here rather than in every consumer — and it removes the asymmetry where shapefiles arrived converted (shpjs reprojects and cannot be stopped) while GeoJSON did not. Because coordinates are always WGS84 there is no CRS to report: `originalProjection` names where they came from, and absent means they were already WGS84.
- **Name what the data was authored in.** `originalProjection` carries the source's own name for it, verbatim, because once the coordinates have moved that name is the only trace of where they came from.
- **A file that states no CRS means WGS84 — but its coordinates must bear that out.** GeoJSON's default is the reason to assume rather than guess. Eastings read as degrees put the whole network in the sea, so a file that plainly is not in degrees and names nothing is refused, and the caller says what it is in through the input's `crs`.
- **An assumption that holds is still an assumption, and it is reported.** Coordinates that pass for degrees are read as WGS84 and the source imports, but `coordinateSystemMissing` comes back as a warning: nothing in the file ever confirmed it, and only the user can. Silence there would leave a network placed on a guess with no record that a guess was made — and a file that does state WGS84 says nothing, because there was nothing to assume.
- **Judge that over the file, not a record.** A projection puts everything out of range at once, so a majority decides it; a handful of stray coordinates are individual records' problems and are reported as such.
- **A supplied CRS stands in for one the file never stated, and never overrides one.** A caller that knows what its export is in says so, and the parser then treats it exactly as the file having said it, reprojection included. `{ type: "unknown" }` says nothing at all, and a shapefile ignores it outright because its `.prj` always states one.
- **Whether anyone named a CRS changes what being out of range means.** Nothing stated and nothing supplied is `coordinateSystemUnknown` — nobody ever said and the coordinates do not tell us, so a consumer can go and ask. Out of range once a CRS *has* been named is `coordinateSystemMismatch` — the answer was wrong rather than absent, and asking again with the same answer will not help. `coordinateSystemMissing` is not a failure here at all: it is the warning that we assumed, and one message per situation is why the two are separate codes.
- **A CRS with no definition and a CRS that does not fit are different failures.** No definition is `coordinateSystemUnsupported` — we cannot try. Coordinates that are still not on the globe after applying it is `coordinateSystemMismatch` — we tried and the answer says the CRS is wrong, including when a file names WGS84 and holds eastings. Either way nothing imports, rather than a network silently in the wrong place.
- **The definitions to resolve a code against come from the caller.** The parser keeps no table of its own, so which projections are supported is the consumer's to decide and to extend.
- **A scan reads every record, and must not be "optimised" into a sample.** Whether an attribute is stated on every record, and whether it is a number, are claims about all of them — one unreadable value among a thousand is exactly the case that has to make the column text.
- **Decoding the same input twice must be cheap, not correct-by-luck.** Caching is this half's own business, so a cache miss may be slow and may never change an answer.
- **A cache holds what the bytes said, never what a caller added.** Two reads with different mappings raise different issues, and the second must not inherit the first's.

## An importer: parsed data to `NetworkData`

- **State only the part of the model the source describes**, and leave out everything else. An empty array is a claim that the source had none, which an importer is rarely in a position to make.
- **One importer per folder, and folders do not reference each other.** Nothing here composes them; a consumer that wants two runs two and merges the results.
- **Never mint ids, name anything, convert units or reproject.** Those belong to whatever builds a model, so they happen once rather than once per importer.
- **An attribute's `name` is also its `ref`.** A source's attribute names are unique within it — they are column names — so unlike a vendor's custom attributes there is nothing to disambiguate, and `CustomAttributeData.ref` carries the name verbatim.
- **Report one issue per offending record**, naming the record and the attribute it was about. Consumers group them for display.
- **A record that cannot be used is a warning; a source that cannot be read is an error.** Never throw for bad input: the rest of a source still imports around an unusable record.

## The contract

A `Converter` reads a whole model file. An `Importer` reads a source that describes only *part* of one — a shapefile of zones, a file of customer points — and needs the user to say which of its attributes means what.

```ts
type GisInput = ParserInput & {
  crs?: SourceCrs;
  projections?: Map<string, Proj4Projection>;
};

type Importer<Role extends string> = {
  name: string;
  extensions: string[];
  roles: readonly Role[];
  scanSource(input: GisInput): Promise<{ summary: SourceSummary | null; issues: Issue[] }>;
  importSource(input: GisInput & { config?: ImportConfig<Role> }): Promise<ImportResult>;
};
```

**The result is `Partial<NetworkData>`, and that is the whole difference from a converter.** `emptyNetworkData()` states `junctions: []` because a converter handed a model file can truthfully say the model has none. An importer handed a polygon file knows nothing whatsoever about junctions, and stating `[]` there would be the fabricated default the vocabulary forbids everywhere else. A consumer reads `network.zones ?? []`.

That is not only a metaphor: `NetworkData` is assignable to `Partial<NetworkData>`, so a `ParserResult` *is* an `ImportResult`. Merging what two sources produced — two importers, or an importer and a converter — is a plain object spread, and nothing downstream has to know which kind produced which half.

**Scanning and importing are separate calls**, because the user chooses a mapping in between and chooses it against what the file turned out to contain. `scanSource` answers "what is in this file" — a `SourceSummary` of `attributes`, `recordCount`, `originalProjection` and, where the source has one, `geometry` — without knowing what any of it means, because nothing has told it yet. `importSource` then applies the choice, and a preview is the same call with a `recordLimit`.

The two verbs are the contract: a scan surveys, an import interprets. An implementation that finds itself needing to interpret in order to scan has put something in the wrong half.

The verb says which half you are in. `file-parsers/` parses — bytes, formats, projections. An importer imports — parsed data into `NetworkData`. A `parse` in an importer folder, or an `import` in `file-parsers/`, is a file in the wrong place.

**Both phases take `GisInput` — the files, plus the CRS to read them in when they state none and the projection definitions to resolve one against — and a scan returns a summary rather than a handle.** The two are separate because they answer separate questions: `crs` is which projection this particular file is in, `projections` is which projections we can handle at all. A consumer that supports more of them extends the map without touching a mapping, and both phases need them because a scan reprojects exactly as an import does — a summary of a file nobody could place would be a summary of nothing. The tempting alternative is for `scanSource` to hand back the decoded records for `importSource` to reuse. That puts a second shape in the contract — one per implementation — and makes every consumer hold and pass it, for a saving that belongs to the implementation anyway. Taking the same input twice keeps the contract to one shape, matches `Converter`, and means a consumer that already has the files needs nothing else to parse them.

**`ImportConfig` says what the consumer knows about a file's contents.** `units` is echoed onto `NetworkData.units` and converted by nobody here. How to read the file at all — including the CRS to assume — is `GisInput`'s, because the reader needs it before a mapping exists, and a supplied CRS applies *only* where the file states none: a guess never overrides what a file says.

Everything is stated in **records** and **attributes** rather than rows or features, because a source that is not geographic still has a record count, an attribute list and a mapping. `geometry` is optional for the same reason: a spreadsheet has none.

## This package publishes

Everything under `public/**` reaches the open-source mirror. Invent every fixture — no name, code or coordinate from a real model.
