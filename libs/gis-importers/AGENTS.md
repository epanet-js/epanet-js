# @epanet-js/gis-importers — agent guidelines

Turns GIS files into the part of a model they describe. The model vocabulary — `NetworkData`, the units, the issue codes — belongs to `@epanet-js/converters`; read [its `AGENTS.md`](../converters/AGENTS.md) first. The `Importer` shape itself lives here, because every source it describes is geographic.

## Two roles, and the line between them

**A file parser reads bytes and hands back geometry and properties.** GeoJSON, GeoJSONL, shapefile bundles; encodings, projections, malformed records. It knows what a file *contains* and nothing about what any of it *means*. It lives in `file-parsers/` and is shared by every importer.

**An importer checks and transforms that parsed data into `NetworkData`.** Which records are customer points, which attribute the user mapped to a demand, what counts as a usable record, what to report when one is not. It lives in a folder of its own, one per source.

**A scan belongs to neither half, so it is shared rather than written twice.** `scan-source.ts`, at the package root, parses and then summarises — it answers "what is in this file" without interpreting a single record, so every importer's `scanSource` is that one function. An importer that finds itself wanting its own is interpreting in order to survey, which belongs in `importFromFeatures`. The root is where anything both halves need lives; a folder still never reaches into another's.

**The test, when it is not obvious:** a file parser that needs to name a `NetworkData` type has been given work that belongs to an importer. `grep NetworkData file-parsers/` should stay empty.

## A file parser: bytes to geometry and properties

- **Stop at parsed data, never at `NetworkData`.** Records and attributes are the whole output; which of them is a customer point is not this half's question.
- **Format handling belongs here, so a new importer inherits every format at once.** Reading is shared; interpreting is not.
- **One table lists the formats; the dispatch, importers and drop zones read it instead of keeping their own lists.**
- **The extension picks the parser, but the content decides what is in it; an unknown extension is still read, not refused.**
- **Hand back WGS84 wherever it can be worked out.** Reprojecting needs no knowledge of what a record means, so it belongs here rather than in every consumer — and it removes the asymmetry where shapefiles arrived converted (shpjs reprojects and cannot be stopped) while GeoJSON did not.
- **A multi-part point or line comes back as one record per part, so no consumer splits its own.** A `MultiPoint` is several points that happen to share a row, and a `MultiLineString` several lines; each part carries the record's attributes, and `recordCount` counts the parts, because that is what a consumer builds. A `MultiPolygon` stays whole: it is one area with several rings — an island, a zone in two pieces — not several areas. Consumers that split multi-parts themselves silently disagreed with each other: the builder split lines and dropped multi-points, and the customer points importer skipped both.
- **The issues already say whether the parse succeeded, so nothing else does.** Records with no error are placed; records that came back with one are not. A separate flag would be a second copy of what the issues state, free to drift from them, and it would have to hold some value on every failure that returns no records at all — a claim about coordinates that do not exist. It would also drag `SourceCrs` — declared in `network-data.ts` — into a half that must not name `NetworkData` types.
- **Name what the data was authored in through `sourceProjection`, and only there.** Once the coordinates have moved it is the only trace of where they came from; a summary shows its `name` as `sourceProjectionName`. It is absent when the records were already WGS84 — a WGS84 `.prj` names nothing, because the file was already there, and a bundle with no `.prj` at all names nothing either, because nobody ever said.
- **Hand back the definition that placed the records, for a consumer that has to keep it.** `sourceProjection` is what the records were converted from: a stated or supplied EPSG resolved against the caller's `projections`, or a `.prj`, which resolves to the listed projection its EPSG authority names and otherwise stands as its own WKT. It is absent whenever the records were already WGS84, stated or assumed.
- **A file that states no CRS means WGS84 — but its coordinates must bear that out.** GeoJSON's default is the reason to assume rather than guess. Eastings read as degrees put the whole network in the sea, so a file that plainly is not in degrees and names nothing is refused, and the caller says what it is in through the input's `crs`.
- **An assumption that holds is still an assumption, and it is reported.** Coordinates that pass for degrees are read as WGS84 and the source imports, but `coordinateSystemMissing` comes back as a warning: nothing in the file ever confirmed it, and only the user can. Silence there would leave a network placed on a guess with no record that a guess was made — and a file that does state WGS84 says nothing, because there was nothing to assume.
- **Judge that over the file, not a record.** A projection puts everything out of range at once, so a majority decides it; a handful of stray coordinates are individual records' problems and are reported as such.
- **A supplied CRS decides, whatever the file states.** A caller supplies one because someone said what the file is in, so it replaces a stated CRS — a `.prj` included — even one that would place the records, and the parser treats it exactly as the file having said it, reprojection included. When it does not place them, the records come back as written with its error: falling back to the stated CRS would hide that the answer given was wrong. `{ type: "unknown" }` says nothing at all.
- **Every part of a shapefile but the `.shp` is optional, and each absence means something specific.** No `.dbf` is a file with no attributes — a fact about the bytes, unlike an importer's empty array, which would be the fabricated default the vocabulary forbids. No `.prj` is a file that states no CRS, so it takes the same path as a GeoJSON that states none: a supplied `crs` stands in, and failing that the coordinates decide between the WGS84 assumption and `coordinateSystemUnknown`. `sourceFilesIncomplete` is left for the one genuinely incomplete case — sidecars that arrive with no `.shp` to go with, where there is nothing to read at all. A consumer that wants more than this is free to demand it before calling; the app's wizards do.
- **A drawing has no attribute table, so its layer and its block attributes are the attributes.** `Layer` on every record, `BlockName` on a record that came from a block, and one attribute per block attribute tag. The file's own names win over a tag that repeats them.
- **A block is a symbol unless its name says it was never named.** An anonymous block (`*…`) or one made by pasting (`A$C…`) holds drawing, so it is opened up and its contents become records; any other block is a symbol placed many times, and each placement is one point.
- **A shape a drawing closed is an area; a fill drawn over one is not.** A closed polyline and a circle come back as polygons, while hatches are left out — a hatch is usually decoration over a boundary that is already a record of its own.
- **A drawing can state where it is, and it is believed only over the ground it was drawn for.** Geographic data names a projection the way a `.prj` does, and carries the mesh of control points it was built from; a drawing whose coordinates fall outside that mesh is refused as a mismatch rather than placed, because the claim was written for other ground — a stale one otherwise lands a whole network in the wrong country with coordinates that pass for degrees.
- **A drawing is only as big as its units say.** Millimetres, centimetres and decimetres are scaled to metres; every other unit is left as written, because nothing else is reliably a length a projection expects.
- **Whether anyone named a CRS changes what being out of range means.** Nothing stated and nothing supplied is `coordinateSystemUnknown` — nobody ever said and the coordinates do not tell us, so a consumer can go and ask. Out of range once a CRS *has* been named is `coordinateSystemMismatch` — the answer was wrong rather than absent, and asking again with the same answer will not help. `coordinateSystemMissing` is not a failure here at all: it is the warning that we assumed, and one message per situation is why the two are separate codes.
- **A source whose records carry no geometry has nothing to place, so it is `sourceEmpty`, not a CRS question.** Asking which projection it is in has no answer.
- **A CRS with no definition and a CRS that does not fit are different failures.** No definition is `coordinateSystemUnsupported` — we cannot try. Coordinates that are still not on the globe after applying it is `coordinateSystemMismatch` — we tried and the answer says the CRS is wrong, including when a file names WGS84 and holds eastings. A `.prj` that shpjs could not apply is one with no definition. Either way the records come back unplaced, rather than as a network silently in the wrong place.
- **A file nobody could place still comes back, in the coordinates it was written in.** Every placement error — `coordinateSystemUnknown`, `coordinateSystemUnsupported`, `coordinateSystemMismatch` — keeps its records; the read errors return nothing, because there was nothing to return. That is what lets records and issues be read together: **features with no error are placed, features with an error are not**, and a consumer needs no other signal. Keep it true — an error that starts returning records would silently make placed data look unplaced. The reason is in *The contract* below: a consumer may know where the records go even when the file does not say, or says it wrongly.
- **The definitions to resolve a code against come from the caller.** The parser keeps no table of its own, so which projections are supported is the consumer's to decide and to extend.
- **A scan reads every record, and must not be "optimised" into a sample.** Whether an attribute is stated on every record, and whether it is a number, are claims about all of them — one unreadable value among a thousand is exactly the case that has to make the column text.
- **Decoding the same input twice must be cheap, not correct-by-luck.** Caching is this half's own business, so a cache miss may be slow and may never change an answer.
- **A cache holds what the bytes said, never what a caller added.** Two reads with different mappings raise different issues, and the second must not inherit the first's.
- **What the bytes said still depends on the CRS they were read in, so that is part of the key.** A supplied `crs` is a reading instruction rather than an interpretation — it decides whether a file comes back placed or `coordinateSystemUnknown` — so a second read that supplies one must not be answered from a first that did not. `projections` is deliberately left out: it is the set of definitions we can handle at all, built once per session, and keying on it would turn every re-render into a miss for an answer that did not change.

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
  importFromSource(input: GisInput & ImportOptions & { config?: ImportConfig<Role> }): Promise<ImportResult>;
  importFromFeatures(features: Feature[], config?: ImportConfig<Role>, options?: ImportOptions): Promise<ImportResult>;
};
```

**A converter's source defines a projection; an importer's source is placed into one that already
exists.** A converter reads the file a project is *created* from, so what that file says its
coordinates are in becomes the project's answer. An importer adds to a project that already has one,
and the file it reads may not say anything — a customer-points export sharing a model's own local
coordinates says nothing because there is nothing to say. So an importer states what it could
establish in `crs` and leaves the placing to the consumer, which is the only party that knows the
project. `NetworkData` carries source coordinates and the CRS they are in; whoever builds puts them
on the globe.

That is why `coordinateSystemUnknown` keeps its records. It does not mean the file is unusable — it
means *this* half cannot say where it goes. A consumer whose project is itself unprojected knows
exactly where it goes, and one whose project is georeferenced still refuses, because for it the
error is real.

**The result is `Partial<NetworkData>`, and that is the whole difference from a converter.** `emptyNetworkData()` states `junctions: []` because a converter handed a model file can truthfully say the model has none. An importer handed a polygon file knows nothing whatsoever about junctions, and stating `[]` there would be the fabricated default the vocabulary forbids everywhere else. A consumer reads `network.zones ?? []`.

That is not only a metaphor: `NetworkData` is assignable to `Partial<NetworkData>`, so a `ParserResult` *is* an `ImportResult`. Merging what two sources produced — two importers, or an importer and a converter — is a plain object spread, and nothing downstream has to know which kind produced which half.

**An import is offered twice, from a source and from features already read.** `importFromSource`
parses and then interprets; `importFromFeatures` is the interpreting alone. They are two doors to one
room — `importFromSource` is parse, guard, delegate — and which a consumer uses depends on whether it
holds bytes or records. One that already has the features skips a second decode by taking the second
door; one that has only a file takes the first. Only `importFromSource` states `crs`, because only it
knows whether the parse managed to place anything.

**Both doors are asynchronous, because interpreting a large source has to yield.** `importFromFeatures`
was synchronous while the reasoning was that only reading a file is asynchronous — true of the I/O, but
not of the CPU. A few hundred thousand records take seconds to interpret, and a consumer on a UI thread
is frozen for all of it. So an importer reads records in batches and lets go of the thread between them
whenever the batch has held it past a slice. When to let go is shared (`createTimeSlicer`, in
`time-slice.ts` at the root); **how many records make a batch is each importer's own**, because it
follows from what one of *its* records costs — a zone carrying whole rings is not a point. The yield is
a **macrotask**: a microtask resumes before the host can paint, which would make the batching invisible.

**A consumer says when to stop, because only it knows whether stopping is possible.** Both doors take
an `ImportOptions` with an optional `signal`, checked at every batch boundary; an aborted import throws
`AbortError` rather than returning a partial `ImportResult`, so a half-read source can never be mistaken
for a whole one. This is the one thing here that throws — *"never throw for bad input"* is about
records, and a caller that has stopped wanting the answer is not bad input. `signal` sits outside
`ImportConfig` deliberately: config says what the consumer knows about the file's **contents**, and this
says nothing about the file at all. Whether the host is slicing this on a main thread or running it in a
worker is not ours to infer, which is why it is told rather than guessed.

**Scanning and importing are separate calls**, because the user chooses a mapping in between and chooses it against what the file turned out to contain. `scanSource` answers "what is in this file" — a `SourceSummary` of `attributes`, `recordCount`, `sourceProjectionName` and, where the source has any, `geometries` — without knowing what any of it means, because nothing has told it yet. `importFromSource` then applies the choice, and a preview is the same call with a `recordLimit`.

The two verbs are the contract: a scan surveys, an import interprets. An implementation that finds itself needing to interpret in order to scan has put something in the wrong half.

The verb says which half you are in. `file-parsers/` parses — bytes, formats, projections. An importer imports — parsed data into `NetworkData`. A `parse` in an importer folder, or an `import` in `file-parsers/`, is a file in the wrong place.

**Both phases take `GisInput` — the files, plus the CRS to read them in, which replaces any they state, and the projection definitions to resolve one against — and a scan returns a summary rather than a handle.** The two are separate because they answer separate questions: `crs` is which projection this particular file is in, `projections` is which projections we can handle at all. A consumer that supports more of them extends the map without touching a mapping, and both phases need them because a scan reprojects exactly as an import does. **A summary is null only when there was nothing to describe**, never merely because an error was raised: a file nobody could place still has attributes and a record count, and a consumer that means to place it itself needs them to build a mapping. Whether to proceed is read from the issues, in the scan exactly as in the import. The tempting alternative is for `scanSource` to hand back the decoded records for `importFromSource` to reuse. That puts a second shape in the contract — one per implementation — and makes every consumer hold and pass it, for a saving that belongs to the implementation anyway. Taking the same input twice keeps the contract to one shape, matches `Converter`, and means a consumer that already has the files needs nothing else to parse them.

**`ImportConfig` says what the consumer knows about a file's contents.** `units` is echoed onto `NetworkData.units` and converted by nobody here. How to read the file at all — including the CRS to assume — is `GisInput`'s, because the reader needs it before a mapping exists, and a supplied CRS replaces whatever the file states.

Everything is stated in **records** and **attributes** rather than rows or features, because a source that is not geographic still has a record count, an attribute list and a mapping. `geometries` is optional for the same reason: a spreadsheet has none.

## This package publishes

Everything under `public/**` reaches the open-source mirror. Invent every fixture — no name, code or coordinate from a real model.
