/**
 * TaskMasterFileManager.js
 * 管理TaskMaster项目中的AI provider文件和supported-models.json
 */

export class TaskMasterFileManager {
    constructor(configManager, saveConfig) {
        this.configManager = configManager;
        this.saveConfig = saveConfig;
    }

    /**
     * 处理新供应商和模型的添加
     * @param {string} providerName - 供应商名称（如 'foapi'）
     * @param {string} originalModelId - 原始模型ID（如 'gpt-4o'）
     * @param {object} modelConfig - 模型配置信息
     */
    async addProviderModel(providerName, originalModelId, modelConfig) {
        const prefixedModelId = `${providerName.toLowerCase()}-${originalModelId}`;

        // 开始添加供应商模型

        // 1. 创建AI provider文件
        await this.createProviderFile(providerName, originalModelId, prefixedModelId);

        // 2. 更新supported-models.json
        await this.updateSupportedModelsFile(providerName, prefixedModelId, modelConfig);

        // 3. 更新provider的index.js导出
        await this.updateProviderIndexFile(providerName);

        // 成功添加供应商模型

        return {
            success: true,
            prefixedModelId,
            originalModelId,
            providerName
        };
    }

    /**
     * 创建AI provider文件
     */
    async createProviderFile(providerName, originalModelId, prefixedModelId) {
        const providerFileName = `${providerName.toLowerCase()}.js`;
        const providerFilePath = `src/ai-providers/${providerFileName}`;

        // 生成provider文件内容
        const providerContent = this.generateProviderFileContent(providerName, originalModelId, prefixedModelId);

        // 直接写入文件到TaskMaster项目
        await this.saveConfig.writeJavaScriptFile(providerFilePath, providerContent);

        // 成功创建文件
        return true;
    }

    /**
     * 只创建AI provider文件（不需要模型信息）
     * @param {string} providerName - 供应商名称
     * @param {object} providerConfig - 供应商配置信息
     */
    async createProviderFileOnly(providerName, providerConfig) {
        const providerFileName = `${providerName.toLowerCase()}.js`;
        const providerFilePath = `src/ai-providers/${providerFileName}`;

        // 检查文件是否已存在
        const exists = await this.checkProviderFileExists(providerFilePath);
        if (exists) {
            // 文件已存在，跳过创建
            return { created: false, reason: 'file_exists' };
        }

        // 生成基础provider文件内容（无模型）
        const providerContent = this.generateProviderFileContentBasic(providerName, providerConfig);

        // 直接写入文件到TaskMaster项目
        await this.saveConfig.writeJavaScriptFile(providerFilePath, providerContent);

        // 更新provider的index.js导出
        await this.updateProviderIndexFile(providerName);

        // 更新ai-services-unified.js
        await this.updateAiServicesUnifiedFile(providerName);

        // 成功创建文件
        return { created: true, filePath: providerFilePath };
    }

    /**
     * 生成AI provider文件内容
     */
    generateProviderFileContent(providerName, originalModelId, prefixedModelId) {
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;

        return `/**
 * ${providerName.toLowerCase()}.js
 * AI provider implementation for ${providerName} using OpenAI-compatible API.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';

export class ${className} extends BaseAIProvider {
    constructor() {
        super();
        this.name = '${providerName}';
    }

    /**
     * Creates and returns a ${providerName} client instance.
     * @param {object} params - Parameters for client initialization
     * @param {string} params.apiKey - ${providerName} API key
     * @param {string} [params.baseURL] - Optional custom API endpoint
     * @returns {Function} ${providerName} client function
     * @throws {Error} If API key is missing or initialization fails
     */
    getClient(params) {
        try {
            const { apiKey, baseURL } = params;

            if (!apiKey) {
                throw new Error('${providerName} API key is required.');
            }

            // 使用OpenAI兼容的API格式，确保URL包含/v1路径
            const effectiveBaseURL = baseURL || 'https://api.${providerName.toLowerCase()}.com/v1';

            // 确保baseURL以/v1结尾
            const normalizedBaseURL = effectiveBaseURL.endsWith('/v1')
                ? effectiveBaseURL
                : \`\${effectiveBaseURL}/v1\`.replace(/\\/+v1$/g, '/v1');

            return createOpenAI({
                apiKey,
                baseURL: normalizedBaseURL
            });
        } catch (error) {
            this.handleError('client initialization', error);
        }
    }

    /**
     * Maps ${providerName} model IDs to actual API model names
     * @param {string} modelId - The model ID from supported-models.json
     * @returns {string} The actual model name to use with the API
     */
    mapModelId(modelId) {
        const modelMap = {
            '${prefixedModelId}': '${originalModelId}'
            // 添加更多模型映射...
        };

        return modelMap[modelId] || modelId;
    }

    /**
     * Generates text using ${providerName} with model ID mapping
     */
    async generateText(params) {
        // Map the model ID to the actual API model name
        const mappedParams = {
            ...params,
            modelId: this.mapModelId(params.modelId)
        };

        // Call the parent generateText with mapped model ID
        return super.generateText(mappedParams);
    }

    /**
     * Generates streaming text using ${providerName} with model ID mapping
     */
    async streamText(params) {
        // Map the model ID to the actual API model name
        const mappedParams = {
            ...params,
            modelId: this.mapModelId(params.modelId)
        };

        // Call the parent streamText with mapped model ID
        return super.streamText(mappedParams);
    }

    /**
     * Generates object using ${providerName} with model ID mapping
     */
    async generateObject(params) {
        // Map the model ID to the actual API model name
        const mappedParams = {
            ...params,
            modelId: this.mapModelId(params.modelId)
        };

        // Call the parent generateObject with mapped model ID
        return super.generateObject(mappedParams);
    }
}
`;
    }

    /**
     * 生成基础AI provider文件内容（无模型信息）
     * @param {string} providerName - 供应商名称
     * @param {object} providerConfig - 供应商配置
     */
    generateProviderFileContentBasic(providerName, providerConfig) {
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
        const defaultEndpoint = providerConfig.endpoint || `https://api.${providerName.toLowerCase()}.com/v1`;

        return `/**
 * ${providerName.toLowerCase()}.js
 * AI provider implementation for ${providerName} using OpenAI-compatible API.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';

export class ${className} extends BaseAIProvider {
    constructor() {
        super();
        this.name = '${providerName}';
    }

    /**
     * Creates and returns a ${providerName} client instance.
     * @param {object} params - Parameters for client initialization
     * @param {string} params.apiKey - ${providerName} API key
     * @param {string} [params.baseURL] - Optional custom API endpoint
     * @returns {Function} ${providerName} client function
     * @throws {Error} If API key is missing or initialization fails
     */
    getClient(params) {
        try {
            const { apiKey, baseURL } = params;

            if (!apiKey) {
                throw new Error('${providerName} API key is required.');
            }

            // ${providerName}使用OpenAI兼容的API格式
            const effectiveBaseURL = baseURL || '${defaultEndpoint}';

            // 确保baseURL以/v1结尾（如果需要）
            const normalizedBaseURL = effectiveBaseURL.endsWith('/v1')
                ? effectiveBaseURL
                : \`\${effectiveBaseURL}/v1\`.replace(/\\/+v1$/g, '/v1');

            return createOpenAI({
                apiKey,
                baseURL: normalizedBaseURL
            });
        } catch (error) {
            this.handleError('client initialization', error);
        }
    }

    /**
     * Maps ${providerName} model IDs to actual API model names
     * @param {string} modelId - The model ID from supported-models.json
     * @returns {string} The actual model name to use with the API
     */
    mapModelId(modelId) {
        // 基础模型映射，可以在添加模型时扩展
        const modelMap = {
            // 示例：'${providerName.toLowerCase()}-model-name': 'actual-model-name'
        };

        return modelMap[modelId] || modelId;
    }

    /**
     * Generates text using ${providerName} with model ID mapping
     */
    async generateText(params) {
        // Map the model ID to the actual API model name
        const mappedParams = {
            ...params,
            modelId: this.mapModelId(params.modelId)
        };

        // Call the parent generateText with mapped model ID
        return super.generateText(mappedParams);
    }

    /**
     * Generates streaming text using ${providerName} with model ID mapping
     */
    async streamText(params) {
        // Map the model ID to the actual API model name
        const mappedParams = {
            ...params,
            modelId: this.mapModelId(params.modelId)
        };

        // Call the parent streamText with mapped model ID
        return super.streamText(mappedParams);
    }

    /**
     * Generates object using ${providerName} with model ID mapping
     */
    async generateObject(params) {
        // Map the model ID to the actual API model name
        const mappedParams = {
            ...params,
            modelId: this.mapModelId(params.modelId)
        };

        // Call the parent generateObject with mapped model ID
        return super.generateObject(mappedParams);
    }
}
`;
    }

    /**
     * 检查provider文件是否已存在
     * @param {string} filePath - 文件路径
     */
    async checkProviderFileExists(filePath) {
        try {
            const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');
            if (!projectDirHandle) {
                return false;
            }

            const content = await this.saveConfig.readFileFromDirectory(projectDirHandle, filePath);
            return content !== null;
        } catch (error) {
            // 文件不存在或读取失败
            return false;
        }
    }

    /**
     * 更新supported-models.json文件
     */
    async updateSupportedModelsFile(providerName, prefixedModelId, modelConfig) {
        const supportedModelsPath = 'scripts/modules/supported-models.json';

        // 读取现有的supported-models.json
        const existingContent = await this.saveConfig.readFileFromDirectory(
            this.saveConfig.directoryHandleCache.get('taskmaster-project'),
            supportedModelsPath
        );

        let supportedModels;
        if (existingContent) {
            supportedModels = JSON.parse(existingContent);
        } else {
            supportedModels = {};
        }

        // 确保供应商部分存在
        const providerKey = providerName.toLowerCase();
        if (!supportedModels[providerKey]) {
            supportedModels[providerKey] = [];
        }

        // 创建新模型条目
        const newModelEntry = {
            id: prefixedModelId,
            swe_score: (modelConfig.sweScore / 100) || 0,
            cost_per_1m_tokens: {
                input: modelConfig.costPer1MTokens?.input || 0,
                output: modelConfig.costPer1MTokens?.output || 0
            },
            allowed_roles: modelConfig.allowedRoles || ["main", "fallback", "research"],
            max_tokens: modelConfig.maxTokens || 128000
        };

        // 检查是否已存在相同模型
        const existingIndex = supportedModels[providerKey].findIndex(model => model.id === prefixedModelId);
        if (existingIndex >= 0) {
            // 更新现有模型
            supportedModels[providerKey][existingIndex] = newModelEntry;
        } else {
            // 添加新模型
            supportedModels[providerKey].push(newModelEntry);
        }

        // 写入更新后的文件
        await this.saveConfig.writeFileToDirectory(
            this.saveConfig.directoryHandleCache.get('taskmaster-project'),
            supportedModelsPath,
            JSON.stringify(supportedModels, null, 2)
        );

        // 成功更新文件
        return true;
    }

    /**
     * 生成更新后的supported-models.json内容
     */
    generateUpdatedSupportedModels(providerName, prefixedModelId, modelConfig) {
        // 这里应该读取现有的supported-models.json并添加新模型
        // 为了简化，我们返回需要添加的部分
        const newModelEntry = {
            id: prefixedModelId,
            swe_score: (modelConfig.sweScore / 100) || 0, // 转换为小数
            cost_per_1m_tokens: {
                input: modelConfig.costPer1MTokens?.input || 0,
                output: modelConfig.costPer1MTokens?.output || 0
            },
            allowed_roles: modelConfig.allowedRoles || ["main", "fallback", "research"],
            max_tokens: modelConfig.maxTokens || 128000
        };

        // 生成完整的JSON片段，便于复制粘贴
        const jsonSnippet = `        {
            "id": "${prefixedModelId}",
            "swe_score": ${newModelEntry.swe_score},
            "cost_per_1m_tokens": { "input": ${newModelEntry.cost_per_1m_tokens.input}, "output": ${newModelEntry.cost_per_1m_tokens.output} },
            "allowed_roles": ${JSON.stringify(newModelEntry.allowed_roles)},
            "max_tokens": ${newModelEntry.max_tokens}
        }`;

        return {
            providerName: providerName.toLowerCase(),
            newModel: newModelEntry,
            jsonSnippet,
            instruction: `请将以下JSON对象添加到 scripts/modules/supported-models.json 文件中的 "${providerName.toLowerCase()}" 数组中:`
        };
    }

    /**
     * 更新provider的index.js导出文件
     */
    async updateProviderIndexFile(providerName) {
        const indexPath = 'src/ai-providers/index.js';
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
        const exportLine = `export { ${className} } from './${providerName.toLowerCase()}.js';`;

        // 使用updateExistingFile方法更新index.js
        await this.saveConfig.updateExistingFile(indexPath, (existingContent) => {
            // 检查是否已存在该导出
            if (existingContent.includes(exportLine)) {
                // 导出已存在
                return existingContent;
            }

            // 添加新的导出行
            const updatedContent = existingContent + '\n' + exportLine;
            // 添加新导出
            return updatedContent;
        });

        // 成功更新文件
        return true;
    }

    /**
     * 更新ai-services-unified.js文件
     */
    async updateAiServicesUnifiedFile(providerName) {
        const unifiedPath = 'scripts/modules/ai-services-unified.js';
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
        const providerKey = providerName.toLowerCase();

        await this.saveConfig.updateExistingFile(unifiedPath, (existingContent) => {
            let updatedContent = existingContent;

            // 1. 添加到import语句中
            const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/src\/ai-providers\/index\.js['"];?/;
            const importMatch = existingContent.match(importRegex);

            if (importMatch && !importMatch[1].includes(className)) {
                const currentImports = importMatch[1].trim();
                const newImports = currentImports + ',\n\t' + className;
                updatedContent = updatedContent.replace(importRegex,
                    `import {\n\t${newImports}\n} from '../../src/ai-providers/index.js';`);
            }

            // 2. 添加到PROVIDERS对象中
            const providersRegex = /const PROVIDERS = \{([^}]+)\};/s;
            const providersMatch = updatedContent.match(providersRegex);

            if (providersMatch && !providersMatch[1].includes(`${providerKey}:`)) {
                const currentProviders = providersMatch[1].trim();
                const newProviders = currentProviders + ',\n\t' + `${providerKey}: new ${className}()`;
                updatedContent = updatedContent.replace(providersRegex,
                    `const PROVIDERS = {\n\t${newProviders}\n};`);
            }

            // 3. 添加到keyMap中
            const keyMapRegex = /const keyMap = \{([^}]+)\};/s;
            const keyMapMatch = updatedContent.match(keyMapRegex);

            if (keyMapMatch && !keyMapMatch[1].includes(`${providerKey}:`)) {
                const apiKeyName = `${providerKey.toUpperCase()}_API_KEY`;
                const newKeyMapEntry = `\t\t${providerKey}: '${apiKeyName}' // ${className} uses its own API key`;

                // 在最后一个条目后添加新条目
                const keyMapContent = keyMapMatch[1];
                const lastCommaIndex = keyMapContent.lastIndexOf(',');
                if (lastCommaIndex !== -1) {
                    const beforeLastEntry = keyMapContent.substring(0, lastCommaIndex + 1);
                    const afterLastEntry = keyMapContent.substring(lastCommaIndex + 1);
                    const newKeyMapContent = beforeLastEntry + '\n' + newKeyMapEntry + ',' + afterLastEntry;
                    updatedContent = updatedContent.replace(keyMapRegex,
                        `const keyMap = {${newKeyMapContent}\t};`);
                }
            }

            return updatedContent;
        });

        return true;
    }

    /**
     * 生成完整的文件更新包
     */
    async generateFileUpdatePackage(providerName, originalModelId, modelConfig) {
        const result = await this.addProviderModel(providerName, originalModelId, modelConfig);
        
        if (result.success) {
            const providerFile = await this.ensureProviderFile(providerName, originalModelId, result.prefixedModelId);
            const supportedModels = await this.updateSupportedModelsFile(providerName, result.prefixedModelId, modelConfig);
            const indexUpdate = await this.updateProviderIndexFile(providerName);
            const unifiedUpdate = await this.updateAiServicesUnifiedFile(providerName);

            return {
                success: true,
                files: [providerFile, supportedModels, indexUpdate, unifiedUpdate],
                summary: {
                    providerName,
                    originalModelId,
                    prefixedModelId: result.prefixedModelId,
                    message: `成功生成 ${providerName} 供应商的所有必要文件更新`
                }
            };
        }

        return { success: false, error: '生成文件更新包失败' };
    }
}
