/**
 * StateManager.js
 * 统一状态管理系统
 * 
 * 实现观察者模式，提供集中式状态管理和组件间通信
 */

import { Logger } from './Logger.js';

export class StateManager {
    constructor() {
        this.state = {
            // 应用状态
            app: {
                initialized: false,
                currentTab: 'providers',
                hasUnsavedChanges: false,
                isLoading: false,
                projectPath: null,
                isProjectValid: false
            },
            
            // 配置数据
            config: {
                providers: [],
                models: [],
                lastSaved: null
            },
            
            // UI状态
            ui: {
                activeModals: [],
                notifications: [],
                selectedProvider: null,
                selectedModel: null,
                validationErrors: []
            },
            
            // 测试状态
            testing: {
                isRunning: false,
                currentTest: null,
                results: {}
            }
        };
        
        this.listeners = new Map();
        this.middleware = [];
        
        Logger.info('StateManager initialized');
    }

    /**
     * 获取状态值
     * @param {string} path - 状态路径，如 'app.currentTab'
     * @returns {any} 状态值
     */
    getState(path = '') {
        if (!path) return this.state;
        
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, this.state);
    }

    /**
     * 设置状态值
     * @param {string} path - 状态路径
     * @param {any} value - 新值
     * @param {Object} options - 选项
     */
    setState(path, value, options = {}) {
        const oldValue = this.getState(path);
        
        // 应用中间件
        const action = {
            type: 'SET_STATE',
            path,
            value,
            oldValue,
            timestamp: Date.now(),
            ...options
        };
        
        const processedAction = this.applyMiddleware(action);
        if (processedAction === null) {
            return; // 中间件阻止了状态更新
        }
        
        // 更新状态
        this.setNestedValue(this.state, path, processedAction.value);
        
        // 触发监听器
        this.notifyListeners(path, processedAction.value, oldValue);
        
        Logger.debug('State updated', { path, value: processedAction.value, oldValue });
    }

    /**
     * 订阅状态变化
     * @param {string} path - 状态路径
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        
        this.listeners.get(path).add(callback);
        
        Logger.debug('State subscription added', { path });
        
        // 返回取消订阅函数
        return () => {
            const pathListeners = this.listeners.get(path);
            if (pathListeners) {
                pathListeners.delete(callback);
                if (pathListeners.size === 0) {
                    this.listeners.delete(path);
                }
            }
            Logger.debug('State subscription removed', { path });
        };
    }

    /**
     * 批量更新状态
     * @param {Object} updates - 更新对象，键为路径，值为新值
     */
    batchUpdate(updates) {
        const actions = Object.entries(updates).map(([path, value]) => ({
            type: 'BATCH_UPDATE',
            path,
            value,
            oldValue: this.getState(path),
            timestamp: Date.now()
        }));
        
        // 应用所有更新
        actions.forEach(action => {
            this.setNestedValue(this.state, action.path, action.value);
        });
        
        // 批量通知监听器
        actions.forEach(action => {
            this.notifyListeners(action.path, action.value, action.oldValue);
        });
        
        Logger.debug('Batch state update completed', { updates });
    }

    /**
     * 添加中间件
     * @param {Function} middleware - 中间件函数
     */
    addMiddleware(middleware) {
        this.middleware.push(middleware);
        Logger.debug('Middleware added', { middleware: middleware.name });
    }

    /**
     * 应用中间件
     * @param {Object} action - 动作对象
     * @returns {Object|null} 处理后的动作或null（阻止更新）
     */
    applyMiddleware(action) {
        let processedAction = action;
        
        for (const middleware of this.middleware) {
            try {
                processedAction = middleware(processedAction, this.state);
                if (processedAction === null) {
                    Logger.debug('Action blocked by middleware', { action });
                    return null;
                }
            } catch (error) {
                Logger.error('Middleware error', { error, middleware: middleware.name });
            }
        }
        
        return processedAction;
    }

    /**
     * 设置嵌套值
     * @param {Object} obj - 目标对象
     * @param {string} path - 路径
     * @param {any} value - 值
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        const target = keys.reduce((current, key) => {
            if (current[key] === undefined) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }

    /**
     * 通知监听器
     * @param {string} path - 状态路径
     * @param {any} newValue - 新值
     * @param {any} oldValue - 旧值
     */
    notifyListeners(path, newValue, oldValue) {
        // 通知精确路径的监听器
        const exactListeners = this.listeners.get(path);
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    Logger.error('Listener error', { error, path });
                }
            });
        }
        
        // 通知父路径的监听器
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentListeners = this.listeners.get(parentPath);
            if (parentListeners) {
                const parentValue = this.getState(parentPath);
                parentListeners.forEach(callback => {
                    try {
                        callback(parentValue, undefined, parentPath);
                    } catch (error) {
                        Logger.error('Parent listener error', { error, path: parentPath });
                    }
                });
            }
        }
    }

    /**
     * 重置状态
     * @param {string} path - 要重置的路径，不传则重置全部
     */
    reset(path = '') {
        if (!path) {
            // 重置全部状态
            const oldState = { ...this.state };
            this.state = {
                app: {
                    initialized: false,
                    currentTab: 'providers',
                    hasUnsavedChanges: false,
                    isLoading: false,
                    projectPath: null,
                    isProjectValid: false
                },
                config: {
                    providers: [],
                    models: [],
                    lastSaved: null
                },
                ui: {
                    activeModals: [],
                    notifications: [],
                    selectedProvider: null,
                    selectedModel: null,
                    validationErrors: []
                },
                testing: {
                    isRunning: false,
                    currentTest: null,
                    results: {}
                }
            };
            
            // 通知所有监听器
            this.listeners.forEach((listeners, listenerPath) => {
                const newValue = this.getState(listenerPath);
                const oldValue = this.getNestedValue(oldState, listenerPath);
                listeners.forEach(callback => {
                    try {
                        callback(newValue, oldValue, listenerPath);
                    } catch (error) {
                        Logger.error('Reset listener error', { error, path: listenerPath });
                    }
                });
            });
        } else {
            // 重置特定路径
            const oldValue = this.getState(path);
            this.setNestedValue(this.state, path, undefined);
            this.notifyListeners(path, undefined, oldValue);
        }
        
        Logger.info('State reset', { path: path || 'all' });
    }

    /**
     * 获取嵌套值
     * @param {Object} obj - 源对象
     * @param {string} path - 路径
     * @returns {any} 值
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * 清理所有监听器
     */
    cleanup() {
        this.listeners.clear();
        this.middleware = [];
        Logger.info('StateManager cleaned up');
    }

    /**
     * 获取状态快照
     * @returns {Object} 状态快照
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * 从快照恢复状态
     * @param {Object} snapshot - 状态快照
     */
    restoreFromSnapshot(snapshot) {
        const oldState = this.getSnapshot();
        this.state = JSON.parse(JSON.stringify(snapshot));
        
        // 通知所有监听器
        this.listeners.forEach((listeners, path) => {
            const newValue = this.getState(path);
            const oldValue = this.getNestedValue(oldState, path);
            if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
                listeners.forEach(callback => {
                    try {
                        callback(newValue, oldValue, path);
                    } catch (error) {
                        Logger.error('Restore listener error', { error, path });
                    }
                });
            }
        });
        
        Logger.info('State restored from snapshot');
    }
}

// 创建全局状态管理器实例
export const globalState = new StateManager();

// 常用的状态操作辅助函数
export const stateHelpers = {
    // 应用状态
    setCurrentTab: (tab) => globalState.setState('app.currentTab', tab),
    getCurrentTab: () => globalState.getState('app.currentTab'),
    setHasUnsavedChanges: (hasChanges) => globalState.setState('app.hasUnsavedChanges', hasChanges),
    getHasUnsavedChanges: () => globalState.getState('app.hasUnsavedChanges'),
    
    // 配置数据
    setProviders: (providers) => globalState.setState('config.providers', providers),
    getProviders: () => globalState.getState('config.providers'),
    setModels: (models) => globalState.setState('config.models', models),
    getModels: () => globalState.getState('config.models'),
    
    // UI状态
    setSelectedProvider: (provider) => globalState.setState('ui.selectedProvider', provider),
    getSelectedProvider: () => globalState.getState('ui.selectedProvider'),
    setValidationErrors: (errors) => globalState.setState('ui.validationErrors', errors),
    getValidationErrors: () => globalState.getState('ui.validationErrors'),
    
    // 测试状态
    setTestingState: (isRunning, currentTest = null) => {
        globalState.batchUpdate({
            'testing.isRunning': isRunning,
            'testing.currentTest': currentTest
        });
    },
    getTestingState: () => globalState.getState('testing')
};
