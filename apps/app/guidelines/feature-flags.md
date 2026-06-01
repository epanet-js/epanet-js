# Feature Flags Guidelines

## Implementation Strategy by Risk Level

### High-Risk/Complex Changes
When implementing features that could affect rendering order, core system behavior, or have complex interdependencies, use **function duplication** to minimize risk:

```typescript
// Instead of conditional logic within existing function
const doUpdates = isNewFeatureOn ? doUpdatesNew : doUpdatesDeprecated;

// Or duplicate entire functions
const processMapUpdates = (data: MapData) => {
  const isSelectiveLoaderOn = useFeatureFlag("FLAG_SELECTIVE_MAP_LOADER");
  
  if (isSelectiveLoaderOn) {
    return processMapUpdatesNew(data);
  }
  
  return processMapUpdatesDeprecated(data);
};
```

**Use this approach when:**
- Changes affect rendering order or timing
- Complex state management modifications
- Core algorithm changes
- Multiple interdependent components affected

### Low-Risk/Simple Changes
For small, isolated modifications, simple conditionals are sufficient:

```typescript
const MyComponent = () => {
  const isDebugOn = useFeatureFlag("FLAG_DEBUG_HISTOGRAM");
  
  return (
    <div>
      {isDebugOn && <DebugPanel />}
      <MainContent />
    </div>
  );
};
```

**Use this approach when:**
- Adding optional UI elements
- Toggling simple behaviors
- Debug/development features
- Non-critical feature additions

## Standard Implementation Pattern

### Hook Usage
```typescript
const isFeatureOn = useFeatureFlag("FLAG_FEATURE_NAME");
```

### Variable Naming Convention
- Use `isXOn` pattern for feature flag variables
- Example: `isDarkModeOn`, `isAdvancedFiltersOn`, `isUserPreferencesOn`

### Flag Naming Convention
- Prefix with `FLAG_` for URL parameters
- Use SCREAMING_SNAKE_CASE: `FLAG_USER_PREFERENCES`, `FLAG_DARK_MODE`

### Integration Points
- Use with existing `@src/hooks/use-feature-flags.tsx`
- Conditional rendering in components
- Conditional logic in business operations

### Default Behavior
- New features should be behind flags by default
- Feature flags should have sensible fallback behavior
- Consider progressive rollout strategy

## When to Override
- Simple bug fixes that don't introduce new UI
- Critical security patches
- Internal development tools
- Features that are too small to warrant a flag

## Implementation Example
Real examples from the codebase:

```typescript
// Map rendering optimization
const isSelectiveLoaderOn = useFeatureFlag("FLAG_SELECTIVE_MAP_LOADER");

return (
  <div>
    {isSelectiveLoaderOn ? <OptimizedMapLoader /> : <StandardMapLoader />}
  </div>
);
```

```typescript
// Platform-specific shortcuts
const isMacOn = useFeatureFlag("FLAG_MAC");
const keyboardShortcuts = isMacOn ? macShortcuts : windowsShortcuts;

return <ShortcutDisplay shortcuts={keyboardShortcuts} />;
```

```typescript
// Debug visualization
const isDebugHistogramOn = useFeatureFlag("FLAG_DEBUG_HISTOGRAM");

return (
  <div>
    <MainChart data={chartData} />
    {isDebugHistogramOn && <DebugHistogram data={chartData} />}
  </div>
);
```

## Testing Guidelines

### Testing Feature Flags with Helpers
Use `src/__helpers__/feature-flags.ts` for consistent test setup:

```typescript
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";

describe("MyComponent with feature flag", () => {
  it("shows new feature when flag enabled", () => {
    stubFeatureOn("FLAG_NEW_FEATURE");
    
    render(<MyComponent />);
    expect(screen.getByText("New Feature")).toBeInTheDocument();
  });

  it("shows legacy behavior when flag disabled", () => {
    stubFeatureOff("FLAG_NEW_FEATURE");
    
    render(<MyComponent />);
    expect(screen.getByText("Legacy Feature")).toBeInTheDocument();
  });
});
```

### Testing Both States
Always test both enabled and disabled states:

```typescript
describe.each([
  { flagState: "enabled", expectation: "new behavior" },
  { flagState: "disabled", expectation: "legacy behavior" }
])("FLAG_CLEAR_SELECT $flagState", ({ flagState, expectation }) => {
  beforeEach(() => {
    if (flagState === "enabled") {
      stubFeatureOn("FLAG_CLEAR_SELECT");
    } else {
      stubFeatureOff("FLAG_CLEAR_SELECT");
    }
  });

  it(`should ${expectation}`, () => {
    // Test implementation
  });
});
```

### Test Organization
- Group flag-related tests in separate describe blocks
- Use descriptive test names that include flag states
- Test error boundaries and edge cases for both states

## Advanced Implementation Patterns

### Multiple Flag Dependencies
Handle complex flag combinations:

```typescript
const useMapFeatures = () => {
  const isSelectiveLoaderOn = useFeatureFlag("FLAG_SELECTIVE_MAP_LOADER");
  const isMapClickFixOn = useFeatureFlag("FLAG_MAP_CLICK_FIX");
  const isMacOn = useFeatureFlag("FLAG_MAC");

  const shouldUseAdvancedMap = isSelectiveLoaderOn && isMapClickFixOn;
  const keyboardShortcuts = isMacOn ? macShortcuts : windowsShortcuts;

  return { shouldUseAdvancedMap, keyboardShortcuts };
};
```

### Feature Flag Composition
Create composite flags for related features:

```typescript
const useUIFeatures = () => {
  const isDebugOn = useFeatureFlag("FLAG_DEBUG_HISTOGRAM");
  const isSkipValidationOn = useFeatureFlag("FLAG_SKIP_LAYER_VALIDATION");
  
  const isDeveloperMode = isDebugOn || isSkipValidationOn;
  
  return { isDebugOn, isSkipValidationOn, isDeveloperMode };
};
```

### Gradual Rollout Patterns
Support percentage-based rollouts:

```typescript
const useGradualFeature = (flagName: string, userId?: string) => {
  const baseFlag = useFeatureFlag(flagName);
  const percentageFlag = useFeatureFlag(`${flagName}_PERCENTAGE`);
  
  if (baseFlag) return true;
  if (!percentageFlag || !userId) return false;
  
  // Simple hash-based percentage rollout
  const hash = hashUserId(userId);
  return hash % 100 < getPercentage(flagName);
};
```

### Feature Flag Lifecycle Management
Document flag progression through lifecycle:

```typescript
// 1. Introduction (0% rollout)
const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE"); // false by default

// 2. Testing (development/staging only)
const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE"); // true via URL params

// 3. Gradual rollout (10%, 50%, 100%)
const isNewFeatureOn = useGradualFeature("FLAG_NEW_FEATURE", user.id);

// 4. Full rollout (remove flag)
// Replace with direct implementation, remove flag entirely
```

## Integration with External Systems

### PostHog Integration
The codebase uses PostHog for production feature flag management:

```typescript
// Automatic PostHog integration when configured
const isFeatureOn = useFeatureFlag("FLAG_FEATURE_NAME");
// Checks PostHog first, falls back to URL parameters
```

**Configuration:**
- PostHog flags take precedence over URL parameters
- Flags are cached and updated via `onFeatureFlags` callback
- Error tracking integration via `setFlagsContext()`

### URL Parameter Override
Enable flags for local development and testing:

```
# Development URL examples
http://localhost:3000?FLAG_SELECTIVE_MAP_LOADER=true
http://localhost:3000?FLAG_DEBUG_HISTOGRAM=true&FLAG_SKIP_LAYER_VALIDATION=true
```

**URL Parameter Rules:**
- Must start with `FLAG_` prefix
- Value must be exactly `"true"` (case-insensitive)
- Only works when PostHog is not configured
- Useful for local development and staging environments

### Environment Configuration
Use `.env` files for default flag states:

```bash
# .env.example
FLAG_SWOT=true
FLAG_SELECTIVE_MAP_LOADER=false
```

### Local vs Production Behavior
```typescript
// Development: URL parameters override
const isDebugOn = useFeatureFlag("FLAG_DEBUG"); // ?FLAG_DEBUG=true

// Production: PostHog controls flags
const isDebugOn = useFeatureFlag("FLAG_DEBUG"); // PostHog value
```

## Performance and Best Practices

### Avoid Flag Checks in Render Loops
Don't call `useFeatureFlag` inside expensive computations:

```typescript
// ❌ Bad: Flag check in expensive render loop
const ExpensiveComponent = ({ items }) => {
  return items.map(item => {
    const isNewRendererOn = useFeatureFlag("FLAG_NEW_RENDERER"); // Called for each item
    return isNewRendererOn ? <NewItem key={item.id} /> : <OldItem key={item.id} />;
  });
};

// ✅ Good: Flag check once at component level
const ExpensiveComponent = ({ items }) => {
  const isNewRendererOn = useFeatureFlag("FLAG_NEW_RENDERER");
  const ItemComponent = isNewRendererOn ? NewItem : OldItem;
  
  return items.map(item => <ItemComponent key={item.id} {...item} />);
};
```

### Memoization for Expensive Flag Evaluations
Use useMemo for complex flag logic:

```typescript
const useComplexFeature = () => {
  const flag1 = useFeatureFlag("FLAG_ONE");
  const flag2 = useFeatureFlag("FLAG_TWO");
  const flag3 = useFeatureFlag("FLAG_THREE");
  
  const complexFeatureState = useMemo(() => {
    return calculateComplexState(flag1, flag2, flag3);
  }, [flag1, flag2, flag3]);
  
  return complexFeatureState;
};
```

### Bundle Size Considerations
Use dynamic imports for flag-gated features:

```typescript
const LazyFeatureComponent = () => {
  const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE");
  
  if (!isNewFeatureOn) return <LegacyComponent />;
  
  // Dynamic import reduces bundle size when flag is off
  const NewFeatureComponent = lazy(() => import("./NewFeatureComponent"));
  return <Suspense fallback={<Loading />}><NewFeatureComponent /></Suspense>;
};
```

### Debug Logging Best Practices
Use DEBUG prefix for filterable console output:

```typescript
const MyComponent = () => {
  const isDebugOn = useFeatureFlag("FLAG_DEBUG_HISTOGRAM");
  
  useEffect(() => {
    if (isDebugOn) {
      console.log("DEBUG: Histogram feature enabled", histogramData);
      console.log("DEBUG: Processing", histogramData.length, "data points");
    }
  }, [isDebugOn, histogramData]);
};
```

### Conditional Hook Rules
Follow React hook rules even with feature flags:

```typescript
// ❌ Bad: Conditional hooks
const MyComponent = () => {
  const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE");
  
  if (isNewFeatureOn) {
    const data = useNewFeatureData(); // Conditional hook usage
  }
};

// ✅ Good: Always call hooks
const MyComponent = () => {
  const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE");
  const newFeatureData = useNewFeatureData(); // Always called
  
  const data = isNewFeatureOn ? newFeatureData : null;
};
```

## Team Workflow Guidelines

### Code Review Checklist
When reviewing feature flag PRs:

- [ ] Flag follows `FLAG_` naming convention
- [ ] Variable uses `isXOn` pattern  
- [ ] Both enabled/disabled states are tested
- [ ] Documentation explains flag purpose and timeline
- [ ] Risk level assessment matches implementation approach
- [ ] No conditional hook usage violations

### Documentation Requirements
For each new feature flag, document:

```markdown
## FLAG_NEW_FEATURE
- **Purpose**: Brief description of what this enables
- **Timeline**: Target dates for testing, rollout, removal
- **Risk Level**: High/Low (affects implementation strategy)
- **Dependencies**: Related flags or systems
- **Rollback Plan**: How to disable if issues arise
```

### Flag Lifecycle Management
1. **Introduction**: Add flag (default: off)
2. **Development**: Enable via URL params for testing
3. **Staging**: Test both states extensively
4. **Production**: Gradual rollout via PostHog
5. **Cleanup**: Remove flag and legacy code paths

### Communication Protocols
- Announce new flags in team channels
- Document flag changes in release notes
- Set calendar reminders for flag cleanup
- Coordinate flag removals with QA cycles

## Troubleshooting

### Common Issues

**Flag not updating in development:**
- Check URL parameter format: `?FLAG_NAME=true`
- Verify PostHog is not configured locally
- Clear browser cache and reload

**Tests failing intermittently:**
- Ensure `stubFeatureOn/Off` is called in `beforeEach`
- Check for test isolation issues
- Verify mocks are properly reset

**Production flag not taking effect:**
- Verify PostHog configuration
- Check flag name matches exactly (case-sensitive)
- Confirm flag is enabled in PostHog dashboard

### Debugging Flag States
```typescript
// Temporary debug logging
useEffect(() => {
  console.log("DEBUG: Flag states", {
    flagName: "FLAG_MY_FEATURE",
    isEnabled: useFeatureFlag("FLAG_MY_FEATURE"),
    isPosthogConfigured,
    urlFlags: getEnabledFlagsFromUrl()
  });
}, []);
```

### SSR/Hydration Considerations
- Flags may differ between server and client
- Use `useEffect` for flag-dependent state changes
- Consider using `FeatureFlagsProvider` key prop for re-renders