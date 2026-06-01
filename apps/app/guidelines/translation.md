# Translation Guidelines

## Development Workflow with Feature Flags

### Feature Flag Development Phase

When implementing features behind feature flags, use **hardcoded English text** during initial development:

```typescript
const NewFeatureComponent = () => {
  const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE");
  
  if (!isNewFeatureOn) return null;
  
  return (
    <div>
      <h2>Water Quality Analysis</h2>  {/* Hardcoded English for UI validation */}
      <p>Configure your analysis parameters below.</p>
      <button>Run Analysis</button>
    </div>
  );
};
```

**Why Hardcode During Feature Flag Phase:**
- **UI Validation**: Verify text fits properly in different screen sizes
- **Layout Testing**: Ensure proper spacing and visual hierarchy
- **Rapid Development**: Focus on functionality without translation overhead
- **Design Iteration**: Easy to adjust copy during UI refinement

### Translation Key Application Phase

When explicitly asked to apply translation keys, update the English translation file and replace hardcoded text:

#### 1. Update English Translation File
Add new keys to `/public/locales/en/translation.json`:

```json
{
  "waterQualityAnalysis": {
    "title": "Water Quality Analysis",
    "description": "Configure your analysis parameters below.",
    "runButton": "Run Analysis"
  }
}
```

#### 2. Replace Hardcoded Text
```typescript
const NewFeatureComponent = () => {
  const translate = useTranslate();
  const isNewFeatureOn = useFeatureFlag("FLAG_NEW_FEATURE");
  
  if (!isNewFeatureOn) return null;
  
  return (
    <div>
      <h2>{translate("waterQualityAnalysis.title")}</h2>
      <p>{translate("waterQualityAnalysis.description")}</p>
      <button>{translate("waterQualityAnalysis.runButton")}</button>
    </div>
  );
};
```

#### 3. Automatic Multi-Language Support
- **Other languages are handled automatically** via external CDN
- **No manual updates needed** for non-English translations
- CDN serves translations from: `https://epanet-js.github.io/epanet-js-locales/`

## Translation System Integration

### Core Hooks

#### useTranslate()
Primary hook for text translation with interpolation support:

```typescript
const translate = useTranslate();

// Simple translation
const title = translate("junction");

// With interpolation variables
const message = translate("dropZone.supportedFormats", "INP, JSON");
// Uses: "Supported formats: {{1}}" -> "Supported formats: INP, JSON"
```

#### useLocale()
Manages locale state and i18n readiness:

```typescript
const { locale, setLocale, isI18nReady } = useLocale();

// Check if translations are ready before rendering
if (!isI18nReady) {
  return <Loading />;
}
```

### Translation Key Naming Conventions

Use nested structure for logical organization:

```json
{
  "assetTypes": {
    "junction": "Junction",
    "pipe": "Pipe",
    "reservoir": "Reservoir"
  },
  "dialogs": {
    "importWizard": {
      "title": "Import Network",
      "steps": {
        "selectFile": "Select File",
        "preview": "Preview Data"
      }
    }
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  }
}
```

## Number and Unit Localization

### Locale-Specific Number Formatting

Different locales use different decimal and group separators:

```typescript
// Defined in src/infra/i18n/locale.ts
const symbols = {
  es: { decimals: ",", groups: "." },  // 1.234,56
  en: { decimals: ".", groups: "," },  // 1,234.56
  pt: { decimals: ",", groups: "." },  // 1.234,56
  fr: { decimals: ",", groups: "" },   // 1234,56
};
```

### Parsing Localized Numbers

Use `parseLocaleNumber()` for user input:

```typescript
import { parseLocaleNumber } from "src/infra/i18n/locale-number";

const handleElevationChange = (inputValue: string) => {
  const numericValue = parseLocaleNumber(inputValue);
  if (!isNaN(numericValue)) {
    junction.setElevation(numericValue);
  }
};
```

### Unit Translation and Display

Use `useTranslateUnit()` for proper unit display:

```typescript
const translateUnit = useTranslateUnit();

// Formats units properly: ft^3 -> ft³
const displayUnit = translateUnit("ft^3"); // Returns "ft³"
const displayText = `${value} ${displayUnit}`;
```

**Unit Translation Examples:**
- `"ft^3"` → `"ft³"` (proper superscript)
- `"m^3/h"` → `"m³/h"` (cubic meters per hour)
- `"gal/min"` → `"gal/min"` (gallons per minute)

## Testing Translation Features

### Feature Flag State Testing

Test both hardcoded and translated states:

```typescript
describe("New Feature Component", () => {
  describe("with feature flag enabled", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_NEW_FEATURE");
    });

    it("shows hardcoded text during development", () => {
      render(<NewFeatureComponent />);
      expect(screen.getByText("Water Quality Analysis")).toBeInTheDocument();
    });

    it("shows translated text when keys applied", () => {
      // After translation keys are applied
      render(<NewFeatureComponent />);
      expect(screen.getByText(translate("waterQualityAnalysis.title"))).toBeInTheDocument();
    });
  });
});
```

### Locale-Specific Testing

Test number formatting across different locales:

```typescript
describe("Number formatting", () => {
  it("formats numbers for Spanish locale", () => {
    const formatted = parseLocaleNumber("1.234,56", "es");
    expect(formatted).toBe(1234.56);
  });

  it("formats numbers for English locale", () => {
    const formatted = parseLocaleNumber("1,234.56", "en");
    expect(formatted).toBe(1234.56);
  });
});
```

### Unit Display Testing

```typescript
describe("Unit translation", () => {
  it("formats cubic units with proper superscript", () => {
    const translateUnit = useTranslateUnit();
    expect(translateUnit("ft^3")).toBe("ft³");
    expect(translateUnit("m^3/h")).toBe("m³/h");
  });
});
```

## Best Practices

### When to Use Hardcoded Text

**✅ Appropriate for hardcoded text:**
- Features behind feature flags during development
- Debug/development tools not user-facing
- Internal error messages during development phase
- Prototype components being validated

**❌ Avoid hardcoded text for:**
- Production features without feature flags
- User-facing error messages
- Asset labels and property names
- Help text and instructions

### Performance Considerations

#### Efficient Translation Loading

```typescript
// Good: Check i18n readiness before rendering
const MyComponent = () => {
  const { isI18nReady } = useLocale();
  const translate = useTranslate();
  
  if (!isI18nReady) {
    return <Skeleton />; // Show loading state
  }
  
  return <div>{translate("myComponent.title")}</div>;
};
```

#### Avoid Translation in Loops

```typescript
// ❌ Bad: Translation in render loop
const AssetList = ({ assets }) => {
  const translate = useTranslate();
  return assets.map(asset => (
    <div key={asset.id}>
      {translate(`assetTypes.${asset.type}`)} {/* Called for each asset */}
    </div>
  ));
};

// ✅ Good: Pre-translate or use memoization
const AssetList = ({ assets }) => {
  const translate = useTranslate();
  const assetTypeTranslations = useMemo(() => ({
    junction: translate("assetTypes.junction"),
    pipe: translate("assetTypes.pipe"),
    reservoir: translate("assetTypes.reservoir"),
  }), [translate]);
  
  return assets.map(asset => (
    <div key={asset.id}>
      {assetTypeTranslations[asset.type]}
    </div>
  ));
};
```

### Integration with Feature Flags

Follow the established feature flag patterns when implementing translations:

```typescript
const FeatureWithTranslations = () => {
  const isNewUIOn = useFeatureFlag("FLAG_NEW_UI");
  const translate = useTranslate();
  
  if (isNewUIOn) {
    // During development: hardcoded text
    return <div>New Interface Design</div>;
    
    // After translation keys applied:
    // return <div>{translate("newInterface.title")}</div>;
  }
  
  return <div>{translate("oldInterface.title")}</div>;
};
```

### Locale Integration

Remember to get locale from user object for consistent experience:

```typescript
const UserPreferenceComponent = () => {
  const { locale } = useLocale();
  const translateUnit = useTranslateUnit();
  
  // Use locale for consistent formatting
  const formattedValue = formatNumberForLocale(value, locale);
  const unitDisplay = translateUnit(unit);
  
  return <span>{formattedValue} {unitDisplay}</span>;
};
```

## Development Workflow Summary

### Phase 1: Feature Flag Development
1. Implement feature with hardcoded English text
2. Validate UI, layout, and functionality
3. Test feature flag enabled/disabled states
4. Focus on feature completeness

### Phase 2: Translation Key Application (When Explicitly Requested)
1. Add translation keys to `/public/locales/en/translation.json`
2. Replace hardcoded text with `translate()` calls
3. Test translation key resolution
4. Verify other languages load automatically from CDN

### Phase 3: Localization Validation
1. Test number formatting across locales
2. Validate unit display formatting
3. Ensure proper decimal/group separator handling
4. Test locale switching functionality

## When to Override

### Skip Translation Workflow
- Simple bug fixes not introducing new text
- Internal development tools
- Debug logging and error tracking
- Temporary prototype components

### Accelerated Translation Timeline
- Critical user-facing features
- Accessibility compliance requirements
- Features targeting specific international markets
- Components with minimal text content

## Integration with Other Guidelines

- See [feature-flags.md](./feature-flags.md) for feature flag implementation patterns
- See [react-guidelines.md](./react-guidelines.md) for component integration patterns
- See [ux-patterns.md](./ux-patterns.md) for user interface consistency

This translation system ensures consistent internationalization while supporting rapid development through feature flags and maintaining performance with large-scale localization needs.