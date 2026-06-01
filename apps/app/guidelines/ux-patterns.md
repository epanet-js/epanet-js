# UX Patterns Guidelines

## Standard UX Patterns

### User Interface Components
- Use existing components from `src/components/`
- Follow established dialog patterns in `src/components/dialogs/`
- Maintain consistency with existing form patterns
- Use existing icon system from `src/components/icons/`

### Interaction Patterns
- Keyboard shortcuts using existing hotkey system
- Context menus for right-click actions
- Modal dialogs for complex operations
- Inline editing for simple property changes

### Visual Consistency
- Style with the semantic theme tokens documented in the `src/styles` module.
  Avoid raw `gray-*` / `dark:gray-*` utilities; the tokens handle light/dark
  automatically.
- Maintain existing spacing and layout patterns
- Respect existing responsive design patterns

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- Focus management for modals and dialogs
- Color contrast compliance

### User Feedback
- Loading states for async operations
- Error messages with clear action steps
- Success confirmations for important actions
- Progress indicators for long operations

### Localization
- Use existing i18n system
- Get locale from user object for implementations
- Support existing language patterns
- Consider cultural differences in UX patterns

## Map-Specific UX Patterns
- Follow existing map interaction patterns
- Maintain consistency with drawing modes
- Use established selection and editing patterns
- Respect existing zoom and pan behaviors

## When to Override
- Specialized workflows requiring custom patterns
- Advanced users needing power-user interfaces
- Complex data visualization requiring custom interactions
- Accessibility requirements needing specialized solutions
- Mobile-specific interactions differing from desktop patterns

## Implementation Notes
- Test interactions across different devices
- Consider keyboard-only users
- Validate with existing user workflows
- Maintain performance during interactions