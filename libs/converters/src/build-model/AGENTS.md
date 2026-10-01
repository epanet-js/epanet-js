# Build model

Turns the `NetworkData` a converter returns into a hydraulic model. It is the consumer the package's contract keeps referring to; read [its `AGENTS.md`](../../AGENTS.md) first.

- Parsers never import from here.
- An imported asset carries only what the source said: an absent field stays empty and is never defaulted, and a stated zero stays zero.
- Project defaults apply to assets the user draws later, never to imported ones.
- A valve of unknown kind is built as a TCV with a blank setting, the same as the INP import.
- A tank's overflow is whatever the parser stated; nothing here adds a default for it.
- A link with neither a stated length nor a roughness is a device, not a pipe: it takes its measured length and the headloss formula's default roughness. A pipe with a stated length keeps a missing roughness blank.
- A control is built only when the engine can express it exactly; anything else becomes an issue. Float valves are not built, because a two-state approximation is not equivalent.
- Valve schedules are built as raw controls until timed controls support valves.
- A node's activity is derived from its links, never read from the source: it stays active while any link into it is active, or when it has no links.
- A record's label is the source's label, never its ref: an empty one is generated, and a taken one is de-duplicated.
- Zones sharing a label merge into one; unnamed zones never merge.
- Custom attribute definitions are returned with the model, separately from the values on each asset; the caller must persist both.
