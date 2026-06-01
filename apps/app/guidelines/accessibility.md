# Accessibility Guidelines

## Standard Accessibility Requirements

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Implement proper tab order and focus management
- Provide keyboard shortcuts for common actions
- Use existing hotkey system patterns

### Screen Reader Support
- Implement proper ARIA labels and descriptions
- Use semantic HTML elements
- Provide alternative text for images and icons
- Ensure proper heading structure

### Visual Accessibility
- Maintain sufficient color contrast (WCAG AA compliance)
- Don't rely solely on color to convey information
- Support browser zoom up to 200%
- Provide focus indicators for keyboard users

### Motor Accessibility
- Ensure click targets are at least 44x44px
- Provide sufficient spacing between interactive elements
- Support various input methods
- Avoid time-limited interactions

### Cognitive Accessibility
- Use clear, simple language
- Provide consistent navigation patterns
- Offer help and error recovery options
- Avoid auto-playing content

### Map Accessibility
- Provide alternative text descriptions for map content
- Implement keyboard navigation for map interactions
- Offer high contrast mode for map visualizations
- Support screen reader announcements for map changes

## Implementation Standards
- Test with keyboard-only navigation
- Validate with screen reader tools
- Use axe-core for automated testing
- Follow existing accessibility patterns in codebase

## Required Testing
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Color contrast validation
- Automated accessibility scanning

## When to Override
- Complex data visualizations requiring specialized accessibility approaches
- Map interactions with custom accessibility implementations
- Advanced user interfaces with power-user considerations
- Features with external accessibility constraints
- Prototype features with planned accessibility improvements

## Tools and Resources
- Use existing component accessibility patterns
- Leverage browser accessibility DevTools
- Implement proper focus management
- Follow ARIA authoring practices guidelines