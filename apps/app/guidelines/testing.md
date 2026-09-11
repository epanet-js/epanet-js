# Testing Guidelines

## What earns a test

**Deciding not to write a test is part of the work.** Every test is read on every
change to the code around it and runs on every CI job, so one that restates the
implementation costs more than it protects. Before writing one, ask what it would
catch that nothing else would.

**Test the logic, not the wiring.** Model operations, importers and exporters,
change sets, persistence commands, parsing, formatting, and the rules inside
panels — that is where a regression is silent and a test pays for itself. A test
that renders a dialog to assert it rendered, clicks a button to assert the command
it is wired to ran, or flips a flag to assert a component disappeared, asserts that
React and the wiring work. Verify those by using the app.

**Scaffolding is fine while you build — trim it when you're done.** A throwaway
test is often the fastest way to drive a component you are still shaping, and
there is no reason to avoid one. It is development scaffolding, not deliverable:
once the behaviour works, keep the parts that cover real logic and delete the
rest, in the same piece of work that added them. Scaffolding that ships becomes
someone else's maintenance, and nothing later will identify it as scaffolding.

**Say what you removed.** Trimming is a judgement call, so name the tests you
dropped and why when reporting the work — never a silent deletion.

## Standard Testing Requirements

### Test Structure
- Use descriptive test titles (short and clear)
- Follow existing patterns from the codebase
- Use helper builders for test data construction

### Test Naming Convention
- **Use numeric constant IDs** for asset identification in tests: `1`, `2`, `3`, etc.
- Reserve labels (like "J1", "P1") only when tests explicitly assert on label values
- Use concise labels when needed: `J1` or `P1` instead of `J_1` or `P_1`
- Short titles in `it()` blocks
- Descriptive `describe()` blocks

### Test Types
1. **Unit Tests**: Individual function/module testing
2. **Integration Tests**: Behaviour across collaborating modules, driven through a real path
3. **User Acceptance Tests**: End-to-end user scenarios

None of the three is owed to a change by category — see [What earns a test](#what-earns-a-test).

### Testing Tools
- **Framework**: Vitest (existing setup)
- **React Testing**: React Testing Library
- **Assertions**: Built-in Vitest matchers

### Test Setup Guidelines
- **Use numeric IDs** with the `IDS` constant pattern for all test assets
- **Always use `HydraulicModelBuilder` to setup hydraulic models in tests** when possible
- This centralizes the logic for connecting assets and adding defaults
- Avoids spreading hydraulic model setup logic throughout the test codebase
- Use `HydraulicModelBuilder.with()` or `HydraulicModelBuilder.empty()` to create test models

### Asset ID Management in Tests

#### Numeric IDs (Primary)
- **Always use numeric IDs** when creating test assets with `HydraulicModelBuilder`
- Define ID constants at the test level using the `IDS` pattern
- Assign consecutive IDs and avoid repetition.

#### ID Constant Pattern
```typescript
it("splits a pipe and adds a junction", () => {
  const IDS = {
    J1: 1,
    J2: 2,
    P1: 3,
  } as const;

  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0] })
    .aJunction(IDS.J2, { coordinates: [10, 0] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .build();

  const pipe = hydraulicModel.assets.get(IDS.P1);
  expect(pipe).toBeDefined();
});
```

#### Using IDS Constants
**Every numeric ID value in your test should come from the IDS constant object.**
- Accessing assets: `hydraulicModel.assets.get(IDS.P1)`
- Passing IDs to operations: `pipeIdToSplit: IDS.P1`
- Comparing IDs in assertions: `expect(asset.id).toBe(IDS.P1)`
- Customer point IDs: `hydraulicModel.customerPoints.get(IDS.CP1)`

#### Labels (Secondary)
- Only add `label` properties when tests explicitly check label values
- Example: `label: "MainPipe"` when test asserts `expect(pipe.label).toBe("MainPipe")`
- Omit labels when tests don't verify them

#### Benefits of Numeric IDs
- **Aligns with internalId**: Numeric IDs match the internal numeric ID system
- **Clear semantics**: Numbers indicate IDs, strings indicate labels
- **Migration path**: Enables gradual transition to numeric-first architecture
- **Reduced noise**: Fewer string literals in test code

#### Common Mistakes to Avoid

**❌ DO NOT use hardcoded numeric literals in expectations:**
```typescript
// WRONG - hardcoded literals
expect(asset.id).toBe(1);
expect(customerPoint.id).toBe(2);
expect(getNodeId(data, 0)).toBe(3);
```

**✅ DO use IDS constants:**
```typescript
// CORRECT - using IDS constants
const IDS = { J1: 1, CP1: 2, J2: 3 } as const;
expect(asset.id).toBe(IDS.J1);
expect(customerPoint.id).toBe(IDS.CP1);
expect(getNodeId(data, 0)).toBe(IDS.J2);
```

**Why this matters:**
- Makes tests self-documenting - you can see which asset is being referenced
- Makes tests maintainable - changing an ID only requires updating the IDS object
- Prevents confusion - `IDS.J1` is clearer than just `1`
- Follows the codebase testing pattern consistently

### Workflow Integration
- Run `pnpm run check-types` first
- Then run `pnpm test` (expensive, don't parallelize)
- Finally run `pnpm run lint:fix`

### Test Performance Guidelines
- **Tests are expensive** - avoid running full test suite unnecessarily
- Do not run all tests unless explicitly requested
- Be mindful when multiple Claude agents are active
- Target specific test patterns when possible: `pnpm test -- [pattern]`
- Never run tests in parallel with type checking or other expensive operations

### Example Test Pattern
```typescript
describe("User Preferences", () => {
  it("saves dark mode setting", () => {
    const user = createTestUser();
    const preferences = buildUserPreferences({ darkMode: true });
    // test implementation
  });
});
```

### Asset Identification in Tests
Use numeric IDs for test asset identification, with labels only when needed:

```typescript
describe("Hydraulic Model", () => {
  it("connects junction to pipe", () => {
    const IDS = {
      J1: 1,
      P1: 2,
    } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J1 })
      .build();

    const junction = hydraulicModel.assets.get(IDS.J1);
    const pipe = hydraulicModel.assets.get(IDS.P1);

    expect(pipe?.connections).toContain(IDS.J1);
  });

  it("preserves custom labels when specified", () => {
    const IDS = { J1: 1, J2: 2, MainPipe: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.MainPipe, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        label: "MainPipe",
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.MainPipe);
    expect(pipe?.label).toBe("MainPipe");
  });
});
```

## When to Override
- Performance-heavy features that need specialized testing
- Complex integrations requiring custom test environments
- Features with external dependencies that need mocking strategies
- MVP features with relaxed testing requirements (document the plan for full testing)

## Coverage
- Business logic — model operations, conversions, persistence, calculations — must
  have unit tests
- A user-facing feature gets an acceptance test when it has logic worth protecting,
  not because it is user-facing
- Components get no test for rendering, wiring, or flag-gating alone