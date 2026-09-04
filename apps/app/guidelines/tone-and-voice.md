# Tone and voice

epanet-js speaks like a knowledgeable colleague — direct, calm, and helpful without being corporate or patronising. The writing should feel like it came from a person, not a system.

## Core principles

- **Plain language.** Say exactly what happened and what to do. Avoid jargon, hedging, and filler.
- **Specific over vague.** "Your current zones will be permanently deleted" not "This may result in data loss."
- **Action-oriented.** Every message should leave the user knowing what to do next.
- **Calm under pressure.** Errors and warnings are matter-of-fact, never alarming.

## Voice: when to use "we"

Use **"we"** when the app or team is actively doing something — scanning, recommending, upgrading, or failing at an action on the user's behalf:

> "We found 3 issues that may affect your simulation results."
> "We couldn't apply your last change."
> "We recommend using the epanet-js Project as your primary save."
> "We've upgraded how saving works."

Use **neutral or passive voice** when reporting a system or simulation state — the app is an observer, not an actor:

> "The simulation finished with one or more warnings."
> "Simulation run was unsuccessful."
> "Some features may not be available."
> "Elevation data cannot be retrieved."

The dividing line is **agency**. Did the app try to do something? Use "we." Is this a fact about the system's state? Use neutral.

## Tone by context

| Context | Tone | Example |
|---|---|---|
| Success | Brief, warm. Exclamation mark is fine. | "Your trial is now active!" |
| Warning | Matter-of-fact. State the consequence clearly. | "Your current zones will be permanently deleted." |
| Error | Empathetic, then actionable. No drama. | "Something went wrong. If the error persists, contact support." |
| Recommendation | Direct. Not preachy. | "We recommend fixing them before running." |
| Informational | Conversational. Explain the why. | "We've upgraded how saving works! Your file is now saved as a native Project." |
| Paywall | Benefit-focused. Not pushy. | "Scenarios let you explore 'what-if' changes without duplicating your model." |

**Exclamation marks** are reserved for success states only. Never use them on warnings, errors, or recommendations.

## Dialogs

- **Title:** describe the state, not the system event. Short noun phrase or short sentence.
  - ✅ "Unsaved changes" / "Your model has issues" / "Something went wrong"
  - ❌ "Model issues found" / "Error detected" / "Warning"
- **Body:** follow this three-part structure, using only the parts that apply:
  1. **What happened.** State the situation plainly. No blame, no alarm.
     > "We found 3 issues that may affect your simulation results."
  2. **Why it happened.** Only include if it helps the user understand or avoid the problem again. Skip it for obvious or technical causes.
     > "The EPANET INP format doesn't support all epanet-js features."
  3. **How to recover.** Tell the user what to do next. Be specific — name the action or the place to go.
     > "We recommend fixing them before running. You can review them in the Network Review panel."

  Not every dialog needs all three parts. A simple destructive confirmation needs only what happened. A complex error needs all three.

  Each included part is its own paragraph — never merge two parts into one sentence with a connector like "so" or "and then".
  - ❌ "Your browser doesn't support WebGL, so switch to Chrome." (what + how, merged)
  - ✅ "Your browser doesn't support WebGL, which epanet-js requires to render the map." / "Switch to the latest version of Chrome, Firefox, or Safari to continue." (two paragraphs)
- **Dismiss CTA:** use "Understood" for informational dialogs, "Got it" for lighter acknowledgements.

## CTAs

Use verbs that describe exactly what will happen next. Avoid generic labels.

- ✅ "Delete and import" / "Fix issues first" / "Save and continue" / "Choose a network"
- ❌ "OK" / "Confirm" / "Yes" / "Close"

For two-option dialogs, the primary action describes the recommended path; the secondary describes the alternative without judgement.

- ✅ "Fix issues first" (primary) / "Run anyway" (secondary)
- ❌ "Fix issues first" (primary) / "Ignore and proceed" (secondary — implies the user is doing something wrong)

## Casing

See [translation.md](./translation.md) for full casing rules. In short: sentence case everywhere. Capitalise proper nouns, acronyms, and asset names (Junction, Pipe, Reservoir, etc.).
