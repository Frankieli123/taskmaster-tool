/**
 * ErrorHandler.js
 * 统一错误处理系统
 *
 * 提供标准化的错误分类、日志记录和用户反馈机制
 */

import { Logger } from './Logger.js';
import { UINotification } from '../components/UINotification.js';

export class ErrorHandler {
    // 错误类型常量
    static ErrorTypes = {
        VALIDATION: 'validation',
        NETWORK: 'network', 
        API: 'api',
        FILE_SYSTEM: 'file_system',
        PERMISSION: 'permission',
        TIMEOUT: 'timeout',
        USER_INPUT: 'user_input',
        SYSTEM: 'system',
        UNKNOWN: 'unknown'
    };

    // 错误严重级别
    static Severity = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    // 用户反馈类型
    static FeedbackType = {
        TOAST: 'toast',
        MODAL: 'modal',
        INLINE: 'inline',
        SILENT: 'silent'
    };

    /**
     * 主要错误处理方法
     * @param {Error|string} error - 错误对象或错误消息
     * @param {Object} context - 错误上下文信息
     * @param {Object} options - 处理选项
     * @returns {Object} 标准化的错误信息
     */
    static handle(error, context = {}, options = {}) {
        const errorInfo = this.categorizeError(error, context);
        
        // 记录错误日志
        this.logError(errorInfo, context);
        
        // 显示用户反馈
        if (options.showUserFeedback !== false) {
            this.showUserFeedback(errorInfo, options.feedbackType);
        }
        
        // 触发错误事件（用于监控和统计）
        this.dispatchErrorEvent(errorInfo);
        
        return errorInfo;
    }

    /**
     * 错误分类和标准化
     * @param {Error|string} error - 原始错误
     * @param {Object} context - 上下文信息
     * @returns {Object} 标准化错误信息
     */
    static categorizeError(error, context = {}) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        // 基础错误信息
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: errorObj.message,
            stack: errorObj.stack,
            context: context,
            type: this.ErrorTypes.UNKNOWN,
            severity: this.Severity.MEDIUM,
            userMessage: '操作失败，请重试',
            actionable: true,
            suggestions: []
        };

        // 根据错误特征进行分类
        this.classifyError(errorInfo, errorObj);
        
        return errorInfo;
    }

    /**
     * 错误分类逻辑
     * @param {Object} errorInfo - 错误信息对象
     * @param {Error} errorObj - 原始错误对象
     */
    static classifyError(errorInfo, errorObj) {
        const message = errorObj.message.toLowerCase();

        // 网络相关错误
        if (message.includes('fetch') || message.includes('network') || 
            message.includes('timeout') || errorObj.name === 'TimeoutError') {
            errorInfo.type = this.ErrorTypes.NETWORK;
            errorInfo.severity = this.Severity.MEDIUM;
            errorInfo.userMessage = '网络连接失败，请检查网络连接后重试';
            errorInfo.suggestions = ['检查网络连接', '稍后重试', '联系管理员'];
        }
        
        // API相关错误
        else if (message.includes('api') || message.includes('401') || 
                 message.includes('403') || message.includes('429')) {
            errorInfo.type = this.ErrorTypes.API;
            errorInfo.severity = this.Severity.HIGH;
            
            if (message.includes('401')) {
                errorInfo.userMessage = 'API密钥无效，请检查配置';
                errorInfo.suggestions = ['检查API密钥', '重新配置服务商'];
            } else if (message.includes('403')) {
                errorInfo.userMessage = 'API访问被拒绝，请检查权限';
                errorInfo.suggestions = ['检查API权限', '联系服务商'];
            } else if (message.includes('429')) {
                errorInfo.userMessage = 'API请求频率过高，请稍后重试';
                errorInfo.suggestions = ['等待一段时间后重试', '减少请求频率'];
            }
        }
        
        // 验证错误
        else if (message.includes('validation') || message.includes('invalid') || 
                 message.includes('required') || message.includes('格式')) {
            errorInfo.type = this.ErrorTypes.VALIDATION;
            errorInfo.severity = this.Severity.LOW;
            errorInfo.userMessage = '输入数据格式不正确，请检查后重试';
            errorInfo.suggestions = ['检查输入格式', '查看帮助文档'];
        }
        
        // 文件系统错误
        else if (message.includes('file') || message.includes('directory') || 
                 message.includes('permission') || message.includes('access')) {
            errorInfo.type = this.ErrorTypes.FILE_SYSTEM;
            errorInfo.severity = this.Severity.MEDIUM;
            errorInfo.userMessage = '文件操作失败，请检查文件权限';
            errorInfo.suggestions = ['检查文件权限', '选择其他位置', '联系管理员'];
        }
        
        // 权限错误
        else if (message.includes('permission') || message.includes('denied') || 
                 message.includes('unauthorized')) {
            errorInfo.type = this.ErrorTypes.PERMISSION;
            errorInfo.severity = this.Severity.HIGH;
            errorInfo.userMessage = '权限不足，无法执行此操作';
            errorInfo.suggestions = ['检查权限设置', '联系管理员'];
        }
        
        // 用户输入错误
        else if (message.includes('用户') || message.includes('取消') || 
                 message.includes('abort')) {
            errorInfo.type = this.ErrorTypes.USER_INPUT;
            errorInfo.severity = this.Severity.LOW;
            errorInfo.userMessage = '操作已取消';
            errorInfo.actionable = false;
            errorInfo.suggestions = [];
        }
    }

    /**
     * 记录错误日志
     * @param {Object} errorInfo - 错误信息
     * @param {Object} context - 上下文信息
     */
    static logError(errorInfo, context) {
        const logMessage = this.formatLogMessage(errorInfo, context);
        const logContext = {
            ...context,
            errorId: errorInfo.id,
            errorType: errorInfo.type,
            severity: errorInfo.severity,
            timestamp: errorInfo.timestamp
        };

        // 根据严重级别选择Logger方法
        switch (errorInfo.severity) {
            case this.Severity.CRITICAL:
            case this.Severity.HIGH:
                Logger.error(logMessage, logContext, {
                    name: 'ErrorHandler',
                    message: errorInfo.message,
                    stack: errorInfo.stack
                });
                break;
            case this.Severity.MEDIUM:
                Logger.warn(logMessage, logContext);
                break;
            case this.Severity.LOW:
                Logger.info(logMessage, logContext);
                break;
            default:
                Logger.debug(logMessage, logContext);
        }
    }

    /**
     * 显示用户反馈
     * @param {Object} errorInfo - 错误信息
     * @param {string} feedbackType - 反馈类型
     */
    static showUserFeedback(errorInfo, feedbackType) {
        // 如果是用户取消操作，不显示错误提示
        if (errorInfo.type === this.ErrorTypes.USER_INPUT) {
            return;
        }

        const type = feedbackType || this.getDefaultFeedbackType(errorInfo.severity);
        
        switch (type) {
            case this.FeedbackType.TOAST:
                this.showToast(errorInfo);
                break;
            case this.FeedbackType.MODAL:
                this.showModal(errorInfo);
                break;
            case this.FeedbackType.INLINE:
                this.showInlineError(errorInfo);
                break;
            case this.FeedbackType.SILENT:
                // 静默处理，只记录日志
                break;
        }
    }

    /**
     * 显示Toast通知
     * @param {Object} errorInfo - 错误信息
     */
    static showToast(errorInfo) {
        // 检查是否有全局Toast系统
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(errorInfo.userMessage, 'error');
        } else {
            // 降级到简单的Toast实现
            this.createSimpleToast(errorInfo.userMessage, 'error');
        }
    }

    /**
     * 创建简单的Toast通知
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型
     */
    static createSimpleToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `error-toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: type === 'error' ? '#dc3545' : '#28a745',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: '10000',
            maxWidth: '400px',
            fontSize: '14px',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(toast);

        // 显示动画
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    /**
     * 显示模态错误对话框
     * @param {Object} errorInfo - 错误信息
     */
    static showModal(errorInfo) {
        // 使用UINotification组件显示错误模态框
        UINotification.alert(errorInfo.userMessage, {
            title: '错误',
            okText: '确定'
        });
    }

    /**
     * 显示内联错误
     * @param {Object} errorInfo - 错误信息
     */
    static showInlineError(errorInfo) {
        // 查找错误容器
        const errorContainer = document.querySelector('.error-container') || 
                              document.querySelector('.validation-errors');
        
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert alert-error">
                    <strong>错误:</strong> ${errorInfo.userMessage}
                    ${errorInfo.suggestions.length > 0 ? 
                        `<ul>${errorInfo.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>` : 
                        ''}
                </div>
            `;
        }
    }

    /**
     * 触发错误事件
     * @param {Object} errorInfo - 错误信息
     */
    static dispatchErrorEvent(errorInfo) {
        const event = new CustomEvent('errorOccurred', {
            detail: errorInfo
        });
        document.dispatchEvent(event);
    }

    // 辅助方法
    static generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    static getLogLevel(severity) {
        switch (severity) {
            case this.Severity.CRITICAL:
            case this.Severity.HIGH:
                return 'error';
            case this.Severity.MEDIUM:
                return 'warn';
            case this.Severity.LOW:
                return 'info';
            default:
                return 'log';
        }
    }

    static getDefaultFeedbackType(severity) {
        switch (severity) {
            case this.Severity.CRITICAL:
                return this.FeedbackType.MODAL;
            case this.Severity.HIGH:
            case this.Severity.MEDIUM:
                return this.FeedbackType.TOAST;
            case this.Severity.LOW:
                return this.FeedbackType.INLINE;
            default:
                return this.FeedbackType.TOAST;
        }
    }

    static formatLogMessage(errorInfo, context) {
        const contextStr = Object.keys(context).length > 0 ? 
            ` [${Object.entries(context).map(([k, v]) => `${k}:${v}`).join(', ')}]` : '';
        
        return `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}${contextStr}`;
    }

    static isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:';
    }
}

// 全局错误处理器
window.addEventListener('error', (event) => {
    ErrorHandler.handle(event.error, {
        source: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
    ErrorHandler.handle(event.reason, {
        source: 'unhandledPromise',
        type: 'promise_rejection'
    });
});
