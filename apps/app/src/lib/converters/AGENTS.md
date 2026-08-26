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
- **A default roughness for a link the source described no pipe for.** When a source states
  neither a length nor a roughness it did not describe a pipe there — it described a device this
  model has to spell as one, like Synergi's check valves, which EPANET can only express as a pipe
  with status `CV`. Those take the measured length (below) and the headloss formula's default
  roughness from `getDefaultRoughness`, the same number a newly drawn pipe gets. A pipe whose
  length the source *did* state keeps a blank roughness, per the rule above: that is a real pipe
  with a value missing, not a device. Nothing is lost by the default — the real loss on such a
  fitting is its minor loss, which the source states and `PipeData.minorLoss` carries.
- **Simulation timing.** A stated `patternTimeStep` becomes the pattern, hydraulic *and* report
  timestep, and `simulationDuration` becomes the duration — which is what flips an imported project
  from a single snapshot into an extended-period run (`build-inp` treats `duration > 0` as EPS).
  Solving and reporting on the source's own step is what makes the result comparable against the
  vendor's own output; every reference INP writes the same value for all three. Absent, the defaults
  stand and the import stays a snapshot.
- **Controls it can express become raw EPANET controls; the rest become issues.** `buildModel`
  returns `issues` alongside the model for exactly this: whether a stated behaviour can be built is
  a property of this consumer, not of the file, so the parser carries the data and the decision is
  made here.

  | control | built as |
  |---|---|
  | `tankLevel`, a pump | a native `LevelSettingControl` |
  | `tankLevel`, a valve | raw `LINK … OPEN/CLOSED IF NODE … BELOW/ABOVE`, the shape the reference exports write |
  | `timedSetting` | raw `LINK … AT TIME`, the setting converted through the valve's own quantity |
  | `tankFloat` | nothing — `tankFloatControlUnsupported` |
  | `remotePressure` | nothing — `remotePressureControlUnsupported` |
  | `flowModulatedSetpoint` | nothing — `flowModulatedSetpointUnsupported` |

  **A float valve is carried but not built.** Its two states look expressible — shut above the
  tank's `maxLevel`, open again `reopenDrop` below — which is exactly why it was worth measuring
  rather than assuming: measured across a full day on a production model those controls came out
  **bit-identical** to having none, because the tanks never reach `closeAbove` and the open branch
  only re-states the valve's own setting. A real float modulates as the tank fills, so a two-state stand-in earns
  nothing and reads as support for something the engine cannot do. The issue says so instead.

  The domain's `TimedSettingControl` is the right home for a schedule, but its steps are typed and
  rendered as a pump's speed and its editor only appears on a pump, so a valve's schedule would be
  silently mis-emitted — `pumpSettingFor` turns a setting of 1 into `OPEN`, which for a tcv means no
  loss at all rather than K = 1. Raw controls carry it exactly today: persisted, emitted, skipped
  when they name an inactive asset, and surfaced in the panel as "raw controls detected", at the
  cost of not being editable. `link.kind` on the control is the switch that routes a pump to the
  native shape once the domain covers both.

  **The template placeholder is why this is the consumer's job.** `{{0}}` resolves from the asset id
  at INP-build time, so nothing upstream needs to know what the app will end up calling the valve —
  and nothing downstream inherits a label the label manager may still change.
- **Custom attributes.** The contract declares an attribute once with a `ref`; the app scopes its
  definition per asset kind. So the builder collects which kinds actually carry each `ref`, mints a
  `custom-<n>` id per (kind, attribute), and passes the values into the asset factory's existing
  `BuildData.customAttributes`. One source attribute valued on both junctions and pipes therefore
  becomes two app attributes sharing a label, which is what the app's own model means by a custom
  attribute.

  The definition rides on the `HydraulicModel`; the values ride on the assets and persist with them
  through `custom_attributes` on each row. The definition does **not** travel through
  `importProject`, so `convert-model.tsx` writes it with `saveCustomAttributes` once the project
  exists — without that the values are in the database with no column to show them under.

- **Zones.** `ZoneData` becomes the app's own `Zones`, reprojected out of the source CRS like every
  other coordinate, through the same `importZoneFeatures` the GIS import runs — so a vendor import
  and a shapefile import produce zones that are identical in shape, labelling and merging, and a
  change to either follows the other. The label is `label ?? ref`, per the rule above; boundaries
  sharing one label merge into a single multi-part zone, which is what the source meant by naming
  them the same thing.

  **Zones are not part of the `HydraulicModel`.** They travel beside it, through
  `startNewProject`, and reach the database via `importProject`; nothing in the model points at
  one, and what falls inside a zone is answered by point-in-polygon where it is asked. So a zone
  needs no id resolution, no label manager and no unit conversion — only the projection.

- **Active topology.** `LinkData.isActive` is the only thing a source states; a node's is derived
  from it — a node stays active while any link into it is active, and a node with no links at all
  stays active. That is not a default filling a silence, it is the app's own invariant, held
  everywhere else by `deactivateAssets` and `inferNodeIsActive`
  (`src/hydraulic-model/utilities/active-topology.ts`), which the builder reuses rather than
  restating. A vendor cannot state it: Synergi has no node-level service state at all, so it too
  derives node activity from its elements.

  Without this an imported node whose every link is out of service arrives active with nothing
  active attached, which the network review reports as an orphan the user cannot clear — node
  activity is derived, never edited — and which `build-inp` writes into `[JUNCTIONS]` with no
  incident pipe. Deactivating it takes its demand out of the simulation too, which is the point:
  the whole assembly is out of service.
