/**
 * TabController.js
 * 标签页控制器
 * 
 * 负责标签页导航、状态管理和键盘导航
 */

import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { globalState, stateHelpers } from '../utils/StateManager.js';
import { globalEventManager } from '../utils/EventManager.js';

export class TabController {
    constructor() {
        this.tabs = new Map();
        this.eventGroup = null;
        this.initialized = false;
        
        Logger.info('TabController created');
    }

    /**
     * 初始化标签页控制器
     */
    initialize() {
        try {
            if (this.initialized) {
                Logger.warn('TabController already initialized');
                return;
            }

            this.setupEventListeners();
            this.loadTabConfiguration();
            this.initializeTabState();

            this.initialized = true;
            Logger.info('TabController initialized');

        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TabController',
                method: 'initialize',
                action: 'tab_initialization'
            });
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this.eventGroup = globalEventManager.createEventGroup('TabController');

        // 标签页按钮点击事件
        this.eventGroup.addDelegated(
            document,
            '.tab-button',
            'click',
            (e) => {
                const tabId = e.target.dataset.tab;
                if (tabId) {
                    this.switchTab(tabId);
                }
            }
        );

        // 键盘导航支持
        this.eventGroup.addDelegated(
            document,
            '.tab-button',
            'keydown',
            (e) => {
                this.handleTabKeydown(e);
            }
        );

        // 监听状态变化
        globalState.subscribe('app.currentTab', (tab, oldTab) => {
            if (tab !== oldTab) {
                this.updateTabUI(tab);
                this.handleTabChange(tab, oldTab);
            }
        });

        Logger.debug('Tab event listeners setup completed');
    }

    /**
     * 加载标签页配置
     */
    loadTabConfiguration() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            const tabId = button.dataset.tab;
            if (tabId) {
                const tabConfig = {
                    id: tabId,
                    element: button,
                    pane: document.getElementById(`${tabId}-tab`),
                    title: button.textContent.trim(),
                    enabled: !button.disabled,
                    visible: !button.hidden
                };
                
                this.tabs.set(tabId, tabConfig);
                Logger.debug('Tab registered', { tabId, title: tabConfig.title });
            }
        });

        Logger.info('Tab configuration loaded', { 
            totalTabs: this.tabs.size,
            tabs: Array.from(this.tabs.keys())
        });
    }

    /**
     * 初始化标签页状态
     */
    initializeTabState() {
        // 获取当前活动标签页
        const activeButton = document.querySelector('.tab-button.active');
        const currentTab = activeButton ? activeButton.dataset.tab : 'providers';
        
        // 设置初始状态
        stateHelpers.setCurrentTab(currentTab);
        
        Logger.debug('Initial tab state set', { currentTab });
    }

    /**
     * 切换标签页
     * @param {string} tabId - 标签页ID
     */
    switchTab(tabId) {
        try {
            if (!this.tabs.has(tabId)) {
                Logger.warn('Tab not found', { tabId });
                return;
            }

            const tabConfig = this.tabs.get(tabId);
            if (!tabConfig.enabled) {
                Logger.warn('Tab is disabled', { tabId });
                return;
            }

            const currentTab = stateHelpers.getCurrentTab();
            if (currentTab === tabId) {
                Logger.debug('Tab already active', { tabId });
                return;
            }

            // 更新状态
            stateHelpers.setCurrentTab(tabId);
            
            Logger.info('Tab switched', { from: currentTab, to: tabId });

        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TabController',
                method: 'switchTab',
                action: 'switch_tab',
                tabId
            });
        }
    }

    /**
     * 更新标签页UI
     * @param {string} activeTabId - 活动标签页ID
     */
    updateTabUI(activeTabId) {
        // 更新按钮状态
        this.tabs.forEach((tabConfig, tabId) => {
            const isActive = tabId === activeTabId;
            
            tabConfig.element.classList.toggle('active', isActive);
            tabConfig.element.setAttribute('aria-selected', isActive.toString());
            
            if (tabConfig.pane) {
                tabConfig.pane.classList.toggle('active', isActive);
            }
        });

        Logger.debug('Tab UI updated', { activeTabId });
    }

    /**
     * 处理标签页变化
     * @param {string} newTab - 新标签页
     * @param {string} oldTab - 旧标签页
     */
    handleTabChange(newTab, oldTab) {
        // 触发标签页特定的处理逻辑
        switch (newTab) {
            case 'models':
                // 当切换到模型标签页时，重新渲染模型列表
                setTimeout(() => {
                    const modelConfig = globalState.getState('components.modelConfig');
                    if (modelConfig && typeof modelConfig.renderModels === 'function') {
                        modelConfig.renderModels();
                    }
                }, 50);
                break;
                
            case 'providers':
                // 当切换到服务商标签页时的处理
                break;
                
            case 'save':
                // 当切换到保存标签页时的处理
                break;
        }

        // 触发自定义事件
        globalEventManager.dispatchEvent(document, 'tabChanged', {
            newTab,
            oldTab,
            timestamp: Date.now()
        });

        Logger.debug('Tab change handled', { newTab, oldTab });
    }

    /**
     * 处理标签页键盘事件
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleTabKeydown(e) {
        const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
        const currentIndex = tabButtons.indexOf(e.target);
        let targetButton = null;

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                targetButton = tabButtons[currentIndex - 1] || tabButtons[tabButtons.length - 1];
                break;
                
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                targetButton = tabButtons[currentIndex + 1] || tabButtons[0];
                break;
                
            case 'Home':
                e.preventDefault();
                targetButton = tabButtons[0];
                break;
                
            case 'End':
                e.preventDefault();
                targetButton = tabButtons[tabButtons.length - 1];
                break;
                
            case 'Enter':
            case ' ':
                e.preventDefault();
                const tabId = e.target.dataset.tab;
                if (tabId) {
                    this.switchTab(tabId);
                }
                return;
        }

        if (targetButton) {
            targetButton.focus();
            const tabId = targetButton.dataset.tab;
            if (tabId) {
                this.switchTab(tabId);
            }
        }
    }

    /**
     * 启用/禁用标签页
     * @param {string} tabId - 标签页ID
     * @param {boolean} enabled - 是否启用
     */
    setTabEnabled(tabId, enabled) {
        const tabConfig = this.tabs.get(tabId);
        if (tabConfig) {
            tabConfig.enabled = enabled;
            tabConfig.element.disabled = !enabled;
            tabConfig.element.setAttribute('aria-disabled', (!enabled).toString());
            
            Logger.debug('Tab enabled state changed', { tabId, enabled });
        }
    }

    /**
     * 显示/隐藏标签页
     * @param {string} tabId - 标签页ID
     * @param {boolean} visible - 是否可见
     */
    setTabVisible(tabId, visible) {
        const tabConfig = this.tabs.get(tabId);
        if (tabConfig) {
            tabConfig.visible = visible;
            tabConfig.element.hidden = !visible;
            
            if (tabConfig.pane) {
                tabConfig.pane.hidden = !visible;
            }
            
            Logger.debug('Tab visibility changed', { tabId, visible });
        }
    }

    /**
     * 获取标签页信息
     * @param {string} tabId - 标签页ID
     * @returns {Object} 标签页配置
     */
    getTabInfo(tabId) {
        return this.tabs.get(tabId);
    }

    /**
     * 获取所有标签页
     * @returns {Array} 标签页配置数组
     */
    getAllTabs() {
        return Array.from(this.tabs.values());
    }

    /**
     * 获取当前活动标签页
     * @returns {string} 活动标签页ID
     */
    getCurrentTab() {
        return stateHelpers.getCurrentTab();
    }

    /**
     * 销毁标签页控制器
     */
    destroy() {
        try {
            if (this.eventGroup) {
                this.eventGroup.removeAll();
            }
            
            this.tabs.clear();
            this.initialized = false;
            
            Logger.info('TabController destroyed');
            
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TabController',
                method: 'destroy',
                action: 'tab_destruction'
            });
        }
    }
}

// 创建全局标签页控制器实例
export const globalTabController = new TabController();
