/**
 * ConfigTransformer.js
 * Handles bidirectional transformation between UI tool format and TaskMaster format
 */

export class ConfigTransformer {
    constructor() {
        // Provider type mappings (扩展支持更多供应商)
        this.providerTypeMap = {
            'openai': 'openai',
            'anthropic': 'anthropic',
            'google': 'google',
            'polo': 'openai',
            'aoapi': 'openai',
            'perplexity': 'openai',
            'xai': 'openai',
            'openrouter': 'openai',
            'ollama': 'custom',
            '': 'openai',
            't': 'openai',
            'whi': 'openai'
        };

        // 不再使用默认端点，完全由用户配置或实际配置决定
    }

    /**
     * Transform UI configuration to TaskMaster format
     * @param {Array} providers - UI providers array
     * @param {Array} models - UI models array
     * @returns {Object} TaskMaster configuration object
     */
    uiToTaskMaster(providers, models) {
        const result = {
            supportedModels: {}
            // 不再生成 config.json，由用户通过 TaskMaster 初始化流程管理
        };

        // Group models by provider and build supported-models.json structure
        providers.forEach(provider => {
            const providerModels = models.filter(model => model.providerId === provider.id);
            const providerKey = this.getProviderKey(provider);

            // 总是创建供应商条目，即使没有模型也创建空数组
            if (providerModels.length > 0) {
                result.supportedModels[providerKey] = providerModels.map(model => ({
                    id: model.modelId, // 使用带前缀的模型ID，如 foapi-gpt-4o
                    swe_score: model.sweScore ? model.sweScore / 100 : null,
                    cost_per_1m_tokens: {
                        input: model.costPer1MTokens?.input || 0,
                        output: model.costPer1MTokens?.output || 0
                    },
                    allowed_roles: model.allowedRoles || ["main", "fallback"],
                    max_tokens: model.maxTokens || 200000
                }));
            } else {
                // 没有模型的供应商也创建空数组，为后续添加模型做准备
                result.supportedModels[providerKey] = [];
            }
        });

        // 不再生成 config.json 内容
        // config.json 由用户通过 TaskMaster 初始化流程（task-master init）管理

        return result;
    }

    /**
     * Transform TaskMaster configuration to UI format
     * @param {Object} taskMasterConfig - TaskMaster configuration object
     * @returns {Promise<Object>} UI configuration object with providers and models arrays
     */
    async taskMasterToUi(taskMasterConfig) {
        const providers = [];
        const models = [];
        const providerIdMap = new Map(); // Map provider keys to generated IDs

        // Extract providers from supported models and config
        const supportedModels = taskMasterConfig.supportedModels || {};
        const config = taskMasterConfig.config || {};
        const configProviders = config.providers || {};

        // Create providers from supported models
        for (const providerKey of Object.keys(supportedModels)) {
            const providerId = this.generateId('provider');
            providerIdMap.set(providerKey, providerId);

            const configProvider = configProviders[providerKey] || {};

            const provider = {
                id: providerId,
                name: configProvider.name || this.getProviderDisplayName(providerKey),
                endpoint: configProvider.endpoint || '', // 不使用默认端点，以实际配置为准
                type: configProvider.type || this.getProviderType(providerKey),
                apiKey: configProvider.apiKey || '',
                isValid: !!configProvider.apiKey
            };
            providers.push(provider);

            // Create models for this provider
            const providerModels = supportedModels[providerKey];
            for (const modelData of providerModels) {
                const modelDisplayName = await this.getModelDisplayName(modelData.id);
                const model = {
                    id: this.generateId('model'),
                    name: modelDisplayName,
                    providerId: providerId,
                    modelId: modelData.id,
                    sweScore: modelData.swe_score ? modelData.swe_score * 100 : null,
                    maxTokens: modelData.max_tokens || 200000,
                    costPer1MTokens: {
                        input: modelData.cost_per_1m_tokens?.input || 0,
                        output: modelData.cost_per_1m_tokens?.output || 0
                    },
                    allowedRoles: modelData.allowed_roles || ["main", "fallback"]
                };
                models.push(model);
            }
        }

        return { providers, models };
    }

    /**
     * Get provider key from provider object
     * @param {Object} provider - Provider object
     * @returns {string} Provider key
     */
    getProviderKey(provider) {
        // Convert provider name to key format (lowercase, no special chars)
        return provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Get provider display name from key
     * @param {string} providerKey - Provider key
     * @returns {string} Display name
     */
    getProviderDisplayName(providerKey) {
        const nameMap = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google',
            'polo': 'PoloAI',
            'aoapi': 'AoApi',
            'perplexity': 'Perplexity',
            'xai': 'xAI',
            'openrouter': 'OpenRouter',
            'ollama': 'Ollama',
            '': '',
            't': 'T',
            'whi': 'whi'
        };
        return nameMap[providerKey] || providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
    }



    /**
     * Get provider type from key
     * @param {string} providerKey - Provider key
     * @returns {string} Provider type
     */
    getProviderType(providerKey) {
        return this.providerTypeMap[providerKey] || 'openai';
    }

    /**
     * Get model display name from model ID by using provider's mapModelId method
     * @param {string} modelId - Model ID
     * @returns {string} Display name (actual API model name)
     */
    async getModelDisplayName(modelId) {
        // Extract a display name from model ID
        const parts = modelId.split('/');
        const name = parts[parts.length - 1];

        // 直接从模型ID中提取供应商前缀
        const dashIndex = name.indexOf('-');
        if (dashIndex > 0) {
            const providerName = name.substring(0, dashIndex);
            // 使用通用前缀去除逻辑
            return this.getBuiltinModelMapping(name, providerName);
        }

        // 如果没有前缀，直接返回原始模型ID
        return name;
    }

    /**
     * Get built-in model mapping for known providers
     * @param {string} modelId - Model ID
     * @param {string} providerName - Provider name
     * @returns {string} Mapped model name
     */
    getBuiltinModelMapping(modelId, providerName) {
        // 通用的前缀去除逻辑，适用于所有提供商
        if (providerName) {
            const providerPrefix = providerName.toLowerCase() + '-';
            if (modelId.startsWith(providerPrefix)) {
                return modelId.replace(providerPrefix, '');
            }
        }

        // 如果没有匹配的前缀，返回原始模型ID
        return modelId;
    }

    /**
     * Load provider module dynamically
     * @param {string} providerName - Provider name
     * @returns {Object|null} Provider module or null if failed
     */
    async loadProviderModule(providerName) {
        try {
            // 构建提供商文件路径 - 使用绝对路径从项目根目录
            const providerPath = `/src/ai-providers/${providerName}.js`;
            const module = await import(/* @vite-ignore */ providerPath);

            // 获取提供商类
            const providerClassName = this.getProviderClassName(providerName);
            const ProviderClass = module[providerClassName];

            if (ProviderClass) {
                // 创建提供商实例
                const providerInstance = new ProviderClass();
                return providerInstance;
            }
        } catch (error) {
            // 静默处理错误，避免控制台警告
            // console.warn(`Failed to import provider module ${providerName}:`, error);
        }

        return null;
    }

    /**
     * Get provider class name from provider name
     * @param {string} providerName - Provider name
     * @returns {string} Provider class name
     */
    getProviderClassName(providerName) {
        const classNameMap = {
            'foapi': 'FoapiProvider',
            'poloai': 'PoloAIProvider',
            'polo': 'PoloAIProvider',
            'aoapi': 'AoapiProvider',
            'perplexity': 'PerplexityAIProvider',
            'xai': 'XAIProvider',
            'openrouter': 'OpenRouterAIProvider',
            'whi': 'WhiProvider',
            't': 'TProvider',
            'openai': 'OpenAIProvider',
            'anthropic': 'AnthropicAIProvider',
            'google': 'GoogleAIProvider'
        };

        return classNameMap[providerName] || `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
    }

    /**
     * Test model display name mapping (for debugging)
     * @param {string} modelId - Model ID to test
     * @returns {Promise<string>} Mapped model name
     */
    async testModelDisplayName(modelId) {
        console.log(`Testing model display name for: ${modelId}`);
        const result = await this.getModelDisplayName(modelId);
        console.log(`Result: ${result}`);
        return result;
    }

    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Generated ID
     */
    generateId(prefix = 'item') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Validate UI configuration
     * @param {Array} providers - Providers array
     * @param {Array} models - Models array
     * @returns {Object} Validation result
     */
    validateUiConfig(providers, models) {
        const errors = [];

        // Validate providers
        providers.forEach((provider, index) => {
            if (!provider.name) errors.push(`Provider ${index + 1}: Name is required`);
            if (!provider.endpoint) errors.push(`Provider ${index + 1}: Endpoint is required`);
            if (!provider.type) errors.push(`Provider ${index + 1}: Type is required`);
        });

        // Validate models
        models.forEach((model, index) => {
            if (!model.name) errors.push(`Model ${index + 1}: Name is required`);
            if (!model.modelId) errors.push(`Model ${index + 1}: Model ID is required`);
            if (!model.providerId) errors.push(`Model ${index + 1}: Provider ID is required`);
            
            // Check if provider exists
            if (!providers.find(p => p.id === model.providerId)) {
                errors.push(`Model ${index + 1}: Referenced provider not found`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate TaskMaster configuration
     * @param {Object} taskMasterConfig - TaskMaster configuration
     * @returns {Object} Validation result
     */
    validateTaskMasterConfig(taskMasterConfig) {
        const errors = [];

        if (!taskMasterConfig.supportedModels) {
            errors.push('Missing supportedModels section');
        } else {
            // Validate supported models structure
            Object.keys(taskMasterConfig.supportedModels).forEach(providerKey => {
                const models = taskMasterConfig.supportedModels[providerKey];
                if (!Array.isArray(models)) {
                    errors.push(`Provider ${providerKey}: Models must be an array`);
                } else {
                    models.forEach((model, index) => {
                        if (!model.id) errors.push(`Provider ${providerKey}, Model ${index + 1}: ID is required`);
                    });
                }
            });
        }

        // 不再验证 config 部分，因为它由 TaskMaster 初始化流程管理

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
