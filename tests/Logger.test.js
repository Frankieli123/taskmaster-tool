/**
 * Logger.test.js
 * Unit tests for Logger class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from '../src/utils/Logger.js';

// Mock console methods
const mockConsole = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn()
};

// Mock document for event dispatching
const mockDocument = {
    dispatchEvent: vi.fn()
};

// Mock localStorage
const mockLocalStorage = {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
};

// Mock navigator
const mockNavigator = {
    userAgent: 'Test User Agent'
};

// Mock window
const mockWindow = {
    location: {
        href: 'http://localhost:3000/test',
        hostname: 'localhost'
    }
};

// Setup global mocks
global.console = mockConsole;
global.document = mockDocument;
global.localStorage = mockLocalStorage;
global.navigator = mockNavigator;
global.window = mockWindow;
global.CustomEvent = vi.fn().mockImplementation((type, options) => ({
    type,
    detail: options?.detail
}));

describe('Logger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Logger state
        Logger.logs = [];
        Logger.config = {
            level: Logger.Levels.INFO,
            enableConsole: true,
            enableStorage: false,
            maxStorageEntries: 1000,
            timestampFormat: 'ISO',
            includeStackTrace: false
        };
    });

    describe('Initialization', () => {
        it('should initialize with default config', () => {
            Logger.init();

            expect(Logger.config.level).toBe(Logger.Levels.DEBUG); // Development mode
            expect(Logger.config.enableConsole).toBe(true);
            expect(Logger.config.includeStackTrace).toBe(true); // Development mode
        });

        it('should initialize with custom config', () => {
            const customConfig = {
                level: Logger.Levels.ERROR,
                enableStorage: true,
                maxStorageEntries: 500
            };

            Logger.init(customConfig);

            expect(Logger.config.level).toBe(Logger.Levels.ERROR);
            expect(Logger.config.enableStorage).toBe(true);
            expect(Logger.config.maxStorageEntries).toBe(500);
        });

        it('should detect development environment', () => {
            Logger.init();

            expect(Logger.config.level).toBe(Logger.Levels.DEBUG);
            expect(Logger.config.includeStackTrace).toBe(true);
        });

        it('should detect production environment', () => {
            mockWindow.location.hostname = 'example.com';
            Logger.init();

            expect(Logger.config.level).toBe(Logger.Levels.WARN);
        });
    });

    describe('Logging Methods', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE });
        });

        it('should log error messages', () => {
            const error = new Error('Test error');
            Logger.error('Error occurred', { component: 'Test' }, error);

            expect(mockConsole.error).toHaveBeenCalled();
            expect(Logger.logs).toHaveLength(1);
            expect(Logger.logs[0].level).toBe(Logger.Levels.ERROR);
            expect(Logger.logs[0].message).toBe('Error occurred');
            expect(Logger.logs[0].error).toBeDefined();
        });

        it('should log warning messages', () => {
            Logger.warn('Warning message', { component: 'Test' });

            expect(mockConsole.warn).toHaveBeenCalled();
            expect(Logger.logs).toHaveLength(1);
            expect(Logger.logs[0].level).toBe(Logger.Levels.WARN);
        });

        it('should log info messages', () => {
            Logger.info('Info message', { component: 'Test' });

            expect(mockConsole.info).toHaveBeenCalled();
            expect(Logger.logs).toHaveLength(1);
            expect(Logger.logs[0].level).toBe(Logger.Levels.INFO);
        });

        it('should log debug messages', () => {
            Logger.debug('Debug message', { component: 'Test' });

            expect(mockConsole.log).toHaveBeenCalled();
            expect(Logger.logs).toHaveLength(1);
            expect(Logger.logs[0].level).toBe(Logger.Levels.DEBUG);
        });

        it('should log trace messages', () => {
            Logger.trace('Trace message', { component: 'Test' });

            expect(mockConsole.log).toHaveBeenCalled();
            expect(Logger.logs).toHaveLength(1);
            expect(Logger.logs[0].level).toBe(Logger.Levels.TRACE);
        });
    });

    describe('Log Level Filtering', () => {
        it('should filter logs based on level', () => {
            Logger.init({ level: Logger.Levels.WARN });

            Logger.error('Error message');
            Logger.warn('Warning message');
            Logger.info('Info message'); // Should be filtered
            Logger.debug('Debug message'); // Should be filtered

            expect(mockConsole.error).toHaveBeenCalledTimes(1);
            expect(mockConsole.warn).toHaveBeenCalledTimes(1);
            expect(mockConsole.info).not.toHaveBeenCalled();
            expect(mockConsole.log).not.toHaveBeenCalled();
        });

        it('should allow changing log level', () => {
            Logger.init({ level: Logger.Levels.ERROR });
            Logger.setLevel(Logger.Levels.DEBUG);

            Logger.debug('Debug message');

            expect(mockConsole.log).toHaveBeenCalled();
            expect(Logger.config.level).toBe(Logger.Levels.DEBUG);
        });
    });

    describe('Log Entry Creation', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE, enableStorage: true });
        });

        it('should create complete log entry', () => {
            const context = { component: 'Test', action: 'test' };
            const error = new Error('Test error');

            Logger.error('Test message', context, error);

            const logEntry = Logger.logs[0];
            expect(logEntry).toHaveProperty('id');
            expect(logEntry).toHaveProperty('timestamp');
            expect(logEntry.level).toBe(Logger.Levels.ERROR);
            expect(logEntry.levelName).toBe('ERROR');
            expect(logEntry.message).toBe('Test message');
            expect(logEntry.context).toEqual(context);
            expect(logEntry.error).toBeDefined();
            expect(logEntry.url).toBe(mockWindow.location.href);
            expect(logEntry.userAgent).toBe(mockNavigator.userAgent);
        });

        it('should include stack trace for warnings in debug mode', () => {
            Logger.init({ 
                level: Logger.Levels.TRACE, 
                includeStackTrace: true,
                enableStorage: true 
            });

            Logger.warn('Warning with stack trace');

            const logEntry = Logger.logs[0];
            expect(logEntry.stackTrace).toBeDefined();
        });

        it('should generate unique log IDs', () => {
            Logger.info('Message 1');
            Logger.info('Message 2');

            expect(Logger.logs[0].id).not.toBe(Logger.logs[1].id);
            expect(Logger.logs[0].id).toMatch(/^log_\d+_[a-z0-9]+$/);
        });
    });

    describe('Console Output', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE, enableConsole: true });
        });

        it('should format console output correctly', () => {
            Logger.info('Test message', { component: 'Test' });

            const logCall = mockConsole.info.mock.calls[0];
            expect(logCall[0]).toMatch(/\[.*\] \[INFO\] Test message/);
        });

        it('should output context data separately', () => {
            const context = { component: 'Test', data: 'value' };
            Logger.info('Test message', context);

            expect(mockConsole.log).toHaveBeenCalledWith('Context:', context);
        });

        it('should output error details separately', () => {
            const error = new Error('Test error');
            Logger.error('Error occurred', {}, error);

            expect(mockConsole.error).toHaveBeenCalledWith(
                'Error details:',
                expect.objectContaining({
                    name: 'Error',
                    message: 'Test error'
                })
            );
        });

        it('should disable console output when configured', () => {
            Logger.init({ level: Logger.Levels.TRACE, enableConsole: false });

            Logger.info('Test message');

            expect(mockConsole.info).not.toHaveBeenCalled();
        });
    });

    describe('Log Storage', () => {
        beforeEach(() => {
            Logger.init({ 
                level: Logger.Levels.TRACE, 
                enableStorage: true,
                maxStorageEntries: 3
            });
        });

        it('should store logs when enabled', () => {
            Logger.info('Message 1');
            Logger.info('Message 2');

            expect(Logger.logs).toHaveLength(2);
        });

        it('should limit stored logs to max entries', () => {
            Logger.info('Message 1');
            Logger.info('Message 2');
            Logger.info('Message 3');
            Logger.info('Message 4'); // Should remove first message

            expect(Logger.logs).toHaveLength(3);
            expect(Logger.logs[0].message).toBe('Message 2');
            expect(Logger.logs[2].message).toBe('Message 4');
        });

        it('should persist to localStorage when configured', () => {
            Logger.init({ 
                level: Logger.Levels.TRACE, 
                enableStorage: true,
                persistToStorage: true
            });

            Logger.info('Persistent message');

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'app_logs',
                expect.any(String)
            );
        });

        it('should handle localStorage errors gracefully', () => {
            mockLocalStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });

            Logger.init({ 
                level: Logger.Levels.TRACE, 
                enableStorage: true,
                persistToStorage: true
            });

            expect(() => {
                Logger.info('Message');
            }).not.toThrow();
        });
    });

    describe('Event Dispatching', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE, enableStorage: true });
        });

        it('should dispatch log events', () => {
            Logger.info('Test message');

            expect(global.CustomEvent).toHaveBeenCalledWith('logEntry', {
                detail: expect.objectContaining({
                    message: 'Test message',
                    level: Logger.Levels.INFO
                })
            });
            expect(mockDocument.dispatchEvent).toHaveBeenCalled();
        });
    });

    describe('Log Retrieval and Filtering', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE, enableStorage: true });
            
            // Add test logs
            Logger.error('Error message');
            Logger.warn('Warning message');
            Logger.info('Info message');
        });

        it('should get all logs', () => {
            const logs = Logger.getLogs();
            expect(logs).toHaveLength(3);
        });

        it('should filter logs by level', () => {
            const errorLogs = Logger.getLogs({ level: Logger.Levels.ERROR });
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].levelName).toBe('ERROR');
        });

        it('should filter logs by time range', () => {
            const since = new Date(Date.now() - 1000).toISOString();
            const recentLogs = Logger.getLogs({ since });
            expect(recentLogs.length).toBeGreaterThan(0);
        });

        it('should filter logs by search term', () => {
            const searchLogs = Logger.getLogs({ search: 'error' });
            expect(searchLogs).toHaveLength(1);
            expect(searchLogs[0].message).toContain('Error');
        });
    });

    describe('Log Export', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE, enableStorage: true });
            Logger.info('Test message', { component: 'Test' });
        });

        it('should export logs as JSON', () => {
            const exported = Logger.exportLogs('json');
            const parsed = JSON.parse(exported);
            
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].message).toBe('Test message');
        });

        it('should export logs as CSV', () => {
            const exported = Logger.exportLogs('csv');
            
            expect(exported).toContain('timestamp,level,message,context');
            expect(exported).toContain('Test message');
        });

        it('should export logs as text', () => {
            const exported = Logger.exportLogs('txt');
            
            expect(exported).toContain('[INFO] Test message');
            expect(exported).toContain('Context:');
        });

        it('should throw error for unsupported format', () => {
            expect(() => {
                Logger.exportLogs('xml');
            }).toThrow('Unsupported export format: xml');
        });
    });

    describe('Log Management', () => {
        beforeEach(() => {
            Logger.init({ level: Logger.Levels.TRACE, enableStorage: true });
            Logger.info('Test message');
        });

        it('should clear logs', () => {
            expect(Logger.logs).toHaveLength(1);
            
            Logger.clearLogs();
            
            expect(Logger.logs).toHaveLength(0);
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('app_logs');
        });
    });
});
