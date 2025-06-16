/**
 * ErrorHandler.test.js
 * Unit tests for ErrorHandler class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../src/utils/ErrorHandler.js';

// Mock console methods
const mockConsole = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn()
};

// Mock document for event dispatching
const mockDocument = {
    dispatchEvent: vi.fn(),
    querySelector: vi.fn(),
    createElement: vi.fn(() => ({
        className: '',
        textContent: '',
        style: {},
        classList: {
            add: vi.fn(),
            remove: vi.fn()
        },
        appendChild: vi.fn(),
        parentNode: {
            removeChild: vi.fn()
        }
    })),
    body: {
        appendChild: vi.fn()
    }
};

// Mock window
const mockWindow = {
    app: {
        showToast: vi.fn()
    },
    location: {
        hostname: 'localhost',
        protocol: 'http:'
    }
};

// Setup global mocks
global.console = mockConsole;
global.document = mockDocument;
global.window = mockWindow;
global.CustomEvent = vi.fn().mockImplementation((type, options) => ({
    type,
    detail: options?.detail
}));
global.alert = vi.fn();
global.setTimeout = vi.fn((fn) => fn());

describe('ErrorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Error Categorization', () => {
        it('should categorize network errors', () => {
            const networkError = new Error('fetch failed');
            const errorInfo = ErrorHandler.categorizeError(networkError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.NETWORK);
            expect(errorInfo.severity).toBe(ErrorHandler.Severity.MEDIUM);
            expect(errorInfo.userMessage).toContain('网络连接失败');
            expect(errorInfo.suggestions).toContain('检查网络连接');
        });

        it('should categorize timeout errors', () => {
            const timeoutError = new Error('Request timeout');
            timeoutError.name = 'TimeoutError';
            const errorInfo = ErrorHandler.categorizeError(timeoutError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.NETWORK);
            expect(errorInfo.userMessage).toContain('网络连接失败');
        });

        it('should categorize API errors', () => {
            const apiError = new Error('API key invalid - 401');
            const errorInfo = ErrorHandler.categorizeError(apiError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.API);
            expect(errorInfo.severity).toBe(ErrorHandler.Severity.HIGH);
            expect(errorInfo.userMessage).toContain('API密钥无效');
        });

        it('should categorize validation errors', () => {
            const validationError = new Error('Invalid input format');
            const errorInfo = ErrorHandler.categorizeError(validationError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.VALIDATION);
            expect(errorInfo.severity).toBe(ErrorHandler.Severity.LOW);
            expect(errorInfo.userMessage).toContain('输入数据格式不正确');
        });

        it('should categorize file system errors', () => {
            const fileError = new Error('File access denied');
            const errorInfo = ErrorHandler.categorizeError(fileError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.FILE_SYSTEM);
            expect(errorInfo.severity).toBe(ErrorHandler.Severity.MEDIUM);
            expect(errorInfo.userMessage).toContain('文件操作失败');
        });

        it('should categorize permission errors', () => {
            const permissionError = new Error('Permission denied');
            const errorInfo = ErrorHandler.categorizeError(permissionError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.PERMISSION);
            expect(errorInfo.severity).toBe(ErrorHandler.Severity.HIGH);
            expect(errorInfo.userMessage).toContain('权限不足');
        });

        it('should categorize user input errors', () => {
            const userError = new Error('User cancelled operation');
            const errorInfo = ErrorHandler.categorizeError(userError);

            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.USER_INPUT);
            expect(errorInfo.severity).toBe(ErrorHandler.Severity.LOW);
            expect(errorInfo.actionable).toBe(false);
        });

        it('should handle string errors', () => {
            const errorInfo = ErrorHandler.categorizeError('Simple error message');

            expect(errorInfo.message).toBe('Simple error message');
            expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN);
        });
    });

    describe('Error Handling', () => {
        it('should handle error with default options', () => {
            const error = new Error('Test error');
            const context = { component: 'TestComponent' };

            const errorInfo = ErrorHandler.handle(error, context);

            expect(errorInfo).toHaveProperty('id');
            expect(errorInfo).toHaveProperty('timestamp');
            expect(errorInfo.context).toEqual(context);
            expect(mockConsole.warn).toHaveBeenCalled();
            expect(mockDocument.dispatchEvent).toHaveBeenCalled();
        });

        it('should skip user feedback when requested', () => {
            const error = new Error('Test error');
            
            ErrorHandler.handle(error, {}, { showUserFeedback: false });

            // Should still log but not show user feedback
            expect(mockConsole.warn).toHaveBeenCalled();
        });

        it('should not show feedback for user input errors', () => {
            const userError = new Error('User cancelled');
            
            ErrorHandler.handle(userError);

            // Should log but not create toast
            expect(mockConsole.info).toHaveBeenCalled();
        });
    });

    describe('Logging', () => {
        it('should log errors with appropriate level', () => {
            const criticalError = new Error('Critical system failure');
            const errorInfo = {
                ...ErrorHandler.categorizeError(criticalError),
                severity: ErrorHandler.Severity.CRITICAL
            };

            ErrorHandler.logError(errorInfo, {});

            expect(mockConsole.error).toHaveBeenCalled();
        });

        it('should log warnings with appropriate level', () => {
            const warningError = new Error('Warning message');
            const errorInfo = {
                ...ErrorHandler.categorizeError(warningError),
                severity: ErrorHandler.Severity.MEDIUM
            };

            ErrorHandler.logError(errorInfo, {});

            expect(mockConsole.warn).toHaveBeenCalled();
        });

        it('should include stack trace in development', () => {
            const error = new Error('Test error');
            const errorInfo = ErrorHandler.categorizeError(error);
            errorInfo.stack = 'Stack trace here';

            ErrorHandler.logError(errorInfo, {});

            expect(mockConsole.error).toHaveBeenCalledWith(
                'Stack trace:',
                'Stack trace here'
            );
        });
    });

    describe('User Feedback', () => {
        it('should show toast for medium severity errors', () => {
            const errorInfo = {
                type: ErrorHandler.ErrorTypes.NETWORK,
                severity: ErrorHandler.Severity.MEDIUM,
                userMessage: 'Network error occurred'
            };

            ErrorHandler.showUserFeedback(errorInfo);

            expect(mockWindow.app.showToast).toHaveBeenCalledWith(
                'Network error occurred',
                'error'
            );
        });

        it('should create simple toast when no global toast system', () => {
            // Remove global toast system
            delete mockWindow.app.showToast;

            const errorInfo = {
                type: ErrorHandler.ErrorTypes.NETWORK,
                severity: ErrorHandler.Severity.MEDIUM,
                userMessage: 'Network error occurred'
            };

            ErrorHandler.showUserFeedback(errorInfo);

            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
            expect(mockDocument.body.appendChild).toHaveBeenCalled();
        });

        it('should show modal for critical errors', () => {
            const errorInfo = {
                type: ErrorHandler.ErrorTypes.SYSTEM,
                severity: ErrorHandler.Severity.CRITICAL,
                userMessage: 'Critical system error'
            };

            ErrorHandler.showUserFeedback(errorInfo, ErrorHandler.FeedbackType.MODAL);

            expect(global.alert).toHaveBeenCalledWith('Critical system error');
        });

        it('should show inline error when container exists', () => {
            const errorContainer = {
                innerHTML: ''
            };
            mockDocument.querySelector.mockReturnValue(errorContainer);

            const errorInfo = {
                type: ErrorHandler.ErrorTypes.VALIDATION,
                severity: ErrorHandler.Severity.LOW,
                userMessage: 'Validation failed',
                suggestions: ['Check input', 'Try again']
            };

            ErrorHandler.showUserFeedback(errorInfo, ErrorHandler.FeedbackType.INLINE);

            expect(errorContainer.innerHTML).toContain('Validation failed');
            expect(errorContainer.innerHTML).toContain('Check input');
        });
    });

    describe('Event Dispatching', () => {
        it('should dispatch error event', () => {
            const errorInfo = {
                id: 'test-error',
                type: ErrorHandler.ErrorTypes.NETWORK,
                message: 'Test error'
            };

            ErrorHandler.dispatchErrorEvent(errorInfo);

            expect(global.CustomEvent).toHaveBeenCalledWith('errorOccurred', {
                detail: errorInfo
            });
            expect(mockDocument.dispatchEvent).toHaveBeenCalled();
        });
    });

    describe('Utility Methods', () => {
        it('should generate unique error IDs', () => {
            const id1 = ErrorHandler.generateErrorId();
            const id2 = ErrorHandler.generateErrorId();

            expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should detect development environment', () => {
            expect(ErrorHandler.isDevelopment()).toBe(true);

            // Test production environment
            mockWindow.location.hostname = 'example.com';
            expect(ErrorHandler.isDevelopment()).toBe(false);
        });

        it('should format log messages correctly', () => {
            const errorInfo = {
                type: ErrorHandler.ErrorTypes.NETWORK,
                message: 'Test error'
            };
            const context = { component: 'TestComponent', action: 'test' };

            const formatted = ErrorHandler.formatLogMessage(errorInfo, context);

            expect(formatted).toBe('[NETWORK] Test error [component:TestComponent, action:test]');
        });

        it('should get appropriate log level for severity', () => {
            expect(ErrorHandler.getLogLevel(ErrorHandler.Severity.CRITICAL)).toBe('error');
            expect(ErrorHandler.getLogLevel(ErrorHandler.Severity.HIGH)).toBe('error');
            expect(ErrorHandler.getLogLevel(ErrorHandler.Severity.MEDIUM)).toBe('warn');
            expect(ErrorHandler.getLogLevel(ErrorHandler.Severity.LOW)).toBe('info');
        });

        it('should get appropriate feedback type for severity', () => {
            expect(ErrorHandler.getDefaultFeedbackType(ErrorHandler.Severity.CRITICAL))
                .toBe(ErrorHandler.FeedbackType.MODAL);
            expect(ErrorHandler.getDefaultFeedbackType(ErrorHandler.Severity.HIGH))
                .toBe(ErrorHandler.FeedbackType.TOAST);
            expect(ErrorHandler.getDefaultFeedbackType(ErrorHandler.Severity.LOW))
                .toBe(ErrorHandler.FeedbackType.INLINE);
        });
    });
});
