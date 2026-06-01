# React Guidelines

## Effect Management

### Avoid useEffect When Possible
- **Prefer callbacks** over useEffect for user-initiated actions
- Use direct state updates in event handlers instead of effects
- Reserve useEffect for actual side effects, not state synchronization

### User Action Pattern
When handling user actions, use callbacks to set atoms and handle side effects:

```typescript
// Good: Direct callback for user action
const handleUserAction = useCallback((data: UserData) => {
  // Set the atom directly
  setUserDataAtom(data);
  
  // Handle side effects in the same callback
  trackUserAction('data_updated', data);
  notifyUserSuccess('Data saved successfully');
}, []);

return <Button onClick={handleUserAction}>Save</Button>;
```

### When to Use useEffect
useEffect should be reserved for:
- Data fetching on component mount
- Subscription management
- Cleanup operations
- Responding to prop changes that aren't user actions

```typescript
// Appropriate useEffect usage
useEffect(() => {
  const subscription = subscribeToModelUpdates((update) => {
    setModelState(update);
  });
  
  return () => subscription.unsubscribe();
}, []);
```

## State Management Patterns

### Atom-Based Architecture
- Use Jotai atoms for state management
- Keep atoms focused and granular
- Combine atoms using derived state rather than large compound atoms

```typescript
// Good: Focused atoms
const userPreferencesAtom = atom(defaultPreferences);
const currentModelAtom = atom(null);

// Derived state
const isModelLoadedAtom = atom(
  (get) => get(currentModelAtom) !== null
);
```

### Callback Optimization
- Use useCallback for event handlers that trigger state changes
- Include necessary dependencies in dependency arrays
- Avoid recreating callbacks on every render

```typescript
const handleModelUpdate = useCallback((updates: ModelUpdate) => {
  setModelAtom((prev) => ({ ...prev, ...updates }));
  
  // Side effects handled in same callback
  if (updates.hasUnsavedChanges) {
    setUnsavedChangesAtom(true);
  }
}, [setModelAtom, setUnsavedChangesAtom]);
```

## Component Patterns

### Event Handler Organization
- Keep event handlers close to where they're used
- Use descriptive names that indicate the user action
- Handle both immediate state updates and side effects in the same handler

```typescript
const ModelEditor = () => {
  const handleSaveModel = useCallback(async (modelData: ModelData) => {
    // Update state immediately
    setCurrentModelAtom(modelData);
    setSavingAtom(true);
    
    try {
      // Handle side effects
      await saveModelToServer(modelData);
      setUnsavedChangesAtom(false);
      showSuccessMessage('Model saved');
    } catch (error) {
      showErrorMessage('Failed to save model');
    } finally {
      setSavingAtom(false);
    }
  }, []);

  return <SaveButton onClick={handleSaveModel} />;
};
```

### State Synchronization
Instead of useEffect for state synchronization, use derived atoms:

```typescript
// Good: Derived atom
const canSaveModelAtom = atom((get) => {
  const hasChanges = get(unsavedChangesAtom);
  const isValid = get(modelValidationAtom);
  return hasChanges && isValid;
});

// Avoid: useEffect for synchronization
const [canSave, setCanSave] = useState(false);
useEffect(() => {
  setCanSave(hasUnsavedChanges && isModelValid);
}, [hasUnsavedChanges, isModelValid]);
```

## Integration with Feature Flags

### Feature Flag with State Management
```typescript
const ModelComponent = () => {
  const isNewEditorOn = useFeatureFlag("FLAG_NEW_EDITOR");
  const [modelData, setModelData] = useAtom(modelAtom);
  
  const handleEdit = useCallback((changes: ModelChanges) => {
    if (isNewEditorOn) {
      setModelData(processChangesNew(changes));
    } else {
      setModelData(processChangesLegacy(changes));
    }
  }, [isNewEditorOn, setModelData]);
  
  return isNewEditorOn ? 
    <NewModelEditor onEdit={handleEdit} /> : 
    <LegacyModelEditor onEdit={handleEdit} />;
};
```

## Performance Considerations

### Avoid Unnecessary Renders
- Use React.memo for components that receive complex props
- Memoize expensive calculations with useMemo
- Use useCallback for functions passed as props

### Efficient State Updates
- Batch related state updates when possible
- Use functional updates for dependent state changes
- Avoid creating objects in render functions

```typescript
// Good: Efficient updates
const handleComplexUpdate = useCallback((updates: ComplexUpdate) => {
  // Batch related updates
  setModelAtom((prev) => ({
    ...prev,
    ...updates.modelChanges,
  }));
  
  setValidationAtom(validateModel(updates));
  setLastModifiedAtom(Date.now());
}, []);
```

## Common Anti-Patterns to Avoid

### useEffect Overuse
```typescript
// Anti-pattern: useEffect for user actions
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  if (userClickedSave) {
    setIsLoading(true);
    saveData(data).then(() => {
      setIsLoading(false);
    });
  }
}, [userClickedSave, data]);

// Better: Direct callback
const handleSave = useCallback(async () => {
  setIsLoading(true);
  try {
    await saveData(data);
  } finally {
    setIsLoading(false);
  }
}, [data]);
```

### State Synchronization Effects
```typescript
// Anti-pattern: Synchronizing state in useEffect
useEffect(() => {
  setDerivedState(computeFromPrimary(primaryState));
}, [primaryState]);

// Better: Use derived atoms or useMemo
const derivedState = useMemo(() => 
  computeFromPrimary(primaryState), [primaryState]);
```

## Integration with Other Systems

### Map Interactions
When handling map interactions, use callbacks rather than effects:

```typescript
const MapComponent = () => {
  const handleMapClick = useCallback((coordinates: Coordinates) => {
    // Update selected location atom
    setSelectedLocationAtom(coordinates);
    
    // Handle side effects in same callback
    trackMapInteraction('click', coordinates);
    updateMapFocus(coordinates);
  }, []);
  
  return <Map onClick={handleMapClick} />;
};
```

### Form Handling
```typescript
const ModelForm = () => {
  const handleFormSubmit = useCallback((formData: FormData) => {
    // Validate and update state immediately
    const validatedData = validateFormData(formData);
    setModelAtom(validatedData);
    
    // Handle success side effects
    showSuccessMessage('Model updated');
    navigateToNextStep();
  }, []);
  
  return <Form onSubmit={handleFormSubmit} />;
};
```

## Testing React Components

### Testing User Interactions
- Test the callback behavior, not useEffect timing
- Use user events to trigger state changes
- Assert on final state, not intermediate states

```typescript
test('saves model when user clicks save', async () => {
  render(<ModelEditor />);
  
  await user.click(screen.getByRole('button', { name: 'Save' }));
  
  expect(mockSaveModel).toHaveBeenCalledWith(expectedModelData);
  expect(screen.getByText('Model saved')).toBeInTheDocument();
});
```

## Integration with Other Guidelines
- See [feature-flags.md](./feature-flags.md) for feature flag patterns in React
- See [testing.md](./testing.md) for React component testing patterns
- See [performance.md](./performance.md) for React performance optimization