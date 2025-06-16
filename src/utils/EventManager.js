/**
 * EventManager.js
 * 统一事件管理系统
 * 
 * 提供事件监听器的集中管理，防止内存泄漏，支持事件委托
 */

import { Logger } from './Logger.js';

export class EventManager {
    constructor() {
        this.listeners = new Map();
        this.delegatedListeners = new Map();
        this.abortController = new AbortController();
        
        Logger.info('EventManager initialized');
    }

    /**
     * 添加事件监听器
     * @param {Element|string} target - 目标元素或选择器
     * @param {string} event - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 选项
     * @returns {Function} 移除监听器的函数
     */
    addEventListener(target, event, handler, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        
        if (!element) {
            Logger.warn('Event target not found', { target, event });
            return () => {}; // 返回空函数避免错误
        }

        const listenerOptions = {
            signal: this.abortController.signal,
            ...options
        };

        // 包装处理函数以添加错误处理和日志
        const wrappedHandler = (e) => {
            try {
                Logger.debug('Event triggered', { 
                    event, 
                    target: element.tagName || element.constructor.name 
                });
                handler(e);
            } catch (error) {
                Logger.error('Event handler error', { 
                    error, 
                    event, 
                    target: element.tagName || element.constructor.name 
                });
            }
        };

        element.addEventListener(event, wrappedHandler, listenerOptions);

        // 记录监听器
        const listenerId = this.generateListenerId();
        const listenerInfo = {
            id: listenerId,
            element,
            event,
            handler: wrappedHandler,
            originalHandler: handler,
            options: listenerOptions
        };

        if (!this.listeners.has(element)) {
            this.listeners.set(element, new Map());
        }
        this.listeners.get(element).set(listenerId, listenerInfo);

        Logger.debug('Event listener added', { 
            listenerId, 
            event, 
            target: element.tagName || element.constructor.name 
        });

        // 返回移除函数
        return () => this.removeEventListener(listenerId);
    }

    /**
     * 添加委托事件监听器
     * @param {Element|string} container - 容器元素或选择器
     * @param {string} selector - 目标选择器
     * @param {string} event - 事件类型
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 选项
     * @returns {Function} 移除监听器的函数
     */
    addDelegatedListener(container, selector, event, handler, options = {}) {
        const containerElement = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!containerElement) {
            Logger.warn('Delegation container not found', { container, selector, event });
            return () => {};
        }

        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && containerElement.contains(target)) {
                try {
                    Logger.debug('Delegated event triggered', { 
                        event, 
                        selector, 
                        target: target.tagName 
                    });
                    handler.call(target, e);
                } catch (error) {
                    Logger.error('Delegated event handler error', { 
                        error, 
                        event, 
                        selector 
                    });
                }
            }
        };

        const listenerId = this.generateListenerId();
        const removeListener = this.addEventListener(
            containerElement, 
            event, 
            delegatedHandler, 
            options
        );

        // 记录委托监听器
        this.delegatedListeners.set(listenerId, {
            id: listenerId,
            container: containerElement,
            selector,
            event,
            handler: delegatedHandler,
            originalHandler: handler,
            removeListener
        });

        Logger.debug('Delegated event listener added', { 
            listenerId, 
            event, 
            selector 
        });

        return () => {
            removeListener();
            this.delegatedListeners.delete(listenerId);
        };
    }

    /**
     * 移除事件监听器
     * @param {string} listenerId - 监听器ID
     */
    removeEventListener(listenerId) {
        // 查找并移除普通监听器
        for (const [element, elementListeners] of this.listeners) {
            if (elementListeners.has(listenerId)) {
                const listenerInfo = elementListeners.get(listenerId);
                element.removeEventListener(
                    listenerInfo.event, 
                    listenerInfo.handler, 
                    listenerInfo.options
                );
                elementListeners.delete(listenerId);
                
                if (elementListeners.size === 0) {
                    this.listeners.delete(element);
                }
                
                Logger.debug('Event listener removed', { listenerId });
                return;
            }
        }

        // 查找并移除委托监听器
        if (this.delegatedListeners.has(listenerId)) {
            const delegatedInfo = this.delegatedListeners.get(listenerId);
            delegatedInfo.removeListener();
            this.delegatedListeners.delete(listenerId);
            Logger.debug('Delegated event listener removed', { listenerId });
        }
    }

    /**
     * 移除元素的所有事件监听器
     * @param {Element} element - 目标元素
     */
    removeElementListeners(element) {
        const elementListeners = this.listeners.get(element);
        if (elementListeners) {
            elementListeners.forEach((listenerInfo, _listenerId) => {
                element.removeEventListener(
                    listenerInfo.event,
                    listenerInfo.handler,
                    listenerInfo.options
                );
            });
            this.listeners.delete(element);
            Logger.debug('All listeners removed for element', { 
                element: element.tagName || element.constructor.name 
            });
        }
    }

    /**
     * 移除所有事件监听器
     */
    removeAllListeners() {
        // 中止所有监听器
        this.abortController.abort();
        
        // 清理记录
        this.listeners.clear();
        this.delegatedListeners.clear();
        
        // 创建新的AbortController
        this.abortController = new AbortController();
        
        Logger.info('All event listeners removed');
    }

    /**
     * 触发自定义事件
     * @param {Element|string} target - 目标元素或选择器
     * @param {string} eventType - 事件类型
     * @param {Object} detail - 事件详情
     * @param {Object} options - 事件选项
     */
    dispatchEvent(target, eventType, detail = {}, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        
        if (!element) {
            Logger.warn('Event dispatch target not found', { target, eventType });
            return;
        }

        const event = new CustomEvent(eventType, {
            detail,
            bubbles: true,
            cancelable: true,
            ...options
        });

        element.dispatchEvent(event);
        
        Logger.debug('Custom event dispatched', { 
            eventType, 
            detail, 
            target: element.tagName || element.constructor.name 
        });
    }

    /**
     * 批量添加事件监听器
     * @param {Array} listeners - 监听器配置数组
     * @returns {Array} 移除函数数组
     */
    addListeners(listeners) {
        return listeners.map(config => {
            const { target, event, handler, options, delegated } = config;
            
            if (delegated) {
                const { container, selector } = delegated;
                return this.addDelegatedListener(container, selector, event, handler, options);
            } else {
                return this.addEventListener(target, event, handler, options);
            }
        });
    }

    /**
     * 创建事件监听器组
     * @param {string} groupName - 组名
     * @returns {Object} 事件组对象
     */
    createEventGroup(groupName) {
        const group = {
            name: groupName,
            removeListeners: [],
            
            add: (target, event, handler, options) => {
                const removeListener = this.addEventListener(target, event, handler, options);
                group.removeListeners.push(removeListener);
                return removeListener;
            },
            
            addDelegated: (container, selector, event, handler, options) => {
                const removeListener = this.addDelegatedListener(
                    container, selector, event, handler, options
                );
                group.removeListeners.push(removeListener);
                return removeListener;
            },
            
            removeAll: () => {
                group.removeListeners.forEach(removeListener => removeListener());
                group.removeListeners = [];
                Logger.debug('Event group listeners removed', { groupName });
            }
        };

        Logger.debug('Event group created', { groupName });
        return group;
    }

    /**
     * 获取监听器统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        let totalListeners = 0;
        this.listeners.forEach(elementListeners => {
            totalListeners += elementListeners.size;
        });

        const stats = {
            totalListeners,
            delegatedListeners: this.delegatedListeners.size,
            elementsWithListeners: this.listeners.size
        };

        Logger.debug('Event manager stats', stats);
        return stats;
    }

    /**
     * 生成监听器ID
     * @returns {string} 唯一ID
     */
    generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * 检查元素是否有监听器
     * @param {Element} element - 目标元素
     * @returns {boolean} 是否有监听器
     */
    hasListeners(element) {
        return this.listeners.has(element) && this.listeners.get(element).size > 0;
    }

    /**
     * 获取元素的监听器信息
     * @param {Element} element - 目标元素
     * @returns {Array} 监听器信息数组
     */
    getElementListeners(element) {
        const elementListeners = this.listeners.get(element);
        if (!elementListeners) return [];

        return Array.from(elementListeners.values()).map(info => ({
            id: info.id,
            event: info.event,
            options: info.options
        }));
    }

    /**
     * 清理和销毁事件管理器
     */
    destroy() {
        this.removeAllListeners();
        Logger.info('EventManager destroyed');
    }
}

// 创建全局事件管理器实例
export const globalEventManager = new EventManager();
