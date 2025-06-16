/**
 * EventManager.test.js
 * Unit tests for EventManager class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventManager } from '../src/utils/EventManager.js';

// Mock DOM elements
const createMockElement = (tagName = 'div') => {
    const element = {
        tagName: tagName.toUpperCase(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
        contains: vi.fn(() => true),
        closest: vi.fn()
    };
    return element;
};

// Mock document
const mockDocument = {
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    createElement: vi.fn(() => createMockElement())
};

// Mock window
const mockWindow = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
};

// Setup global mocks
global.document = mockDocument;
global.window = mockWindow;
global.CustomEvent = vi.fn().mockImplementation((type, options) => ({
    type,
    detail: options?.detail,
    bubbles: options?.bubbles,
    cancelable: options?.cancelable
}));

describe('EventManager', () => {
    let eventManager;
    let mockElement;

    beforeEach(() => {
        eventManager = new EventManager();
        mockElement = createMockElement();
        
        // Reset mocks
        vi.clearAllMocks();
        mockDocument.querySelector.mockReturnValue(mockElement);
    });

    afterEach(() => {
        eventManager.destroy();
    });

    describe('Basic Event Listening', () => {
        it('should add event listener to element', () => {
            const handler = vi.fn();
            const removeListener = eventManager.addEventListener(mockElement, 'click', handler);

            expect(mockElement.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                expect.objectContaining({ signal: expect.any(Object) })
            );
            expect(typeof removeListener).toBe('function');
        });

        it('should add event listener using selector', () => {
            const handler = vi.fn();
            eventManager.addEventListener('#test-button', 'click', handler);

            expect(mockDocument.querySelector).toHaveBeenCalledWith('#test-button');
            expect(mockElement.addEventListener).toHaveBeenCalled();
        });

        it('should handle missing element gracefully', () => {
            mockDocument.querySelector.mockReturnValue(null);
            const handler = vi.fn();
            
            const removeListener = eventManager.addEventListener('#missing', 'click', handler);
            
            expect(typeof removeListener).toBe('function');
            expect(() => removeListener()).not.toThrow();
        });

        it('should wrap handler with error handling', () => {
            const errorHandler = vi.fn(() => {
                throw new Error('Handler error');
            });

            eventManager.addEventListener(mockElement, 'click', errorHandler);
            
            // Get the wrapped handler
            const wrappedHandler = mockElement.addEventListener.mock.calls[0][1];
            
            // Should not throw when wrapped handler is called
            expect(() => wrappedHandler({})).not.toThrow();
        });
    });

    describe('Event Delegation', () => {
        it('should add delegated event listener', () => {
            const container = createMockElement();
            const target = createMockElement();
            const handler = vi.fn();

            mockDocument.querySelector.mockReturnValue(container);
            target.closest.mockReturnValue(target);

            const removeListener = eventManager.addDelegatedListener(
                container, '.target', 'click', handler
            );

            expect(container.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                expect.objectContaining({ signal: expect.any(Object) })
            );
            expect(typeof removeListener).toBe('function');
        });

        it('should call handler when delegated event matches', () => {
            const container = createMockElement();
            const target = createMockElement();
            const handler = vi.fn();

            mockDocument.querySelector.mockReturnValue(container);
            target.closest.mockReturnValue(target);
            container.contains.mockReturnValue(true);

            eventManager.addDelegatedListener(container, '.target', 'click', handler);

            // Get the delegated handler
            const delegatedHandler = container.addEventListener.mock.calls[0][1];
            
            // Simulate event
            const mockEvent = { target };
            delegatedHandler(mockEvent);

            expect(target.closest).toHaveBeenCalledWith('.target');
            expect(handler).toHaveBeenCalledWith(mockEvent);
        });

        it('should not call handler when delegated event does not match', () => {
            const container = createMockElement();
            const target = createMockElement();
            const handler = vi.fn();

            mockDocument.querySelector.mockReturnValue(container);
            target.closest.mockReturnValue(null); // No match

            eventManager.addDelegatedListener(container, '.target', 'click', handler);

            // Get the delegated handler
            const delegatedHandler = container.addEventListener.mock.calls[0][1];
            
            // Simulate event
            const mockEvent = { target };
            delegatedHandler(mockEvent);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Event Removal', () => {
        it('should remove event listener by ID', () => {
            const handler = vi.fn();
            const removeListener = eventManager.addEventListener(mockElement, 'click', handler);

            removeListener();

            expect(mockElement.removeEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                expect.any(Object)
            );
        });

        it('should remove all listeners for element', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            eventManager.addEventListener(mockElement, 'click', handler1);
            eventManager.addEventListener(mockElement, 'mouseover', handler2);

            eventManager.removeElementListeners(mockElement);

            expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
        });

        it('should remove all listeners', () => {
            const element1 = createMockElement();
            const element2 = createMockElement();
            const handler = vi.fn();

            eventManager.addEventListener(element1, 'click', handler);
            eventManager.addEventListener(element2, 'click', handler);

            eventManager.removeAllListeners();

            // Should create new AbortController
            expect(eventManager.abortController).toBeDefined();
        });
    });

    describe('Event Groups', () => {
        it('should create event group', () => {
            const group = eventManager.createEventGroup('testGroup');

            expect(group).toHaveProperty('name', 'testGroup');
            expect(group).toHaveProperty('add');
            expect(group).toHaveProperty('addDelegated');
            expect(group).toHaveProperty('removeAll');
        });

        it('should add listeners to group', () => {
            const group = eventManager.createEventGroup('testGroup');
            const handler = vi.fn();

            const removeListener = group.add(mockElement, 'click', handler);

            expect(mockElement.addEventListener).toHaveBeenCalled();
            expect(typeof removeListener).toBe('function');
            expect(group.removeListeners).toHaveLength(1);
        });

        it('should remove all group listeners', () => {
            const group = eventManager.createEventGroup('testGroup');
            const handler = vi.fn();

            group.add(mockElement, 'click', handler);
            group.add(mockElement, 'mouseover', handler);

            group.removeAll();

            expect(group.removeListeners).toHaveLength(0);
        });
    });

    describe('Custom Events', () => {
        it('should dispatch custom event', () => {
            const eventType = 'customEvent';
            const detail = { data: 'test' };

            eventManager.dispatchEvent(mockElement, eventType, detail);

            expect(global.CustomEvent).toHaveBeenCalledWith(eventType, {
                detail,
                bubbles: true,
                cancelable: true
            });
            expect(mockElement.dispatchEvent).toHaveBeenCalled();
        });

        it('should handle missing dispatch target', () => {
            mockDocument.querySelector.mockReturnValue(null);

            expect(() => {
                eventManager.dispatchEvent('#missing', 'customEvent');
            }).not.toThrow();
        });
    });

    describe('Batch Operations', () => {
        it('should add multiple listeners', () => {
            const element1 = createMockElement();
            const element2 = createMockElement();
            const handler = vi.fn();

            const listeners = [
                { target: element1, event: 'click', handler },
                { target: element2, event: 'mouseover', handler }
            ];

            const removeListeners = eventManager.addListeners(listeners);

            expect(element1.addEventListener).toHaveBeenCalled();
            expect(element2.addEventListener).toHaveBeenCalled();
            expect(removeListeners).toHaveLength(2);
        });

        it('should add delegated listeners in batch', () => {
            const container = createMockElement();
            const handler = vi.fn();

            mockDocument.querySelector.mockReturnValue(container);

            const listeners = [
                {
                    event: 'click',
                    handler,
                    delegated: { container, selector: '.button' }
                }
            ];

            const removeListeners = eventManager.addListeners(listeners);

            expect(container.addEventListener).toHaveBeenCalled();
            expect(removeListeners).toHaveLength(1);
        });
    });

    describe('Statistics and Utilities', () => {
        it('should provide listener statistics', () => {
            const handler = vi.fn();
            eventManager.addEventListener(mockElement, 'click', handler);
            eventManager.addDelegatedListener(mockElement, '.target', 'click', handler);

            const stats = eventManager.getStats();

            expect(stats).toHaveProperty('totalListeners');
            expect(stats).toHaveProperty('delegatedListeners');
            expect(stats).toHaveProperty('elementsWithListeners');
            expect(stats.totalListeners).toBeGreaterThan(0);
        });

        it('should check if element has listeners', () => {
            const handler = vi.fn();
            
            expect(eventManager.hasListeners(mockElement)).toBe(false);
            
            eventManager.addEventListener(mockElement, 'click', handler);
            
            expect(eventManager.hasListeners(mockElement)).toBe(true);
        });

        it('should get element listener info', () => {
            const handler = vi.fn();
            eventManager.addEventListener(mockElement, 'click', handler);

            const listenerInfo = eventManager.getElementListeners(mockElement);

            expect(Array.isArray(listenerInfo)).toBe(true);
            expect(listenerInfo).toHaveLength(1);
            expect(listenerInfo[0]).toHaveProperty('event', 'click');
        });
    });

    describe('Cleanup and Destruction', () => {
        it('should destroy event manager', () => {
            const handler = vi.fn();
            eventManager.addEventListener(mockElement, 'click', handler);

            eventManager.destroy();

            // Should clear all internal state
            expect(eventManager.listeners.size).toBe(0);
            expect(eventManager.delegatedListeners.size).toBe(0);
        });
    });
});
