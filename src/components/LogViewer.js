/**
 * LogViewer.js
 * 日志查看器组件
 * 
 * 提供日志查看、过滤、搜索和导出功能
 */

import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { globalEventManager } from '../utils/EventManager.js';
import { UINotification } from './UINotification.js';

export class LogViewer {
    constructor(containerId = 'log-viewer') {
        this.containerId = containerId;
        this.container = null;
        this.eventGroup = null;
        this.currentFilter = {
            level: undefined,
            search: '',
            since: null
        };
        this.isVisible = false;
        
        this.init();
    }

    /**
     * 初始化日志查看器
     */
    init() {
        try {
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                Logger.warn('Log viewer container not found', { containerId: this.containerId });
                return;
            }

            this.setupEventListeners();
            this.render();
            
            Logger.debug('LogViewer initialized', { containerId: this.containerId });
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'LogViewer',
                method: 'init',
                action: 'initialization'
            });
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this.eventGroup = globalEventManager.createEventGroup('LogViewer');

        // 监听新的日志条目
        this.eventGroup.add(document, 'logEntry', () => {
            if (this.isVisible) {
                this.refreshLogs();
            }
        });

        // 监听日志查看器的显示/隐藏
        this.eventGroup.add(document, 'toggleLogViewer', () => {
            this.toggle();
        });
    }

    /**
     * 渲染日志查看器界面
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="log-viewer ${this.isVisible ? 'visible' : 'hidden'}">
                <div class="log-viewer-header">
                    <h3>系统日志</h3>
                    <div class="log-controls">
                        <select id="log-level-filter" class="form-control">
                            <option value="">所有级别</option>
                            <option value="${Logger.Levels.ERROR}">错误</option>
                            <option value="${Logger.Levels.WARN}">警告</option>
                            <option value="${Logger.Levels.INFO}">信息</option>
                            <option value="${Logger.Levels.DEBUG}">调试</option>
                            <option value="${Logger.Levels.TRACE}">跟踪</option>
                        </select>
                        <input type="text" id="log-search" class="form-control" placeholder="搜索日志...">
                        <button id="log-refresh" class="btn btn-secondary">刷新</button>
                        <button id="log-clear" class="btn btn-warning">清空</button>
                        <button id="log-export" class="btn btn-primary">导出</button>
                        <button id="log-close" class="btn btn-secondary">关闭</button>
                    </div>
                </div>
                <div class="log-viewer-content">
                    <div id="log-entries" class="log-entries"></div>
                </div>
                <div class="log-viewer-footer">
                    <span id="log-count">0 条日志</span>
                    <span id="log-status"></span>
                </div>
            </div>
        `;

        this.setupControlEvents();
        this.refreshLogs();
    }

    /**
     * 设置控件事件
     */
    setupControlEvents() {
        // 级别过滤
        this.eventGroup.add('#log-level-filter', 'change', (e) => {
            this.currentFilter.level = e.target.value ? parseInt(e.target.value) : undefined;
            this.refreshLogs();
        });

        // 搜索
        this.eventGroup.add('#log-search', 'input', (e) => {
            this.currentFilter.search = e.target.value;
            this.debounceRefresh();
        });

        // 刷新按钮
        this.eventGroup.add('#log-refresh', 'click', () => {
            this.refreshLogs();
        });

        // 清空按钮
        this.eventGroup.add('#log-clear', 'click', () => {
            this.clearLogs();
        });

        // 导出按钮
        this.eventGroup.add('#log-export', 'click', () => {
            this.exportLogs();
        });

        // 关闭按钮
        this.eventGroup.add('#log-close', 'click', () => {
            this.hide();
        });

        // 复制按钮事件委托
        this.eventGroup.add('#log-entries', 'click', (e) => {
            if (e.target.closest('.log-copy-btn')) {
                const logId = e.target.closest('.log-copy-btn').dataset.logId;
                this.copyLogEntry(logId);
            }
        });
    }

    /**
     * 刷新日志显示
     */
    refreshLogs() {
        try {
            let logs = Logger.getLogs(this.currentFilter);

            // 如果选择了"所有级别"（level为undefined），则排除调试和跟踪级别
            if (this.currentFilter.level === undefined) {
                logs = logs.filter(log =>
                    log.level !== Logger.Levels.DEBUG &&
                    log.level !== Logger.Levels.TRACE
                );
            }

            this.renderLogs(logs);
            this.updateStatus(logs.length);
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'LogViewer',
                method: 'refreshLogs',
                action: 'refresh_logs'
            });
        }
    }

    /**
     * 渲染日志条目
     * @param {Array} logs - 日志数组
     */
    renderLogs(logs) {
        const logEntriesContainer = document.getElementById('log-entries');
        if (!logEntriesContainer) return;

        if (logs.length === 0) {
            logEntriesContainer.innerHTML = '<div class="no-logs">暂无日志</div>';
            return;
        }

        const logHtml = logs.map(log => this.renderLogEntry(log)).join('');
        logEntriesContainer.innerHTML = logHtml;

        // 滚动到底部
        logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
    }

    /**
     * 渲染单个日志条目
     * @param {Object} log - 日志对象
     * @returns {string} HTML字符串
     */
    renderLogEntry(log) {
        const levelClass = `log-level-${log.levelName.toLowerCase()}`;
        const timeStr = new Date(log.timestamp).toLocaleTimeString();

        return `
            <div class="log-entry ${levelClass}" data-log-id="${log.id}">
                <div class="log-header">
                    <span class="log-time">${timeStr}</span>
                    <span class="log-level">${log.levelName}</span>
                    <span class="log-message">${this.escapeHtml(log.message)}</span>
                    <button class="log-copy-btn" data-log-id="${log.id}" title="复制此日志">
                        <span class="btn-icon">📋</span>
                    </button>
                </div>
                ${this.renderLogDetails(log)}
            </div>
        `;
    }

    /**
     * 渲染日志详情
     * @param {Object} log - 日志对象
     * @returns {string} HTML字符串
     */
    renderLogDetails(log) {
        let details = '';

        // 上下文信息
        if (log.context && Object.keys(log.context).length > 0) {
            details += `
                <div class="log-context">
                    <strong>上下文:</strong>
                    <pre>${this.escapeHtml(JSON.stringify(log.context, null, 2))}</pre>
                </div>
            `;
        }

        // 错误信息
        if (log.error) {
            details += `
                <div class="log-error">
                    <strong>错误详情:</strong>
                    <div class="error-name">${this.escapeHtml(log.error.name)}</div>
                    <div class="error-message">${this.escapeHtml(log.error.message)}</div>
                    ${log.error.stack ? `<pre class="error-stack">${this.escapeHtml(log.error.stack)}</pre>` : ''}
                </div>
            `;
        }

        // 堆栈跟踪
        if (log.stackTrace && log.level <= Logger.Levels.WARN) {
            details += `
                <div class="log-stack">
                    <strong>堆栈跟踪:</strong>
                    <pre>${this.escapeHtml(log.stackTrace)}</pre>
                </div>
            `;
        }

        return details ? `<div class="log-details">${details}</div>` : '';
    }

    /**
     * 更新状态显示
     * @param {number} count - 日志数量
     */
    updateStatus(count) {
        const countElement = document.getElementById('log-count');
        const statusElement = document.getElementById('log-status');
        
        if (countElement) {
            countElement.textContent = `${count} 条日志`;
        }
        
        if (statusElement) {
            const filterInfo = [];
            if (this.currentFilter.level !== undefined) {
                filterInfo.push(`级别: ${Logger.LevelNames[this.currentFilter.level]}`);
            }
            if (this.currentFilter.search) {
                filterInfo.push(`搜索: "${this.currentFilter.search}"`);
            }
            statusElement.textContent = filterInfo.length > 0 ? `(${filterInfo.join(', ')})` : '';
        }
    }

    /**
     * 清空日志
     */
    async clearLogs() {
        try {
            const confirmed = await UINotification.confirm(
                '确定要清空所有日志吗？此操作无法撤销。',
                {
                    title: '清空日志',
                    confirmText: '清空',
                    cancelText: '取消'
                }
            );

            if (confirmed) {
                Logger.clearLogs();
                this.refreshLogs();
                Logger.info('日志已清空', { component: 'LogViewer' });
            }
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'LogViewer',
                method: 'clearLogs',
                action: 'clear_logs'
            });
        }
    }

    /**
     * 复制单条日志
     * @param {string} logId - 日志ID
     */
    async copyLogEntry(logId) {
        try {
            const logs = Logger.getLogs();
            const log = logs.find(l => l.id === logId);

            if (!log) {
                Logger.warn('未找到要复制的日志', { logId });
                return;
            }

            // 格式化日志内容
            const logText = this.formatLogForCopy(log);

            // 使用Clipboard API复制
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(logText);
                this.showCopySuccess();
            } else {
                // 降级方案：使用传统方法
                this.fallbackCopyToClipboard(logText);
            }

            Logger.debug('日志复制成功', { logId, component: 'LogViewer' });
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'LogViewer',
                method: 'copyLogEntry',
                action: 'copy_log',
                logId
            });
            this.showCopyError();
        }
    }

    /**
     * 格式化日志用于复制
     * @param {Object} log - 日志对象
     * @returns {string} 格式化的日志文本
     */
    formatLogForCopy(log) {
        const timeStr = new Date(log.timestamp).toLocaleString();
        let text = `[${timeStr}] ${log.levelName}: ${log.message}\n`;

        // 添加上下文信息
        if (log.context && Object.keys(log.context).length > 0) {
            text += `上下文: ${JSON.stringify(log.context, null, 2)}\n`;
        }

        // 添加错误信息
        if (log.error) {
            text += `错误: ${log.error.name}: ${log.error.message}\n`;
            if (log.error.stack) {
                text += `堆栈跟踪:\n${log.error.stack}\n`;
            }
        }

        // 添加堆栈跟踪
        if (log.stackTrace && log.level <= Logger.Levels.WARN) {
            text += `堆栈跟踪:\n${log.stackTrace}\n`;
        }

        return text;
    }

    /**
     * 降级复制方案
     * @param {string} text - 要复制的文本
     */
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            this.showCopySuccess();
        } catch (err) {
            this.showCopyError();
        } finally {
            document.body.removeChild(textArea);
        }
    }

    /**
     * 显示复制成功提示
     */
    showCopySuccess() {
        // 创建临时提示
        const toast = document.createElement('div');
        toast.className = 'copy-toast success';
        toast.textContent = '✅ 日志已复制到剪贴板';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * 显示复制失败提示
     */
    showCopyError() {
        const toast = document.createElement('div');
        toast.className = 'copy-toast error';
        toast.textContent = '❌ 复制失败，请手动选择文本复制';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * 导出日志
     */
    async exportLogs() {
        try {
            // 创建格式选择对话框
            const format = await this.showFormatSelectionDialog();
            if (!format) return;

            const logs = Logger.getLogs(this.currentFilter);
            if (logs.length === 0) {
                UINotification.warning('没有日志可导出');
                return;
            }

            const exportData = Logger.exportLogs(format);
            const blob = new Blob([exportData], {
                type: format === 'json' ? 'application/json' : 'text/plain'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logs_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Logger.info('日志导出成功', {
                component: 'LogViewer',
                format,
                count: logs.length
            });
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'LogViewer',
                method: 'exportLogs',
                action: 'export_logs'
            });
        }
    }

    /**
     * 显示日志查看器
     */
    show() {
        this.isVisible = true;
        if (this.container) {
            const viewer = this.container.querySelector('.log-viewer');
            if (viewer) {
                viewer.classList.remove('hidden');
                viewer.classList.add('visible');
            }
        }
        this.refreshLogs();
        Logger.debug('LogViewer shown');
    }

    /**
     * 隐藏日志查看器
     */
    hide() {
        this.isVisible = false;
        if (this.container) {
            const viewer = this.container.querySelector('.log-viewer');
            if (viewer) {
                viewer.classList.remove('visible');
                viewer.classList.add('hidden');
            }
        }
        Logger.debug('LogViewer hidden');
    }

    /**
     * 切换显示状态
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 防抖刷新
     */
    debounceRefresh() {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(() => {
            this.refreshLogs();
        }, 300);
    }

    /**
     * HTML转义
     * @param {string} text - 要转义的文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示格式选择对话框
     * @returns {Promise<string|null>} 选择的格式或null
     */
    showFormatSelectionDialog() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'ui-modal ui-format-selection-modal';
            modal.innerHTML = `
                <div class="ui-modal-backdrop"></div>
                <div class="ui-modal-dialog">
                    <div class="ui-modal-content">
                        <div class="ui-modal-header">
                            <h4>选择导出格式</h4>
                        </div>
                        <div class="ui-modal-body">
                            <div class="format-options">
                                <label class="format-option">
                                    <input type="radio" name="format" value="json" checked>
                                    <span>JSON - 结构化数据格式</span>
                                </label>
                                <label class="format-option">
                                    <input type="radio" name="format" value="csv">
                                    <span>CSV - 表格数据格式</span>
                                </label>
                                <label class="format-option">
                                    <input type="radio" name="format" value="txt">
                                    <span>TXT - 纯文本格式</span>
                                </label>
                            </div>
                        </div>
                        <div class="ui-modal-footer">
                            <button class="btn btn-secondary" data-action="cancel">取消</button>
                            <button class="btn btn-primary" data-action="confirm">确定</button>
                        </div>
                    </div>
                </div>
            `;

            // 添加样式
            if (!document.getElementById('format-selection-styles')) {
                const styles = document.createElement('style');
                styles.id = 'format-selection-styles';
                styles.textContent = `
                    .format-options {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .format-option {
                        display: flex;
                        align-items: center;
                        padding: 12px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .format-option:hover {
                        background-color: #f5f5f5;
                    }
                    .format-option input[type="radio"] {
                        margin-right: 8px;
                    }
                `;
                document.head.appendChild(styles);
            }

            // 事件处理
            const handleAction = (action) => {
                if (action === 'confirm') {
                    const selectedFormat = modal.querySelector('input[name="format"]:checked')?.value;
                    resolve(selectedFormat || null);
                } else {
                    resolve(null);
                }
                document.body.removeChild(modal);
            };

            modal.querySelector('[data-action="cancel"]').onclick = () => handleAction('cancel');
            modal.querySelector('[data-action="confirm"]').onclick = () => handleAction('confirm');
            modal.querySelector('.ui-modal-backdrop').onclick = () => handleAction('cancel');

            // 键盘事件
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    handleAction('cancel');
                } else if (e.key === 'Enter') {
                    handleAction('confirm');
                }
            });

            document.body.appendChild(modal);
            setTimeout(() => modal.classList.add('show'), 10);
        });
    }

    /**
     * 销毁日志查看器
     */
    destroy() {
        if (this.eventGroup) {
            this.eventGroup.removeAll();
        }

        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        Logger.debug('LogViewer destroyed');
    }
}
