/**
 * ProviderValidator.js
 * Comprehensive validation logic for API providers
 */

import { NetworkClient } from './NetworkClient.js';

export class ProviderValidator {
    constructor() {
        // 创建专用的API测试网络客户端
        this.networkClient = NetworkClient.createAPITestClient();

        // 简化的服务商配置 - 移除所有端点和API密钥模式验证
        this.providerPatterns = {
            'openai': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'anthropic': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'google': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'polo': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'poloai': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'foapi': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'openrouter': {
                requiredFields: ['name', 'endpoint', 'apiKey', 'type']
            },
            'custom': {
                requiredFields: ['name', 'endpoint', 'type']
            }
        };
    }

    /**
     * Validate a provider configuration
     * @param {Object} provider - Provider configuration object
     * @returns {Object} Validation result with isValid and errors
     */
    validateProvider(provider) {
        const errors = [];
        
        // Basic structure validation
        if (!provider || typeof provider !== 'object') {
            return { isValid: false, errors: ['服务商必须是一个对象'] };
        }

        // Required fields validation
        const requiredFields = ['name', 'endpoint', 'type'];
        const fieldNames = { name: '名称', endpoint: '端点', type: '类型' };
        for (const field of requiredFields) {
            if (!provider[field] || typeof provider[field] !== 'string' || provider[field].trim() === '') {
                errors.push(`${fieldNames[field]}是必填项且必须是非空字符串`);
            }
        }

        if (errors.length > 0) {
            return { isValid: false, errors };
        }

        // 移除所有格式验证，不再检查服务商名称、端点和类型格式

        // API Key validation (if provided)
        if (provider.apiKey) {
            const apiKeyValidation = this.validateApiKey(provider.apiKey, provider.type);
            if (!apiKeyValidation.isValid) {
                errors.push(...apiKeyValidation.errors);
            }
        } else if (provider.type !== 'custom') {
            // API key is required for non-custom providers
            errors.push('此服务商类型需要API密钥');
        }

        // Type-specific validation
        if (provider.type && this.providerPatterns[provider.type]) {
            const typeValidation = this.validateProviderType(provider, provider.type);
            if (!typeValidation.isValid) {
                errors.push(...typeValidation.errors);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 已移除端点和API密钥格式验证
     */
    validateEndpoint(_endpoint) {
        return { isValid: true, errors: [] };
    }

    validateApiKey(_apiKey, _providerType) {
        return { isValid: true, errors: [] };
    }

    /**
     * Validate provider against type-specific requirements
     * @param {Object} provider - Provider object
     * @param {string} type - Provider type
     * @returns {Object} Validation result
     */
    validateProviderType(provider, type) {
        const errors = [];
        const pattern = this.providerPatterns[type];

        if (!pattern) {
            return { isValid: true, errors: [] };
        }

        // Check required fields for this type
        const fieldNames = { name: '名称', endpoint: '端点', apiKey: 'API密钥', type: '类型' };
        for (const field of pattern.requiredFields) {
            if (!provider[field]) {
                errors.push(`${fieldNames[field] || field}是${type}服务商的必填项`);
            }
        }

        // 移除端点URL模式匹配验证 - 允许用户使用任意端点

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate provider models configuration
     * @param {Array} models - Array of model configurations
     * @returns {Object} Validation result
     */
    validateProviderModels(models) {
        const errors = [];

        if (!Array.isArray(models)) {
            return { isValid: false, errors: ['模型必须是数组'] };
        }

        models.forEach((model, index) => {
            if (!model.id || typeof model.id !== 'string') {
                errors.push(`模型 ${index + 1}: ID是必填项且必须是字符串`);
            }

            if (model.swe_score !== null && model.swe_score !== undefined) {
                if (typeof model.swe_score !== 'number' || model.swe_score < 0 || model.swe_score > 1) {
                    errors.push(`模型 ${index + 1}: SWE评分必须是0到1之间的数字`);
                }
            }

            if (model.max_tokens && (typeof model.max_tokens !== 'number' || model.max_tokens < 1)) {
                errors.push(`模型 ${index + 1}: 最大令牌数必须是正数`);
            }

            if (model.allowed_roles && !Array.isArray(model.allowed_roles)) {
                errors.push(`模型 ${index + 1}: 允许角色必须是数组`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Test provider connection (basic validation)
     * @param {Object} provider - Provider configuration
     * @returns {Promise<Object>} Test result
     */
    async testProviderConnection(provider) {
        try {
            // First validate the provider configuration
            const validation = this.validateProvider(provider);
            if (!validation.isValid) {
                return {
                    isValid: false,
                    errors: validation.errors
                };
            }

            // Perform real API test based on provider type
            const apiTest = await this.performRealApiTest(provider);

            return {
                isValid: apiTest.isValid,
                errors: apiTest.errors,
                message: apiTest.message,
                details: apiTest.details
            };

        } catch (error) {
            return {
                isValid: false,
                errors: [`连接测试失败: ${error.message}`]
            };
        }
    }

    /**
     * Perform real API test for different provider types
     * @param {Object} provider - Provider configuration
     * @returns {Promise<Object>} API test result
     */
    async performRealApiTest(provider) {
        const testStartTime = Date.now();

        try {
            let testResult;

            switch (provider.type) {
                case 'openai':
                case 'foapi':
                case 'poloai':
                    testResult = await this.testOpenAICompatibleAPI(provider);
                    break;
                case 'anthropic':
                    testResult = await this.testAnthropicAPI(provider);
                    break;
                case 'google':
                case 'polo':
                    testResult = await this.testGoogleAPI(provider);
                    break;
                case 'custom':
                    testResult = await this.testCustomAPI(provider);
                    break;
                default:
                    testResult = await this.testGenericAPI(provider);
            }

            const testDuration = Date.now() - testStartTime;
            testResult.details = {
                ...testResult.details,
                duration: testDuration,
                timestamp: new Date().toISOString()
            };

            return testResult;

        } catch (error) {
            return {
                isValid: false,
                errors: [`API测试失败: ${error.message}`],
                message: 'API连接测试失败',
                details: {
                    duration: Date.now() - testStartTime,
                    timestamp: new Date().toISOString(),
                    error: error.message
                }
            };
        }
    }

    /**
     * Test OpenAI compatible API (OpenAI, FoApi, etc.)
     */
    async testOpenAICompatibleAPI(provider) {
        try {
            const endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/models';

            const response = await this.networkClient.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json'
                },
                onRetry: () => {
                    // API重试中
                }
            });

            const data = await response.json();
            return {
                isValid: true,
                errors: [],
                message: `✅ ${provider.name} API连接成功`,
                details: {
                    status: response.status,
                    modelsCount: data.data?.length || 0,
                    endpoint: endpoint
                }
            };
        } catch (error) {
            // 根据错误类型提供更详细的错误信息
            let errorMessage = error.message;
            let errorType = 'network';
            const endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/models';

            if (error.name === 'TimeoutError') {
                errorMessage = `请求超时 (${error.timeout}ms)`;
                errorType = 'timeout';
            } else if (error.status === 401) {
                errorMessage = 'API密钥无效或已过期';
                errorType = 'auth';
            } else if (error.status === 403) {
                errorMessage = 'API访问被拒绝，请检查权限';
                errorType = 'permission';
            } else if (error.status === 429) {
                errorMessage = 'API请求频率限制，请稍后重试';
                errorType = 'rate_limit';
            } else if (error.status >= 500) {
                errorMessage = `服务器错误 (${error.status})`;
                errorType = 'server';
            }

            return {
                isValid: false,
                errors: [`${errorMessage}`],
                message: `❌ ${provider.name} 连接失败`,
                details: {
                    error: error.message,
                    errorType,
                    status: error.status,
                    endpoint: endpoint
                }
            };
        }
    }

    /**
     * Test Anthropic API
     */
    async testAnthropicAPI(provider) {
        try {
            const endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/messages';

            const response = await this.networkClient.post(endpoint, {
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'test' }]
            }, {
                headers: {
                    'x-api-key': provider.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                onRetry: () => {
                    // API重试中
                }
            });

            return {
                isValid: true,
                errors: [],
                message: `✅ ${provider.name} API连接成功`,
                details: {
                    status: response.status,
                    endpoint: endpoint
                }
            };
        } catch (error) {
            // Anthropic API可能返回400状态码作为正常响应
            const endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/messages';

            if (error.status === 400) {
                return {
                    isValid: true,
                    errors: [],
                    message: `✅ ${provider.name} API连接成功`,
                    details: {
                        status: error.status,
                        endpoint: endpoint,
                        note: '400状态码在测试消息中是预期的'
                    }
                };
            }

            // 处理其他错误
            let errorMessage = error.message;
            let errorType = 'network';

            if (error.name === 'TimeoutError') {
                errorMessage = `请求超时 (${error.timeout}ms)`;
                errorType = 'timeout';
            } else if (error.status === 401) {
                errorMessage = 'API密钥无效或已过期';
                errorType = 'auth';
            } else if (error.status === 403) {
                errorMessage = 'API访问被拒绝，请检查权限';
                errorType = 'permission';
            } else if (error.status === 429) {
                errorMessage = 'API请求频率限制，请稍后重试';
                errorType = 'rate_limit';
            }

            return {
                isValid: false,
                errors: [`${errorMessage}`],
                message: `❌ ${provider.name} 连接失败`,
                details: {
                    error: error.message,
                    errorType,
                    status: error.status,
                    endpoint: endpoint
                }
            };
        }
    }

    /**
     * Test Google/Polo API
     */
    async testGoogleAPI(provider) {
        try {
            // For Google/Polo, we'll try a simple request
            const endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/models';

            const response = await this.networkClient.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json'
                },
                onRetry: () => {
                    // API重试中
                }
            });

            const data = await response.json();
            return {
                isValid: true,
                errors: [],
                message: `✅ ${provider.name} API连接成功`,
                details: {
                    status: response.status,
                    modelsCount: data.models?.length || 0,
                    endpoint: endpoint
                }
            };
        } catch (error) {
            let errorMessage = error.message;
            let errorType = 'network';
            const endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/models';

            if (error.name === 'TimeoutError') {
                errorMessage = `请求超时 (${error.timeout}ms)`;
                errorType = 'timeout';
            } else if (error.status === 401) {
                errorMessage = 'API密钥无效或已过期';
                errorType = 'auth';
            } else if (error.status === 403) {
                errorMessage = 'API访问被拒绝，请检查权限';
                errorType = 'permission';
            } else if (error.status === 429) {
                errorMessage = 'API请求频率限制，请稍后重试';
                errorType = 'rate_limit';
            }

            return {
                isValid: false,
                errors: [`${errorMessage}`],
                message: `❌ ${provider.name} 连接失败`,
                details: {
                    error: error.message,
                    errorType,
                    status: error.status,
                    endpoint: endpoint
                }
            };
        }
    }

    /**
     * Test Custom API
     */
    async testCustomAPI(provider) {
        try {
            // For custom APIs, we'll try a basic connectivity test
            const response = await this.networkClient.get(provider.endpoint, {
                headers: {
                    'Authorization': `Bearer ${provider.apiKey || ''}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000, // 自定义API使用较短超时
                retries: 1,     // 自定义API只重试1次
                onRetry: () => {
                    // API重试中
                }
            });

            return {
                isValid: true,
                errors: [],
                message: `✅ ${provider.name} 连接成功`,
                details: {
                    status: response.status,
                    endpoint: provider.endpoint
                }
            };
        } catch (error) {
            let errorMessage = error.message;
            let errorType = 'network';

            if (error.name === 'TimeoutError') {
                errorMessage = `连接超时 (${error.timeout}ms)`;
                errorType = 'timeout';
            } else if (error.status === 404) {
                errorMessage = '端点不存在，请检查URL';
                errorType = 'not_found';
            } else if (error.status >= 500) {
                errorMessage = `服务器错误 (${error.status})`;
                errorType = 'server';
            }

            return {
                isValid: false,
                errors: [`${errorMessage}`],
                message: `❌ ${provider.name} 连接失败`,
                details: {
                    error: error.message,
                    errorType,
                    status: error.status,
                    endpoint: provider.endpoint
                }
            };
        }
    }

    /**
     * Test Generic API
     */
    async testGenericAPI(provider) {
        // Fallback to basic endpoint validation
        const urlValidation = this.validateEndpoint(provider.endpoint);

        return {
            isValid: urlValidation.isValid,
            errors: urlValidation.errors,
            message: urlValidation.isValid ? `✅ ${provider.name} 配置有效` : `❌ ${provider.name} 配置无效`,
            details: {
                endpoint: provider.endpoint,
                note: '仅进行了基础验证，未测试实际API连接'
            }
        };
    }

    /**
     * 已移除基于端点的服务商类型建议功能
     */
    suggestProviderType(_endpoint) {
        // 不再基于端点URL进行服务商类型建议
        return [];
    }
}
