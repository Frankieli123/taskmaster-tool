/**
 * AppController.js
 * 应用主控制器
 * 
 * 负责应用的初始化、生命周期管理和高级协调
 */

import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { UINotification } from '../components/UINotification.js';
import { globalState, stateHelpers } from '../utils/StateManager.js';
import { globalEventManager } from '../utils/EventManager.js';

export class AppController {
    constructor() {
        this.initialized = false;
        this.components = new Map();
        this.controllers = new Map();
        this.eventGroup = null;
        
        Logger.info('AppController created');
    }

    /**
     * 初始化应用
     * @param {Object} options - 初始化选项
     */
    async initialize(options = {}) {
        try {
            if (this.initialized) {
                Logger.warn('App already initialized');
                return;
            }

            Logger.info('Starting application initialization');

            // 初始化核心系统
            await this.initializeCoreServices(options);

            // 初始化状态管理
            this.initializeStateManagement();

            // 初始化事件管理
            this.initializeEventManagement();

            // 设置全局错误处理
            this.setupGlobalErrorHandling();

            // 标记为已初始化
            this.initialized = true;
            globalState.setState('app.initialized', true);

            Logger.info('Application initialization completed');

        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'AppController',
                method: 'initialize',
                action: 'app_initialization'
            });
            throw error;
        }
    }

    /**
     * 初始化核心服务
     * @param {Object} options - 选项
     */
    async initializeCoreServices(options) {
        // 初始化Logger
        Logger.init({
            level: options.logLevel || Logger.Levels.INFO,
            enableConsole: true,
            enableStorage: true,
            ...options.logger
        });

        // 初始化UINotification
        UINotification.init({
            position: UINotification.Positions.TOP_RIGHT,
            duration: 5000,
            ...options.notification
        });

        Logger.info('Core services initialized');
    }

    /**
     * 初始化状态管理
     */
    initializeStateManagement() {
        // 添加状态变化中间件
        globalState.addMiddleware((action, _state) => {
            // 记录状态变化
            if (action.type === 'SET_STATE') {
                Logger.debug('State change', {
                    path: action.path,
                    value: action.value,
                    oldValue: action.oldValue
                });
            }
            return action;
        });

        // 订阅关键状态变化
        globalState.subscribe('app.hasUnsavedChanges', (hasChanges) => {
            this.handleUnsavedChanges(hasChanges);
        });

        globalState.subscribe('app.currentTab', (tab) => {
            this.handleTabChange(tab);
        });

        Logger.info('State management initialized');
    }

    /**
     * 初始化事件管理
     */
    initializeEventManagement() {
        this.eventGroup = globalEventManager.createEventGroup('AppController');

        // 设置全局键盘快捷键
        this.eventGroup.add(document, 'keydown', (e) => {
            this.handleGlobalKeydown(e);
        });

        // 设置页面卸载处理
        this.eventGroup.add(window, 'beforeunload', (e) => {
            this.handleBeforeUnload(e);
        });

        // 设置页面可见性变化处理
        this.eventGroup.add(document, 'visibilitychange', () => {
            this.handleVisibilityChange();
        });

        Logger.info('Event management initialized');
    }

    /**
     * 设置全局错误处理
     */
    setupGlobalErrorHandling() {
        // 全局错误监听
        globalEventManager.addEventListener(window, 'error', (event) => {
            ErrorHandler.handle(event.error, {
                source: 'global_error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // 未处理的Promise拒绝
        globalEventManager.addEventListener(window, 'unhandledrejection', (event) => {
            ErrorHandler.handle(event.reason, {
                source: 'unhandled_promise',
                type: 'promise_rejection'
            });
        });

        Logger.info('Global error handling setup completed');
    }

    /**
     * 注册组件
     * @param {string} name - 组件名称
     * @param {Object} component - 组件实例
     */
    registerComponent(name, component) {
        this.components.set(name, component);
        Logger.debug('Component registered', { name });
    }

    /**
     * 获取组件
     * @param {string} name - 组件名称
     * @returns {Object} 组件实例
     */
    getComponent(name) {
        return this.components.get(name);
    }

    /**
     * 注册控制器
     * @param {string} name - 控制器名称
     * @param {Object} controller - 控制器实例
     */
    registerController(name, controller) {
        this.controllers.set(name, controller);
        Logger.debug('Controller registered', { name });
    }

    /**
     * 获取控制器
     * @param {string} name - 控制器名称
     * @returns {Object} 控制器实例
     */
    getController(name) {
        return this.controllers.get(name);
    }

    /**
     * 处理未保存更改状态
     * @param {boolean} hasChanges - 是否有未保存更改
     */
    handleUnsavedChanges(hasChanges) {
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            if (hasChanges) {
                saveBtn.classList.add('btn-warning');
                saveBtn.classList.remove('btn-primary');
                saveBtn.innerHTML = '<span class="btn-icon">⚠️</span>保存更改';
            } else {
                saveBtn.classList.add('btn-primary');
                saveBtn.classList.remove('btn-warning');
                saveBtn.innerHTML = '<span class="btn-icon">💾</span>保存更改';
            }
        }
    }

    /**
     * 处理标签页切换
     * @param {string} tab - 新标签页
     */
    handleTabChange(tab) {
        // 更新UI状态
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        const activeButton = document.querySelector(`[data-tab="${tab}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
            activeButton.setAttribute('aria-selected', 'true');
        }

        // 更新标签页内容
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        const activePane = document.getElementById(`${tab}-tab`);
        if (activePane) {
            activePane.classList.add('active');
        }

        Logger.debug('Tab changed', { tab });
    }

    /**
     * 处理全局键盘事件
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleGlobalKeydown(e) {
        // Ctrl+S 保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const saveController = this.getController('save');
            if (saveController) {
                saveController.saveConfiguration();
            }
        }

        // Ctrl+Z 撤销（如果有撤销功能）
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            // TODO: 实现撤销功能
            Logger.debug('Undo shortcut triggered (not implemented)');
        }

        // Escape 关闭模态框
        if (e.key === 'Escape') {
            const activeModals = globalState.getState('ui.activeModals');
            if (activeModals && activeModals.length > 0) {
                // 关闭最顶层的模态框
                const topModal = document.querySelector('.ui-modal.show');
                if (topModal) {
                    topModal.querySelector('.ui-modal-backdrop')?.click();
                }
            }
        }
    }

    /**
     * 处理页面卸载前事件
     * @param {BeforeUnloadEvent} e - 卸载事件
     */
    handleBeforeUnload(e) {
        const hasUnsavedChanges = stateHelpers.getHasUnsavedChanges();
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
        }
    }

    /**
     * 处理页面可见性变化
     */
    handleVisibilityChange() {
        if (document.hidden) {
            Logger.debug('Page hidden');
            // 页面隐藏时可以暂停某些操作
        } else {
            Logger.debug('Page visible');
            // 页面显示时可以恢复操作
        }
    }

    /**
     * 显示状态消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型
     */
    showStatus(message, type = 'info') {
        switch (type) {
            case 'success':
                UINotification.success(message);
                Logger.info(message);
                break;
            case 'error':
                UINotification.error(message);
                Logger.error(message);
                break;
            case 'warning':
                UINotification.warning(message);
                Logger.warn(message);
                break;
            case 'loading':
                UINotification.info(message);
                Logger.info(message);
                break;
            default:
                UINotification.info(message);
                Logger.info(message);
        }
    }

    /**
     * 获取应用状态
     * @returns {Object} 应用状态信息
     */
    getAppStatus() {
        return {
            initialized: this.initialized,
            components: Array.from(this.components.keys()),
            controllers: Array.from(this.controllers.keys()),
            state: globalState.getSnapshot(),
            eventStats: globalEventManager.getStats()
        };
    }

    /**
     * 销毁应用
     */
    async destroy() {
        try {
            Logger.info('Starting application destruction');

            // 清理事件监听器
            if (this.eventGroup) {
                this.eventGroup.removeAll();
            }

            // 清理组件
            for (const [_name, component] of this.components) {
                if (typeof component.destroy === 'function') {
                    await component.destroy();
                }
            }
            this.components.clear();

            // 清理控制器
            for (const [_name, controller] of this.controllers) {
                if (typeof controller.destroy === 'function') {
                    await controller.destroy();
                }
            }
            this.controllers.clear();

            // 清理状态管理
            globalState.cleanup();

            // 清理事件管理
            globalEventManager.destroy();

            this.initialized = false;
            Logger.info('Application destruction completed');

        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'AppController',
                method: 'destroy',
                action: 'app_destruction'
            });
        }
    }
}

// 创建全局应用控制器实例
export const globalAppController = new AppController();

// 导出常用的应用操作
export const appActions = {
    showStatus: (message, type) => globalAppController.showStatus(message, type),
    getComponent: (name) => globalAppController.getComponent(name),
    getController: (name) => globalAppController.getController(name),
    getAppStatus: () => globalAppController.getAppStatus()
};
