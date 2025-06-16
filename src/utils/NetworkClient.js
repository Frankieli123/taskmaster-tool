/**
 * 网络请求客户端 - 支持超时、重试和错误处理
 */
export class NetworkClient {
    constructor(options = {}) {
        this.defaultTimeout = options.timeout || 30000; // 30秒默认超时
        this.defaultRetries = options.retries || 3; // 默认重试3次
        this.retryDelay = options.retryDelay || 1000; // 初始重试延迟1秒
        this.maxRetryDelay = options.maxRetryDelay || 10000; // 最大重试延迟10秒
    }

    /**
     * 创建带超时的AbortController
     */
    createTimeoutController(timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);
        
        return { controller, timeoutId };
    }

    /**
     * 计算指数退避延迟
     */
    calculateRetryDelay(attempt) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, this.maxRetryDelay);
    }

    /**
     * 等待指定时间
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 判断错误是否可重试
     */
    isRetryableError(error) {
        // 网络错误、超时错误、5xx服务器错误可重试
        if (error.name === 'AbortError') return true;
        if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
        if (error.status >= 500 && error.status < 600) return true;
        if (error.status === 429) return true; // 速率限制
        if (error.status === 408) return true; // 请求超时
        return false;
    }

    /**
     * 执行带重试的网络请求
     */
    async fetchWithRetry(url, options = {}) {
        const {
            timeout = this.defaultTimeout,
            retries = this.defaultRetries,
            onRetry = null,
            ...fetchOptions
        } = options;

        let lastError;
        
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                // 创建超时控制器
                const { controller, timeoutId } = this.createTimeoutController(timeout);
                
                try {
                    // 执行请求
                    const response = await fetch(url, {
                        ...fetchOptions,
                        signal: controller.signal
                    });
                    
                    // 清除超时
                    clearTimeout(timeoutId);
                    
                    // 检查响应状态
                    if (!response.ok) {
                        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                        error.status = response.status;
                        error.response = response;
                        
                        // 如果是最后一次尝试或错误不可重试，直接抛出
                        if (attempt > retries || !this.isRetryableError(error)) {
                            throw error;
                        }
                        
                        lastError = error;
                    } else {
                        // 请求成功
                        return response;
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);

                    // 处理超时错误
                    let processedError = fetchError;
                    if (fetchError.name === 'AbortError') {
                        const timeoutError = new Error(`请求超时 (${timeout}ms)`);
                        timeoutError.name = 'TimeoutError';
                        timeoutError.timeout = timeout;
                        processedError = timeoutError;
                    }

                    // 如果是最后一次尝试或错误不可重试，直接抛出
                    if (attempt > retries || !this.isRetryableError(processedError)) {
                        throw processedError;
                    }

                    lastError = processedError;
                }
                
                // 如果不是最后一次尝试，等待后重试
                if (attempt <= retries) {
                    const delay = this.calculateRetryDelay(attempt);
                    
                    // 调用重试回调
                    if (onRetry) {
                        onRetry(attempt, delay, lastError);
                    }

                    // 等待重试延迟
                    await this.sleep(delay);
                }
                
            } catch (error) {
                // 如果是最后一次尝试，抛出错误
                if (attempt > retries) {
                    throw error;
                }
                lastError = error;
            }
        }
        
        // 如果所有重试都失败了，抛出最后一个错误
        throw lastError;
    }

    /**
     * GET请求
     */
    async get(url, options = {}) {
        return this.fetchWithRetry(url, {
            method: 'GET',
            ...options
        });
    }

    /**
     * POST请求
     */
    async post(url, data, options = {}) {
        return this.fetchWithRetry(url, {
            method: 'POST',
            body: typeof data === 'string' ? data : JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
    }

    /**
     * PUT请求
     */
    async put(url, data, options = {}) {
        return this.fetchWithRetry(url, {
            method: 'PUT',
            body: typeof data === 'string' ? data : JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
    }

    /**
     * DELETE请求
     */
    async delete(url, options = {}) {
        return this.fetchWithRetry(url, {
            method: 'DELETE',
            ...options
        });
    }

    /**
     * 测试网络连接
     */
    async testConnection(url, options = {}) {
        try {
            const startTime = Date.now();
            const response = await this.get(url, {
                timeout: 10000, // 连接测试使用较短超时
                retries: 1, // 连接测试只重试1次
                ...options
            });
            const duration = Date.now() - startTime;
            
            return {
                success: true,
                status: response.status,
                duration,
                message: `连接成功 (${duration}ms)`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                name: error.name,
                status: error.status,
                message: `连接失败: ${error.message}`
            };
        }
    }

    /**
     * 批量请求（并发控制）
     */
    async batchRequest(requests, options = {}) {
        const { concurrency = 3 } = options;
        const results = [];
        
        // 分批处理请求
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);
            const batchPromises = batch.map(async (request, index) => {
                try {
                    const response = await this.fetchWithRetry(request.url, request.options);
                    return {
                        index: i + index,
                        success: true,
                        response,
                        request
                    };
                } catch (error) {
                    return {
                        index: i + index,
                        success: false,
                        error,
                        request
                    };
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(result => result.value));
        }
        
        return results;
    }

    /**
     * 创建专用于API测试的客户端实例
     */
    static createAPITestClient() {
        return new NetworkClient({
            timeout: 15000,  // API测试使用15秒超时
            retries: 2,      // API测试重试2次
            retryDelay: 2000 // API测试重试延迟2秒
        });
    }

    /**
     * 创建专用于文件操作的客户端实例
     */
    static createFileClient() {
        return new NetworkClient({
            timeout: 60000,  // 文件操作使用60秒超时
            retries: 1,      // 文件操作只重试1次
            retryDelay: 3000 // 文件操作重试延迟3秒
        });
    }
}
