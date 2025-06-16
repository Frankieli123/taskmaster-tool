/* eslint-disable no-console */
/**
 * Logger.js
 * 统一日志管理系统
 *
 * 提供结构化的日志记录，支持不同级别和格式化输出
 */

export class Logger {
    // 日志级别常量
    static Levels = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
        TRACE: 4
    };

    // 日志级别名称
    static LevelNames = {
        0: 'ERROR',
        1: 'WARN',
        2: 'INFO',
        3: 'DEBUG',
        4: 'TRACE'
    };

    // 日志颜色配置
    static Colors = {
        ERROR: '#dc3545',
        WARN: '#ffc107',
        INFO: '#17a2b8',
        DEBUG: '#6c757d',
        TRACE: '#6f42c1'
    };

    // 默认配置
    static config = {
        level: this.Levels.INFO,
        enableConsole: true,
        enableStorage: false,
        maxStorageEntries: 1000,
        timestampFormat: 'ISO',
        includeStackTrace: false
    };

    // 日志存储
    static logs = [];

    // 防止递归的标志
    static isDispatching = false;

    /**
     * 初始化Logger
     * @param {Object} options - 配置选项
     */
    static init(options = {}) {
        this.config = { ...this.config, ...options };
        
        // 根据环境设置默认日志级别
        if (this.isDevelopment()) {
            this.config.level = this.Levels.DEBUG;
            this.config.includeStackTrace = true;
        } else {
            this.config.level = this.Levels.WARN;
        }

        this.info('Logger initialized', { config: this.config });
    }

    /**
     * 错误级别日志
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     * @param {Error} error - 错误对象
     */
    static error(message, context = {}, error = null) {
        this.log(this.Levels.ERROR, message, context, error);
    }

    /**
     * 警告级别日志
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     */
    static warn(message, context = {}) {
        this.log(this.Levels.WARN, message, context);
    }

    /**
     * 信息级别日志
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     */
    static info(message, context = {}) {
        this.log(this.Levels.INFO, message, context);
    }

    /**
     * 调试级别日志
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     */
    static debug(message, context = {}) {
        this.log(this.Levels.DEBUG, message, context);
    }

    /**
     * 跟踪级别日志
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     */
    static trace(message, context = {}) {
        this.log(this.Levels.TRACE, message, context);
    }

    /**
     * 核心日志方法
     * @param {number} level - 日志级别
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     * @param {Error} error - 错误对象
     */
    static log(level, message, context = {}, error = null) {
        const logEntry = this.createLogEntry(level, message, context, error);

        // 始终存储日志（不受级别限制）
        if (this.config.enableStorage) {
            this.storeLog(logEntry);
        }

        // 始终触发日志事件（不受级别限制）
        this.dispatchLogEvent(logEntry);

        // 只有符合级别的才输出到控制台
        if (level <= this.config.level) {
            if (this.config.enableConsole) {
                this.outputToConsole(logEntry);
            }
        }
    }

    /**
     * 创建日志条目
     * @param {number} level - 日志级别
     * @param {string} message - 日志消息
     * @param {Object} context - 上下文数据
     * @param {Error} error - 错误对象
     * @returns {Object} 日志条目
     */
    static createLogEntry(level, message, context, error) {
        const timestamp = this.getTimestamp();
        const levelName = this.LevelNames[level];
        
        const logEntry = {
            id: this.generateLogId(),
            timestamp,
            level,
            levelName,
            message,
            context: { ...context },
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // 添加错误信息
        if (error) {
            logEntry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        // 添加堆栈跟踪（调试模式）
        if (this.config.includeStackTrace && level <= this.Levels.WARN) {
            logEntry.stackTrace = new Error().stack;
        }

        return logEntry;
    }

    /**
     * 输出到控制台
     * @param {Object} logEntry - 日志条目
     */
    static outputToConsole(logEntry) {
        const { levelName, timestamp, message, context, error } = logEntry;
        const color = this.Colors[levelName];
        
        // 格式化时间戳
        const timeStr = this.formatTimestamp(timestamp);
        
        // 构建日志消息
        const logMessage = `[${timeStr}] [${levelName}] ${message}`;
        
        // 选择控制台方法
        const consoleMethod = this.getConsoleMethod(logEntry.level);
        
        // 输出主要消息
        if (color && consoleMethod === console.log) {
            console.log(`%c${logMessage}`, `color: ${color}; font-weight: bold;`);
        } else {
            consoleMethod(logMessage);
        }

        // 输出上下文数据
        if (Object.keys(context).length > 0) {
            console.log('Context:', context);
        }

        // 输出错误信息
        if (error) {
            console.error('Error details:', error);
        }
    }

    /**
     * 存储日志
     * @param {Object} logEntry - 日志条目
     */
    static storeLog(logEntry) {
        this.logs.push(logEntry);
        
        // 限制存储数量
        if (this.logs.length > this.config.maxStorageEntries) {
            this.logs = this.logs.slice(-this.config.maxStorageEntries);
        }

        // 可选：持久化到localStorage
        if (this.config.persistToStorage) {
            try {
                localStorage.setItem('app_logs', JSON.stringify(this.logs.slice(-100)));
            } catch (e) {
                // 存储失败，忽略
            }
        }
    }

    /**
     * 触发日志事件
     * @param {Object} logEntry - 日志条目
     */
    static dispatchLogEvent(logEntry) {
        // 防止递归调用
        if (this.isDispatching) {
            return;
        }

        try {
            this.isDispatching = true;
            const event = new CustomEvent('logEntry', {
                detail: logEntry
            });
            document.dispatchEvent(event);
        } finally {
            this.isDispatching = false;
        }
    }

    /**
     * 获取控制台方法
     * @param {number} level - 日志级别
     * @returns {Function} 控制台方法
     */
    static getConsoleMethod(level) {
        switch (level) {
            case this.Levels.ERROR:
                return console.error;
            case this.Levels.WARN:
                return console.warn;
            case this.Levels.INFO:
                return console.info;
            case this.Levels.DEBUG:
            case this.Levels.TRACE:
                return console.log;
            default:
                return console.log;
        }
    }

    /**
     * 获取时间戳
     * @returns {string} 时间戳
     */
    static getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * 格式化时间戳
     * @param {string} timestamp - ISO时间戳
     * @returns {string} 格式化的时间
     */
    static formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    /**
     * 生成日志ID
     * @returns {string} 唯一ID
     */
    static generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * 检查是否为开发环境
     * @returns {boolean} 是否为开发环境
     */
    static isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:';
    }

    /**
     * 设置日志级别
     * @param {number} level - 日志级别
     */
    static setLevel(level) {
        this.config.level = level;
        this.info(`Log level changed to ${this.LevelNames[level]}`);
    }

    /**
     * 获取存储的日志
     * @param {Object} filters - 过滤条件
     * @returns {Array} 日志数组
     */
    static getLogs(filters = {}) {
        let filteredLogs = [...this.logs];

        // 按级别过滤 - 注意：这里不受Logger当前级别限制，显示所有存储的日志
        if (filters.level !== undefined) {
            filteredLogs = filteredLogs.filter(log => log.level === filters.level);
        }

        // 按时间范围过滤
        if (filters.since) {
            const sinceTime = new Date(filters.since).getTime();
            filteredLogs = filteredLogs.filter(log =>
                new Date(log.timestamp).getTime() >= sinceTime
            );
        }

        // 按消息内容过滤
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredLogs = filteredLogs.filter(log =>
                log.message.toLowerCase().includes(searchTerm)
            );
        }

        return filteredLogs;
    }

    /**
     * 清空日志
     */
    static clearLogs() {
        this.logs = [];
        if (this.config.persistToStorage) {
            localStorage.removeItem('app_logs');
        }
        this.info('Logs cleared');
    }

    /**
     * 导出日志
     * @param {string} format - 导出格式 ('json' | 'csv' | 'txt')
     * @returns {string} 导出的日志数据
     */
    static exportLogs(format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(this.logs, null, 2);
            case 'csv':
                return this.logsToCSV();
            case 'txt':
                return this.logsToText();
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * 将日志转换为CSV格式
     * @returns {string} CSV格式的日志
     */
    static logsToCSV() {
        if (this.logs.length === 0) return '';
        
        const headers = ['timestamp', 'level', 'message', 'context'];
        const rows = this.logs.map(log => [
            log.timestamp,
            log.levelName,
            log.message,
            JSON.stringify(log.context)
        ]);
        
        return [headers, ...rows].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    /**
     * 将日志转换为文本格式
     * @returns {string} 文本格式的日志
     */
    static logsToText() {
        return this.logs.map(log => {
            const timeStr = this.formatTimestamp(log.timestamp);
            let line = `[${timeStr}] [${log.levelName}] ${log.message}`;
            
            if (Object.keys(log.context).length > 0) {
                line += ` | Context: ${JSON.stringify(log.context)}`;
            }
            
            return line;
        }).join('\n');
    }
}

// 自动初始化
Logger.init();
