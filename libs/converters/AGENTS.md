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

## One array per asset kind, and a shared record per shape

`NodeData` (`ref`, `label?`, `coordinates`, `elevation?`) is what every node kind is built
on, so a consumer can treat the common part uniformly and branch only on what differs.
`JunctionData` adds only its demands.

**`ref` is the source's join key; `label` is what a person calls it.** They are separate
because a vendor's display names are free to collide, be too long, or repeat across
namespaces, while its internal ids never do. Fusing them turns a naming collision into a
join bug — the consumer resolves `label ?? ref` against its own label rules and can always
fall back to `ref`, which is guaranteed unique.

`LinkData` (`ref`, `label?`, `startNodeRef`, `endNodeRef`, `vertices?`, `isActive?`) does the
same for link kinds. **`vertices` are the intermediate points only** — the consumer composes
the polyline from the resolved endpoints, so the geometry can never disagree with the
topology, and a moved node cannot leave a stale coordinate behind.

**`ref` is unique within its array, not across the model.** A source is free to number its
nodes and its links independently, and Synergi does — a pipe and a junction in the same model
are both `ref: "0"`. Links therefore name their endpoints with `startNodeRef`/`endNodeRef`
resolved against the node arrays, and a consumer must never key one global map by `ref`.

**A boundary node's head is a head, in `units.elevation`.** `ReservoirData.head` is the
absolute head the source stated. A source that states a *pressure* instead has to convert it,
or say it cannot; passing a pressure off as a head is not an option.

**A head that varies over time is `head` × `headPatternRef`.** The pattern carries the heads and
`head` is the multiplier that scales them, which is what EPANET means by the pair and what lets one
field serve both a fixed and a varying boundary. A parser that has the series states it that way
rather than reducing it to an average.

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

A quantity is named for what it measures, not for the asset it sits on: `level` covers every
tank level whichever asset it sits on. The exception is `tankDiameter`, which exists because a
vendor really does state two diameters in two units: Synergi holds pipe and valve diameters in
`mm` and a tank's cylinder in `m`, the same split the app's own unit spec makes. A second entry
appears when a source forces one, not before.

**Roughness deliberately has no entry.** The app carries roughness as a bare unitless number —
both unit presets set it to `null`, and there is no per-formula unit anywhere — so a source
unit here could never drive a conversion. What the number *means* is fixed by
`headlossFormula`, not by a unit.

## A curve is shared, so it is its own record

`CurveData` (`ref`, `label?`, `points`) sits in `NetworkData.curves`, and whatever uses one names it
by ref — `PumpData.curveRef` for a head curve, `TankData.volumeCurveRef` for a volume curve — the
same `ref`-resolved-against-an-array shape links use for their endpoints. Sources share one curve
between several assets (Synergi has one Q-H profile driving four pumps), and a curve carries a name
of its own that the source states. Inlining the points on each asset would duplicate them, lose that
name, and leave a consumer guessing which duplicates were once the same curve.

**Points are `{ x, y }`, not named for what they measure.** What a curve means comes from where it
is referenced: a pump's curve is flow against head, so the consumer converts `x` with the flow unit
and `y` with the head unit; a tank's volume curve is level against volume and converts through those.
The same record serves an efficiency or headloss curve without a second shape.

**Which quantity is on which axis is the contract's, not the vendor's.** A source is free to store
its volume curve the other way round, or on a datum of its own — Synergi states volume against a
depth measured from the tank's floor — and the parser that knows that turns it round on the way out.
A tank's volume curve therefore arrives as level against volume, its levels on the same datum as
`TankData.minLevel`. Leaving the source's own axes on the record would make every consumer hold a
rule per vendor to read a shape that is supposed to be uniform, and a curve read on the wrong axis
is not a wrong number, it is a tank of a different size.

Only curves something references belong in the array — a source is free to hold thousands of
unrelated series in the same table.

## Demand is a list, and its pattern carries the magnitude

`JunctionData.demands` is a `DemandData[]` — sources allocate demand in categories, and one
junction routinely carries several. Each names its pattern with `patternRef`, resolved against
`NetworkData.patterns`, the same way a pump names its curve.

**A base demand is not the demand.** The value a source stores is only half of it: the other half
is the pattern, and a vendor is free to put the magnitude there rather than in the base — Synergi
does, with pattern multipliers around `0.0016`. A consumer that drops the pattern and keeps the base
is not importing an approximation, it is importing a number three orders of magnitude wrong. A
parser that cannot carry a demand's pattern must therefore leave the demand out and say so.

**Patterns are multipliers on one step, not a time series.** `PatternData.multipliers` covers one
cycle at `NetworkData.patternTimeStep` (seconds), because that is what the model downstream holds —
one step for the whole model. A source that samples its profiles at several rates resolves them onto
one step itself and states which, the same way it resolves one `headlossFormula` out of per-pipe
ones. How a vendor reads its own profile between samples is vendor knowledge, and the alternative —
handing every consumer a set of time series to interpolate — writes that knowledge once per
consumer instead of once per vendor.

**`simulationDuration` is the cycle those multipliers cover**, in seconds — the same reduction seen
from the other end. A parser that resolves its profiles onto one step knows how long one pass
through them is, and stating it is what lets a consumer run the model over the period the source was
authored for instead of a single snapshot. It is not a per-quantity setting: what a consumer does
with it — which timestep to solve on, whether to report every step — is the consumer's call.

## A control joins two assets, so it belongs to neither

`NetworkData.controls` is its own array, the same way curves are, because a control names a link
*and* a node and putting it on either one leaves the other end a dangling reference on a record
that has no business holding it.

**Each `type` is one recognised behaviour, not a condition-and-action language.** The tempting
generalisation is `{ when, then }`; it is the same mistake as putting INP syntax on the record.
An open-ended language means a consumer must interpret arbitrary combinations and can never know
what it supports, while a named record lets it switch exhaustively and add one behaviour at a time.
Five records today:

| type | the source states | consumer |
|---|---|---|
| `tankLevel` | a tank switches a link between running and shut | `[CONTROLS]` |
| `timedSetting` | the setting follows a schedule | `[CONTROLS] … AT TIME` |
| `tankFloat` | a float shuts the link when the tank fills, reopening after a drop | `[CONTROLS]` |
| `remotePressure` | a link holds a pressure at some *other* node | nothing EPANET can express |
| `flowModulatedSetpoint` | the setting follows a curve of flow | nothing EPANET can express |

**A control the consumer cannot express is still carried.** Whether a behaviour can be built is a
property of the consumer, not of the source — the same reasoning that makes `"unknown"` describe a
vendor's valve kind rather than our capability. So the parser states what the file says and the
*builder* reports what it could not use, which is also where the domain-policy line already sits:
source-level problems are the parser's, what to do about them is not.

**Refs are typed only where more than one array can hold them.** `link` is
`{ kind: "pipe" | "pump" | "valve"; ref }` because a control genuinely names any of them and `ref`
is unique within an array, not across the model; `kind` is also how a consumer routes — holding a
schedule natively for one link kind and not another. `tankRef` stays a bare string because nothing
but a tank can be there.

**An action is a setting or a status, never a number standing in for one.** `ControlAction` is
`{ setting }` or `{ status: "open" | "closed" }`, because `0` is a real setting whose meaning
changes with the link: K = 0 on a throttle valve is *wide open*, zero flow on an fcv is shut, and
zero speed on a pump is off. A vocabulary that encoded shut as a number would be wrong for the most
common valve kind we read.

### `tankLevel`

The link runs at `on.setting` (or simply opens) while the tank is below `on.level`, and shuts above
`off.level`. `on.level` and `off.level` are levels, in `units.level`, on the same datum as
`TankData.minLevel`; a stated `on.setting` is in whatever quantity the link carries — a speed
relative to rated for a pump, a valve setting for a valve.

**The off side carries no setting**, and its type says so. Every reference export writes a shut
link there, and the domain has no field for a second running state, so a source that states one is
stating something this record cannot hold — the parser leaves the control out and says so. The on
side is a `{ setting }` *or* `{ status: "open" }` for the same reason in reverse: an on/off rule on
a valve means open, and `1` would mean K = 1.

### `timedSetting`

`steps` of `{ time }` plus an action, time in seconds from the start of the run. The steps are the
source's own points, not a resampling onto `patternTimeStep`: a schedule states *when* it changes,
and a consumer that wants a grid can build one, while a consumer handed a grid can never recover
the instants.

A record carrying a schedule also frees the link to state the value at t = 0 as its own setting:
that number is exact, not a moving setpoint flattened into one, precisely because the rest of the
series travels beside it.

### `tankFloat`

`reopenDrop` is how far the tank must fall below full before the float lets the link open again, in
`units.level`. Only the drop, because only the drop is stated — the level it closes at is the tank's
own full level, which the consumer holds. Computing it here would ship an inference dressed as
source data.

### `remotePressure` and `flowModulatedSetpoint`

Both say "a controller adjusts this link to hold something measured elsewhere", which EPANET has no
form for — its pump and its regulator control their own outlet. `remotePressure` covers a
variable-speed pump holding a pressure at a node and a regulator sensing at a node that is neither
of its endpoints: one behaviour, and a consumer branches on `link.kind` if it cares.
`flowModulatedSetpoint` names the link whose flow drives the setting — often the link itself, sometimes
another — and a `curveRef` into `NetworkData.curves` whose X is a flow and Y a pressure, because a
curve is a curve wherever it is referenced.

## A custom attribute is declared once and valued per asset

`NetworkData.customAttributes` is a `CustomAttributeData[]` — `ref`, `name`, `type` — and every
asset record carries `customAttributes?: CustomAttributeValues`, a map keyed by that `ref`. It is
the same shape a curve uses: the shared thing lives in its own array and whatever uses it names it
by ref.

**`ref` and `name` are both there, and they are not redundant.** A source is free to declare two
attributes with the same name against different kinds of asset, and one whose declarations are
scoped to its own object classes routinely does — the same word means a different measurement on a
pipe and on a valve. So the name is what a person reads and the `ref` is what identifies the
column: a parser does not deduplicate by name, and the array may legitimately hold two entries that
read alike.

**`name` is required, unlike every `label?` elsewhere.** A curve falling back to its `ref` costs
nothing because nobody reads a curve's name; a custom attribute's name is the heading of a column
in the asset panel, so `7` at the top of one is useless. A source that names an attribute nothing
leaves it out.

**A value's runtime type matches its declared `type`** — every value of a `text` attribute is a
string, every value of a `number` attribute is a number — so a consumer switches once on the
declaration instead of on each value. Which of the two it is, is the parser's to decide: an
attribute is a `number` only when *every* value it carries reads as a finite number, and anything
else is `text`. Falling back rather than splitting is what keeps a column whole — one `INS` among a
thousand diameters makes the attribute text instead of dropping that asset's value.

**An attribute no asset carries is not in the array**, the same rule curves follow. It also means
the array does not say which kinds an attribute applies to: that is answered by which assets carry
a value. Vendors scope declarations to their own object classes, which rarely line up with asset
kinds — a Synergi "element" is a pipe, a pump, a valve *and* a tank — so a declared scope would
open empty columns on kinds the source never filled.

**A key missing from the map means the source said nothing for that asset**, the same `?:` rule as
everywhere else. That is why a value is `string | number` and never `null`.

## A zone is a named boundary, and nothing hydraulic hangs off it

`NetworkData.zones` is a `ZoneData[]` — `ref`, `label?` and `polygons`, the same `ref`-as-join-key
shape every other record uses. Nothing in the model points at a zone and a zone points at nothing:
it is a boundary a person drew round part of the network, and what falls inside it is decided by
geometry, not by a reference the source has to keep in step.

**`polygons` is `[polygon][ring][position]`** — the outer ring first, holes after, rings closed, in
the source CRS like every other coordinate here. It carries holes and several parts from the start
because a zone that is a ring road round a reservoir, or a district in two pieces, is an ordinary
thing for a source to hold, and a flatter field would make that a change to this file rather than a
change to one parser. A source with a single simple boundary states `[[ring]]` and pays one pair of
brackets for it.

**Closing the ring is the contract's, not the vendor's.** A half-open ring is not a polygon, so a
consumer handed one has to close it before it can do anything at all — which means every consumer
writes the same line, or the first one that forgets draws a zone with a gap in it. A source that
states its outline open closes it on the way out; a source whose rings already close passes them
through.

**Which polygons in the file are zones is the parser's call.** Vendors keep boundaries in the same
table as every other polygon they draw — development sites, annotations, superseded outlines — and
telling those apart is vendor knowledge like any other. A parser that emitted all of them would make
every consumer hold a rule per vendor to filter a list that is supposed to be uniform, which is the
same reasoning that puts a volume curve's axes here rather than downstream.

There is deliberately no `kind` on the record. A vendor that really does state a classification the
consumer can act on adds a `category?: string` carried verbatim, the way `PipeData.material` is; a
`kind` guessed from the vendor's own layer names would be this package inventing a vocabulary
nothing has asked for yet.

**Membership is not carried.** A source that also states which assets belong to which zone — Synergi
does — says nothing here, because a consumer that holds zones as geometry derives membership by
point-in-polygon and a second, disagreeing answer helps nobody. If that changes, a `zoneRef` on the
asset records is the additive way in.

## A kind the source did not give is `"unknown"`, not a dropped record

`ValveData.kind` is `ValveKind | "unknown"`. A vendor kind that maps to nothing in the domain
still produces a record — with its `ref`, both endpoints, its geometry and whatever else was
readable — because the link is real and carries flow. Dropping it would leave two nodes
unconnected that the source says are connected, which is a worse lie than an imprecise kind.

`"unknown"` describes the **source**, not the consumer's capability, the same way
`SourceCrs = { type: "unknown" }` does. What to substitute is the consumer's call, and the
parser raises an issue carrying the source's own code so nothing is lost.

## One headloss formula, chosen by the parser

`headlossFormula` sits on `NetworkData`, not on the pipe. EPANET holds exactly one formula per
model, and a roughness number is only interpretable against it — a Hazen-Williams C-factor and
a Darcy-Weisbach roughness height differ by three orders of magnitude.

A source that states the formula per pipe (Synergi does; it has no global setting) resolves
the network's formula itself and reports every pipe that disagrees, emitting that pipe with
**no `roughness`**. Absent then means what it always means, and the consumer's existing
"apply the default" path produces a sane number instead of one in the wrong quantity. Nothing
downstream has to know a reduction happened, and no roughness is ever converted between
formulas.

## Issues carry structure, not sentences

`ParserIssue` is `{ code, severity, ref?, context? }`. `code` is a short leaf id —
the UI composes the i18n key and interpolates `context`, so no English lives
here. **`issueCodes` is a runtime array and `IssueCode` is derived from it**, so a consumer can
enumerate the vocabulary and prove it has a message for every code — the app does, and without it
a code added here surfaces to the user as the raw i18n key. `severity` says whether the import can proceed; that decision must not be
re-derived from the code list in the app.

Issues raised by a parser are **source-level** only: this row is malformed, this
reference does not resolve, this file cannot be read. Domain policy — a truncated
label, a declared length that disagrees with geometry — belongs to whatever
builds the model, so it is written once instead of once per implementation.
