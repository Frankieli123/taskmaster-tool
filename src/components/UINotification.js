/**
 * UINotification.js
 * 统一的用户通知组件
 * 
 * 提供Toast、Modal、Confirm等用户反馈机制，替代原生alert/confirm
 */

export class UINotification {
    // 通知类型
    static Types = {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    };

    // 通知位置
    static Positions = {
        TOP_RIGHT: 'top-right',
        TOP_LEFT: 'top-left',
        BOTTOM_RIGHT: 'bottom-right',
        BOTTOM_LEFT: 'bottom-left',
        TOP_CENTER: 'top-center',
        BOTTOM_CENTER: 'bottom-center'
    };

    // 默认配置
    static config = {
        position: this.Positions.TOP_RIGHT,
        duration: 5000,
        maxToasts: 5,
        enableSound: false,
        enableAnimation: true
    };

    // 活动的通知列表
    static activeToasts = [];
    static toastContainer = null;

    /**
     * 初始化通知系统
     * @param {Object} options - 配置选项
     */
    static init(options = {}) {
        this.config = { ...this.config, ...options };
        this.createToastContainer();
        this.addStyles();
    }

    /**
     * 显示成功通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    static success(message, options = {}) {
        return this.showToast(message, this.Types.SUCCESS, options);
    }

    /**
     * 显示错误通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    static error(message, options = {}) {
        return this.showToast(message, this.Types.ERROR, options);
    }

    /**
     * 显示警告通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    static warning(message, options = {}) {
        return this.showToast(message, this.Types.WARNING, options);
    }

    /**
     * 显示信息通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    static info(message, options = {}) {
        return this.showToast(message, this.Types.INFO, options);
    }

    /**
     * 显示Toast通知
     * @param {string} message - 消息内容
     * @param {string} type - 通知类型
     * @param {Object} options - 选项
     * @returns {Object} Toast对象
     */
    static showToast(message, type = this.Types.INFO, options = {}) {
        const toastOptions = {
            duration: options.duration || this.config.duration,
            closable: options.closable !== false,
            persistent: options.persistent || false,
            onClick: options.onClick,
            onClose: options.onClose
        };

        const toast = this.createToast(message, type, toastOptions);
        this.addToast(toast);
        
        return toast;
    }

    /**
     * 显示确认对话框
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 用户选择结果
     */
    static confirm(message, options = {}) {
        return new Promise((resolve) => {
            const modal = this.createConfirmModal(message, options, resolve);
            document.body.appendChild(modal);
            
            // 显示动画
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        });
    }

    /**
     * 显示提示对话框
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     * @returns {Promise<void>}
     */
    static alert(message, options = {}) {
        return new Promise((resolve) => {
            const modal = this.createAlertModal(message, options, resolve);
            document.body.appendChild(modal);
            
            // 显示动画
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        });
    }

    /**
     * 创建Toast元素
     * @param {string} message - 消息内容
     * @param {string} type - 通知类型
     * @param {Object} options - 选项
     * @returns {Object} Toast对象
     */
    static createToast(message, type, options) {
        const toastId = this.generateId();
        const toastElement = document.createElement('div');
        toastElement.className = `ui-toast ui-toast-${type}`;
        toastElement.setAttribute('data-toast-id', toastId);

        // 创建内容
        const content = document.createElement('div');
        content.className = 'ui-toast-content';
        
        const icon = this.getTypeIcon(type);
        const messageElement = document.createElement('span');
        messageElement.className = 'ui-toast-message';
        messageElement.textContent = message;

        content.appendChild(icon);
        content.appendChild(messageElement);

        // 添加关闭按钮
        if (options.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'ui-toast-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => this.removeToast(toastId);
            content.appendChild(closeBtn);
        }

        toastElement.appendChild(content);

        // 点击事件
        if (options.onClick) {
            toastElement.style.cursor = 'pointer';
            toastElement.onclick = options.onClick;
        }

        const toast = {
            id: toastId,
            element: toastElement,
            type,
            message,
            options,
            createdAt: Date.now()
        };

        // 自动移除
        if (!options.persistent && options.duration > 0) {
            setTimeout(() => {
                this.removeToast(toastId);
            }, options.duration);
        }

        return toast;
    }

    /**
     * 创建确认模态框
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     * @param {Function} resolve - Promise resolve函数
     * @returns {HTMLElement} 模态框元素
     */
    static createConfirmModal(message, options, resolve) {
        const modal = document.createElement('div');
        modal.className = 'ui-modal ui-confirm-modal';

        const backdrop = document.createElement('div');
        backdrop.className = 'ui-modal-backdrop';
        backdrop.onclick = () => {
            if (options.allowBackdropClose !== false) {
                this.closeModal(modal);
                resolve(false);
            }
        };

        const dialog = document.createElement('div');
        dialog.className = 'ui-modal-dialog';

        const content = document.createElement('div');
        content.className = 'ui-modal-content';

        // 标题
        if (options.title) {
            const header = document.createElement('div');
            header.className = 'ui-modal-header';
            header.innerHTML = `<h4>${options.title}</h4>`;
            content.appendChild(header);
        }

        // 消息内容
        const body = document.createElement('div');
        body.className = 'ui-modal-body';
        body.innerHTML = `<p>${message}</p>`;
        content.appendChild(body);

        // 按钮
        const footer = document.createElement('div');
        footer.className = 'ui-modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = options.cancelText || '取消';
        cancelBtn.onclick = () => {
            this.closeModal(modal);
            resolve(false);
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = options.confirmText || '确定';
        confirmBtn.onclick = () => {
            this.closeModal(modal);
            resolve(true);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        content.appendChild(footer);

        dialog.appendChild(content);
        modal.appendChild(backdrop);
        modal.appendChild(dialog);

        return modal;
    }

    /**
     * 创建提示模态框
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     * @param {Function} resolve - Promise resolve函数
     * @returns {HTMLElement} 模态框元素
     */
    static createAlertModal(message, options, resolve) {
        const modal = document.createElement('div');
        modal.className = 'ui-modal ui-alert-modal';

        const backdrop = document.createElement('div');
        backdrop.className = 'ui-modal-backdrop';
        backdrop.onclick = () => {
            if (options.allowBackdropClose !== false) {
                this.closeModal(modal);
                resolve();
            }
        };

        const dialog = document.createElement('div');
        dialog.className = 'ui-modal-dialog';

        const content = document.createElement('div');
        content.className = 'ui-modal-content';

        // 标题
        if (options.title) {
            const header = document.createElement('div');
            header.className = 'ui-modal-header';
            header.innerHTML = `<h4>${options.title}</h4>`;
            content.appendChild(header);
        }

        // 消息内容
        const body = document.createElement('div');
        body.className = 'ui-modal-body';
        body.innerHTML = `<p>${message}</p>`;
        content.appendChild(body);

        // 按钮
        const footer = document.createElement('div');
        footer.className = 'ui-modal-footer';

        const okBtn = document.createElement('button');
        okBtn.className = 'btn btn-primary';
        okBtn.textContent = options.okText || '确定';
        okBtn.onclick = () => {
            this.closeModal(modal);
            resolve();
        };

        footer.appendChild(okBtn);
        content.appendChild(footer);

        dialog.appendChild(content);
        modal.appendChild(backdrop);
        modal.appendChild(dialog);

        return modal;
    }

    /**
     * 添加Toast到容器
     * @param {Object} toast - Toast对象
     */
    static addToast(toast) {
        // 限制Toast数量
        while (this.activeToasts.length >= this.config.maxToasts) {
            const oldestToast = this.activeToasts.shift();
            this.removeToastElement(oldestToast.element);
        }

        this.activeToasts.push(toast);
        this.toastContainer.appendChild(toast.element);

        // 显示动画
        if (this.config.enableAnimation) {
            setTimeout(() => {
                toast.element.classList.add('show');
            }, 10);
        }

        // 触发事件
        this.dispatchToastEvent('toastShown', toast);
    }

    /**
     * 移除Toast
     * @param {string} toastId - Toast ID
     */
    static removeToast(toastId) {
        const toastIndex = this.activeToasts.findIndex(t => t.id === toastId);
        if (toastIndex === -1) return;

        const toast = this.activeToasts[toastIndex];
        
        // 调用关闭回调
        if (toast.options.onClose) {
            toast.options.onClose(toast);
        }

        // 移除动画
        if (this.config.enableAnimation) {
            toast.element.classList.add('hide');
            setTimeout(() => {
                this.removeToastElement(toast.element);
            }, 300);
        } else {
            this.removeToastElement(toast.element);
        }

        this.activeToasts.splice(toastIndex, 1);
        this.dispatchToastEvent('toastHidden', toast);
    }

    /**
     * 移除Toast元素
     * @param {HTMLElement} element - Toast元素
     */
    static removeToastElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * 关闭模态框
     * @param {HTMLElement} modal - 模态框元素
     */
    static closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    /**
     * 创建Toast容器
     */
    static createToastContainer() {
        if (this.toastContainer) return;

        this.toastContainer = document.createElement('div');
        this.toastContainer.className = `ui-toast-container ui-toast-${this.config.position}`;
        document.body.appendChild(this.toastContainer);
    }

    /**
     * 获取类型图标
     * @param {string} type - 通知类型
     * @returns {HTMLElement} 图标元素
     */
    static getTypeIcon(type) {
        const icon = document.createElement('span');
        icon.className = 'ui-toast-icon';
        
        switch (type) {
            case this.Types.SUCCESS:
                icon.innerHTML = '✓';
                break;
            case this.Types.ERROR:
                icon.innerHTML = '✕';
                break;
            case this.Types.WARNING:
                icon.innerHTML = '⚠';
                break;
            case this.Types.INFO:
                icon.innerHTML = 'ℹ';
                break;
            default:
                icon.innerHTML = '•';
        }
        
        return icon;
    }

    /**
     * 添加样式
     */
    static addStyles() {
        if (document.getElementById('ui-notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'ui-notification-styles';
        styles.textContent = `
            .ui-toast-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
            }
            .ui-toast-container.ui-toast-top-right {
                top: 20px;
                right: 20px;
            }
            .ui-toast-container.ui-toast-top-left {
                top: 20px;
                left: 20px;
            }
            .ui-toast-container.ui-toast-bottom-right {
                bottom: 20px;
                right: 20px;
            }
            .ui-toast-container.ui-toast-bottom-left {
                bottom: 20px;
                left: 20px;
            }
            .ui-toast {
                background: white;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                margin-bottom: 10px;
                max-width: 400px;
                opacity: 0;
                pointer-events: auto;
                transform: translateX(100%);
                transition: all 0.3s ease;
            }
            .ui-toast.show {
                opacity: 1;
                transform: translateX(0);
            }
            .ui-toast.hide {
                opacity: 0;
                transform: translateX(100%);
            }
            .ui-toast-content {
                display: flex;
                align-items: center;
                padding: 12px 16px;
            }
            .ui-toast-icon {
                margin-right: 8px;
                font-weight: bold;
                font-size: 16px;
            }
            .ui-toast-success .ui-toast-icon { color: #28a745; }
            .ui-toast-error .ui-toast-icon { color: #dc3545; }
            .ui-toast-warning .ui-toast-icon { color: #ffc107; }
            .ui-toast-info .ui-toast-icon { color: #17a2b8; }
            .ui-toast-message {
                flex: 1;
                font-size: 14px;
            }
            .ui-toast-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                margin-left: 8px;
                opacity: 0.5;
            }
            .ui-toast-close:hover {
                opacity: 1;
            }
            .ui-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .ui-modal.show {
                opacity: 1;
            }
            .ui-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
            }
            .ui-modal-dialog {
                position: relative;
                margin: 50px auto;
                max-width: 500px;
                background: white;
                border-radius: 4px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            .ui-modal-content {
                padding: 0;
            }
            .ui-modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid #dee2e6;
            }
            .ui-modal-header h4 {
                margin: 0;
                font-size: 18px;
            }
            .ui-modal-body {
                padding: 20px;
            }
            .ui-modal-footer {
                padding: 16px 20px;
                border-top: 1px solid #dee2e6;
                text-align: right;
            }
            .ui-modal-footer .btn {
                margin-left: 8px;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * 触发Toast事件
     * @param {string} eventType - 事件类型
     * @param {Object} toast - Toast对象
     */
    static dispatchToastEvent(eventType, toast) {
        const event = new CustomEvent(eventType, {
            detail: toast
        });
        document.dispatchEvent(event);
    }

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    static generateId() {
        return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 清除所有Toast
     */
    static clearAll() {
        this.activeToasts.forEach(toast => {
            this.removeToastElement(toast.element);
        });
        this.activeToasts = [];
    }
}

// 自动初始化
UINotification.init();
