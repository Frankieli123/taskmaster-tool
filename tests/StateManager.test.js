/**
 * StateManager.test.js
 * Unit tests for StateManager class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/utils/StateManager.js';

describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
        stateManager = new StateManager();
    });

    describe('Basic State Operations', () => {
        it('should initialize with default state', () => {
            const state = stateManager.getState();
            
            expect(state).toHaveProperty('app');
            expect(state).toHaveProperty('config');
            expect(state).toHaveProperty('ui');
            expect(state).toHaveProperty('testing');
            
            expect(state.app.initialized).toBe(false);
            expect(state.app.currentTab).toBe('providers');
            expect(state.config.providers).toEqual([]);
            expect(state.config.models).toEqual([]);
        });

        it('should get nested state values', () => {
            expect(stateManager.getState('app.currentTab')).toBe('providers');
            expect(stateManager.getState('config.providers')).toEqual([]);
            expect(stateManager.getState('nonexistent.path')).toBeUndefined();
        });

        it('should set nested state values', () => {
            stateManager.setState('app.currentTab', 'models');
            expect(stateManager.getState('app.currentTab')).toBe('models');

            stateManager.setState('config.providers', [{ id: 'test' }]);
            expect(stateManager.getState('config.providers')).toEqual([{ id: 'test' }]);
        });

        it('should create nested paths when setting deep values', () => {
            stateManager.setState('new.deep.path', 'value');
            expect(stateManager.getState('new.deep.path')).toBe('value');
            expect(stateManager.getState('new.deep')).toEqual({ path: 'value' });
        });
    });

    describe('State Subscriptions', () => {
        it('should notify listeners when state changes', () => {
            const listener = vi.fn();
            const unsubscribe = stateManager.subscribe('app.currentTab', listener);

            stateManager.setState('app.currentTab', 'models');

            expect(listener).toHaveBeenCalledWith('models', 'providers', 'app.currentTab');
            
            unsubscribe();
        });

        it('should notify parent path listeners', () => {
            const appListener = vi.fn();
            const tabListener = vi.fn();
            
            stateManager.subscribe('app', appListener);
            stateManager.subscribe('app.currentTab', tabListener);

            stateManager.setState('app.currentTab', 'models');

            expect(tabListener).toHaveBeenCalledWith('models', 'providers', 'app.currentTab');
            expect(appListener).toHaveBeenCalledWith(
                expect.objectContaining({ currentTab: 'models' }),
                undefined,
                'app'
            );
        });

        it('should remove listeners when unsubscribed', () => {
            const listener = vi.fn();
            const unsubscribe = stateManager.subscribe('app.currentTab', listener);

            unsubscribe();
            stateManager.setState('app.currentTab', 'models');

            expect(listener).not.toHaveBeenCalled();
        });

        it('should handle listener errors gracefully', () => {
            const errorListener = vi.fn(() => {
                throw new Error('Listener error');
            });
            const normalListener = vi.fn();

            stateManager.subscribe('app.currentTab', errorListener);
            stateManager.subscribe('app.currentTab', normalListener);

            expect(() => {
                stateManager.setState('app.currentTab', 'models');
            }).not.toThrow();

            expect(normalListener).toHaveBeenCalled();
        });
    });

    describe('Batch Updates', () => {
        it('should perform batch updates', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            stateManager.subscribe('app.currentTab', listener1);
            stateManager.subscribe('app.hasUnsavedChanges', listener2);

            stateManager.batchUpdate({
                'app.currentTab': 'models',
                'app.hasUnsavedChanges': true
            });

            expect(stateManager.getState('app.currentTab')).toBe('models');
            expect(stateManager.getState('app.hasUnsavedChanges')).toBe(true);
            expect(listener1).toHaveBeenCalledWith('models', 'providers', 'app.currentTab');
            expect(listener2).toHaveBeenCalledWith(true, false, 'app.hasUnsavedChanges');
        });
    });

    describe('Middleware', () => {
        it('should apply middleware to state changes', () => {
            const middleware = vi.fn((action) => {
                if (action.path === 'app.currentTab') {
                    return { ...action, value: action.value.toUpperCase() };
                }
                return action;
            });

            stateManager.addMiddleware(middleware);
            stateManager.setState('app.currentTab', 'models');

            expect(middleware).toHaveBeenCalled();
            expect(stateManager.getState('app.currentTab')).toBe('MODELS');
        });

        it('should block state changes when middleware returns null', () => {
            const blockingMiddleware = vi.fn(() => null);
            const listener = vi.fn();

            stateManager.addMiddleware(blockingMiddleware);
            stateManager.subscribe('app.currentTab', listener);
            
            stateManager.setState('app.currentTab', 'models');

            expect(stateManager.getState('app.currentTab')).toBe('providers'); // unchanged
            expect(listener).not.toHaveBeenCalled();
        });

        it('should handle middleware errors gracefully', () => {
            const errorMiddleware = vi.fn(() => {
                throw new Error('Middleware error');
            });

            stateManager.addMiddleware(errorMiddleware);

            expect(() => {
                stateManager.setState('app.currentTab', 'models');
            }).not.toThrow();

            // State should still be updated despite middleware error
            expect(stateManager.getState('app.currentTab')).toBe('models');
        });
    });

    describe('State Reset and Snapshots', () => {
        it('should reset entire state', () => {
            stateManager.setState('app.currentTab', 'models');
            stateManager.setState('config.providers', [{ id: 'test' }]);

            stateManager.reset();

            expect(stateManager.getState('app.currentTab')).toBe('providers');
            expect(stateManager.getState('config.providers')).toEqual([]);
        });

        it('should reset specific state path', () => {
            stateManager.setState('app.currentTab', 'models');
            stateManager.setState('app.hasUnsavedChanges', true);

            stateManager.reset('app.currentTab');

            expect(stateManager.getState('app.currentTab')).toBeUndefined();
            expect(stateManager.getState('app.hasUnsavedChanges')).toBe(true);
        });

        it('should create and restore snapshots', () => {
            stateManager.setState('app.currentTab', 'models');
            stateManager.setState('config.providers', [{ id: 'test' }]);

            const snapshot = stateManager.getSnapshot();
            
            stateManager.setState('app.currentTab', 'save');
            stateManager.setState('config.providers', []);

            stateManager.restoreFromSnapshot(snapshot);

            expect(stateManager.getState('app.currentTab')).toBe('models');
            expect(stateManager.getState('config.providers')).toEqual([{ id: 'test' }]);
        });

        it('should notify listeners when restoring from snapshot', () => {
            const listener = vi.fn();
            stateManager.subscribe('app.currentTab', listener);

            stateManager.setState('app.currentTab', 'models');
            const snapshot = stateManager.getSnapshot();
            
            listener.mockClear();
            stateManager.setState('app.currentTab', 'save');
            stateManager.restoreFromSnapshot(snapshot);

            expect(listener).toHaveBeenCalledWith('models', 'save', 'app.currentTab');
        });
    });

    describe('Cleanup', () => {
        it('should cleanup all listeners and middleware', () => {
            const listener = vi.fn();
            const middleware = vi.fn((action) => action);

            stateManager.subscribe('app.currentTab', listener);
            stateManager.addMiddleware(middleware);

            stateManager.cleanup();
            stateManager.setState('app.currentTab', 'models');

            expect(listener).not.toHaveBeenCalled();
            expect(middleware).not.toHaveBeenCalled();
        });
    });
});
