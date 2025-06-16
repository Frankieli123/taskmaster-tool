# Contributing to TaskMaster UI Configuration Tool

## Overview

This document outlines the coding standards, development workflow, and contribution guidelines specifically for the TaskMaster UI Configuration Tool.

## Development Environment Setup

### Prerequisites
- Node.js >= 18.0.0
- npm package manager
- Modern browser with File System Access API support

### Initial Setup
```bash
cd ui-config-tool
npm install
npm run dev
```

## Code Quality Standards

### ESLint Configuration
We use ESLint with Airbnb base configuration:
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line length**: Maximum 120 characters

### Prettier Configuration
Automatic code formatting:
- **Print width**: 120 characters
- **Tab width**: 2 spaces
- **Single quotes**: Enabled
- **Trailing commas**: None

### Running Quality Checks
```bash
npm run lint          # Check for linting issues
npm run lint:fix      # Fix linting issues
npm run format        # Format code
npm run format:check  # Check formatting
npm run quality       # Run all quality checks
```

## Testing Standards

### Testing Framework
We use Vitest with jsdom environment:
- **Coverage target**: 80% minimum
- **Test files**: `*.test.js` or `*.spec.js`
- **Environment**: jsdom for DOM testing

### Running Tests
```bash
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Run with coverage report
npm run test:ui       # Run with UI interface
```

### Test Structure
```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should perform expected behavior', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Architecture Guidelines

### Module Structure
- **Components**: `src/components/` - UI components
- **Utils**: `src/utils/` - Utility functions and classes
- **Styles**: `src/styles/` - CSS stylesheets
- **Tests**: `tests/` - Test files

### Naming Conventions
- **Files**: camelCase (e.g., `configManager.js`)
- **Classes**: PascalCase (e.g., `ConfigManager`)
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS Classes**: kebab-case

### DOM Manipulation
- Use modern DOM APIs
- Cache DOM references when possible
- Use event delegation for dynamic content
- Avoid inline event handlers

### Async Operations
- Use async/await syntax
- Handle loading states appropriately
- Implement proper error boundaries
- Use AbortController for cancellable requests

## Security Guidelines

### Input Validation
- Validate all user inputs
- Sanitize data before DOM insertion
- Use proper encoding for different contexts
- Validate API responses

### File System Access
- Validate file types and sizes
- Handle file access errors gracefully
- Respect user privacy and permissions
- Use secure file handling practices

## Performance Considerations

- Minimize DOM queries
- Use requestAnimationFrame for animations
- Implement debouncing for frequent events
- Lazy load non-critical resources
- Optimize large configuration handling

## Browser Compatibility

### Supported Browsers
- Chrome 86+ (File System Access API)
- Edge 86+
- Firefox with fallback to download
- Safari with fallback to download

### Feature Detection
Always check for API availability:
```javascript
if ('showDirectoryPicker' in window) {
  // Use File System Access API
} else {
  // Use fallback method
}
```

## Error Handling

### Error Categories
- **User Errors**: Invalid input, file format issues
- **System Errors**: API failures, permission issues
- **Network Errors**: Connection problems, timeouts

### Error Handling Pattern
```javascript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

## UI/UX Guidelines

### User Feedback
- Show loading states for async operations
- Provide clear error messages
- Use toast notifications for status updates
- Implement progress indicators for long operations

### Accessibility
- Use semantic HTML elements
- Provide proper ARIA labels
- Ensure keyboard navigation
- Maintain color contrast ratios

### Responsive Design
- Support desktop and tablet viewports
- Use flexible layouts
- Test on different screen sizes
- Optimize for touch interactions

## Git Workflow

### Branch Naming
- **Feature**: `feature/ui-tool-description`
- **Bug Fix**: `fix/ui-tool-description`
- **Review**: `review/ui-tool-description`

### Commit Messages
Follow conventional commit format:
```
type(ui-tool): description

feat(ui-tool): add provider validation
fix(ui-tool): resolve file save issue
docs(ui-tool): update API documentation
```

## Review Checklist

### Before Submitting PR
- [ ] All tests pass
- [ ] Code coverage >= 80%
- [ ] No ESLint errors
- [ ] Prettier formatting applied
- [ ] Manual testing completed
- [ ] Browser compatibility verified
- [ ] Documentation updated

### Code Review Focus
- Code quality and maintainability
- Test coverage and quality
- User experience and accessibility
- Performance implications
- Security considerations
- Browser compatibility

## Documentation Requirements

### Code Documentation
- JSDoc comments for all public functions
- Inline comments for complex logic
- README updates for new features
- API documentation for utilities

### User Documentation
- Update user guides for new features
- Include screenshots for UI changes
- Document configuration options
- Provide troubleshooting guides

## Getting Help

- Check existing documentation
- Search closed issues
- Create detailed issue reports
- Ask questions in team channels

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.
