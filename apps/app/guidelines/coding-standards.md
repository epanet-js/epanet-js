# Coding Standards Guidelines

## Code Documentation Policy

### Comments
- **Do not add comments to code** - code should be self-documenting
- Comments are only acceptable when explaining complex business logic that cannot be made clear through naming
- Remove comments from your code unless absolutely necessary
- Use descriptive variable and function names instead of comments

### Terminal Communication
- Use terminal output for explanations, not code comments
- Explain your reasoning and approach in commit messages or PR descriptions

## Feature Flag Integration

### Always Consider Feature Flags
- **Always ask** if new changes should be conditioned with a feature flag
- Use the existing feature flag system: `@src/hooks/use-feature-flags.tsx`
- Follow feature flag naming patterns: `isXOn` for variables, `FLAG_X` for flag names

### Feature Flag Implementation
```typescript
// Always ask: Should this be behind a feature flag?
const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE");

if (isNewFeatureOn) {
  // New implementation
} else {
  // Existing implementation
}
```

## Code Organization

### Module Structure
- **Private functions at the bottom** by default
- Export public functions at the top or middle of the file
- Keep exported functions easily accessible
- Group related functionality together

```typescript
// Public exports first
export const publicFunction = () => { ... };
export const anotherPublicFunction = () => { ... };

// Private functions at bottom
const privateHelper = () => { ... };
const anotherHelper = () => { ... };
```

### Directory Structure
- **Avoid leaking library names** to project folders
- Use domain-specific folder names instead of library names
- Focus on business functionality rather than technical implementation

```bash
# Good: Domain-focused
src/user-management/
src/hydraulic-analysis/

# Avoid: Library-focused
src/mapbox-utils/
src/react-components/
```

## Asset Management

### Data Access Patterns
- **Avoid creating objects** when doing read operations on assets
- Use existing public methods to get asset information
- Don't access features from assets directly

```typescript
// Good: Use public methods
const junctionData = getJunctionProperties(junction);
const pipeLength = getPipeLength(pipe);

// Avoid: Direct asset access
const data = { ...asset.properties }; // Creates unnecessary object
```

### Performance Considerations
- Minimize object creation in read operations
- Use getters and public methods instead of object destructuring
- Cache expensive computations when appropriate

## Debug and Logging

### Console Logging Pattern
- **Prepend with "DEBUG"** in console.log statements
- This allows filtering console results effectively
- Use consistent DEBUG prefix across the application

```typescript
// Good: Filterable debug logs
console.log("DEBUG: Processing user data", userData);
console.log("DEBUG: Map layer updated", layerInfo);

// Avoid: Generic console logs
console.log("Processing data", data);
```

### Debug Mode Integration
```typescript
const isDebugOn = useFeatureFlag("FLAG_DEBUG");

if (isDebugOn) {
  console.log("DEBUG: Feature enabled", featureState);
}
```

## Code Quality Rules

### Naming Conventions
- Use descriptive names that explain purpose
- Avoid abbreviations unless widely understood
- Use consistent naming patterns across the codebase

### Function Design
- Keep functions focused on single responsibility
- Use pure functions where possible
- Avoid side effects in utility functions

### Import Organization
- Group imports logically (external libraries, internal modules, types)
- Use consistent import patterns
- Avoid circular dependencies

## Integration Guidelines

### Feature Flag Variables
- Use `isXOn` pattern consistently
- Make feature flag intention clear through naming
- Document flag purpose and expected lifecycle

### Asset Operations
- Use domain-specific terminology
- Avoid exposing internal data structures
- Provide clean public interfaces

### Error Handling
- Use DEBUG logging for error investigation
- Provide meaningful error messages
- Handle edge cases gracefully

## When to Override

### Comments Exception
- Complex mathematical algorithms that need explanation
- Business rule implementations that aren't obvious
- Workarounds for external library issues

### Object Creation Exception  
- When objects are required for external APIs
- When immutability is needed for state management
- When performance impact is negligible

### Debug Logging Exception
- Production error logging (without DEBUG prefix)
- User-facing notifications
- System monitoring and metrics

## Examples

### Good Code Pattern
```typescript
export const processHydraulicModel = (modelId: string) => {
  const isOptimizedProcessingOn = useFeatureFlag("FLAG_OPTIMIZED_PROCESSING");
  
  if (isOptimizedProcessingOn) {
    console.log("DEBUG: Using optimized processing", modelId);
    return processModelOptimized(modelId);
  }
  
  return processModelLegacy(modelId);
};

const processModelOptimized = (modelId: string) => { ... };
const processModelLegacy = (modelId: string) => { ... };
```

### Integration with Other Guidelines
- See [feature-flags.md](./feature-flags.md) for detailed feature flag patterns
- See [performance.md](./performance.md) for performance-related coding standards