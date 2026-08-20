# Converters — the app side

Turns the plain `NetworkData` a converter returns into a `HydraulicModel` the app can open.
The registry here is what lets one command serve every vendor; `buildModel` is the single
consumer of the parsed data.

The data shape, the issue vocabulary and the rules a parser follows are not defined here —
they belong to `@epanet-js/converters`; read
[its `AGENTS.md`](../../../../../libs/converters/AGENTS.md) first. This module is the
*consumer* that contract keeps talking about, and the notes below are the decisions that fall
to a consumer.

## An imported asset carries what the file said, and nothing else

The contract's `?:` means "the source did not say", and the consumer decides the default.
**This consumer's answer is: no default.** An absent field stays absent, and reaches the model
as `null`.

That is deliberate, and it is the opposite of what a simulator wants. The reason is that a
fabricated value is indistinguishable from a real one the moment it lands in the model — a
pipe silently given a 300 mm diameter looks exactly like a pipe whose file said 300 mm, so
nobody reviewing an import can tell which numbers came from the vendor. Blanks keep that
distinction visible, which is what makes an import reviewable at all.

Consequences to expect rather than treat as bugs:

- A model built this way is generally **not simulatable**. `src/simulation/build-inp.ts`
  writes a placeholder for a missing required value, and EPANET rejects it. Import,
  inspection and map display all work; solving does not, until a source supplies the values
  or a later decision introduces defaults deliberately.
- **A stated `0` is a statement, not a silence.** A zero diameter reaches the model as `0`.
  Whether a vendor's `0` means "unusable" is a per-vendor question and belongs to whatever
  knows that vendor — not here.

`projectSettings.defaults` is a different thing and is still populated: it governs what the
user gets when they *draw a new asset* in an imported project, so it stays correct for the
model's headloss formula. Only the stamping of those defaults onto imported assets is gone.

## Substituting for what the source could not say

A valve whose kind the source did not give arrives as `"unknown"` and is built as a `tcv`.
That is not a default in the sense above — the domain has no "unknown" valve, so *something*
must be chosen for the asset to exist at all, and a link that exists imprecisely beats a link
that silently disappears. `tcv` is the app's own established answer: the INP importer coerces
an unrecognised valve type to `tcv` too, so both import paths behave alike.

Its setting stays blank, because a number whose quantity we cannot name is worse than none —
a valve setting is a pressure, a flow or a dimensionless coefficient depending on the kind.

## What the builder owns

Everything a parser is forbidden to do, so it is written once instead of once per vendor:

- **Refs to ids.** Nodes are built first, recording `ref → id` and reprojected coordinates;
  links resolve their endpoints against that map, and a link whose endpoint never arrived is
  dropped rather than left dangling.
- **Labels.** `label ?? ref`, sanitised to the app's length limit, falling back to `ref` and
  then to a generated label. `LabelManager` uniqueness is per *group* — junction/reservoir/tank
  share one, pipe/pump/valve another — so a node and a link may legitimately share a label.
- **Units.** Source quantities are converted into the project's unit spec. The source unit is
  per quantity, so each conversion is built from the pair, and a quantity the app holds as
  unitless (`null`) converts to itself. A valve's `setting` is converted by *kind* — a
  pressure for prv/psv/pbv, a flow for fcv, unitless for the rest.

  Note that the project largely *adopts* the source's units: the flow unit picks the unit
  system, and a stated pressure unit overrides the preset. So most of these conversions are
  identity in practice, and the ones that are not come from a source unit no EPANET unit
  system can express (`l/h`, `l/d`, `gal/d`, `ft^3/d`), which fall back to LPS. Building the
  converter from the pair anyway keeps that an implementation detail rather than an assumption.
- **Geometry and topology.** Coordinates are reprojected out of the source CRS; a link's
  polyline is composed as `[start, ...vertices, end]` from the *resolved endpoints*, so the
  geometry cannot disagree with the topology. `assetIndex` and `topology` are populated inline.
- **Length from geometry.** A declared length wins. When the source is silent the polyline is
  measured, which is the one case where a value is computed rather than read — it is derived
  from the source's own coordinates, not invented.
