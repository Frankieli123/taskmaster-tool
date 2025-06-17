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

        // 执行所有必要的文件更新
        const updateResults = await this.executeAllProviderUpdates(providerName, providerConfig);

        // 成功创建文件
        return {
            created: true,
            filePath: providerFilePath,
            updateResults
        };
    }

    /**
     * 执行所有供应商相关的文件更新
     * @param {string} providerName - 供应商名称
     * @param {object} providerConfig - 供应商配置
     */
    async executeAllProviderUpdates(providerName, providerConfig) {
        const results = {
            success: [],
            failed: [],
            warnings: []
        };

        // 1. 更新provider的index.js导出
        try {
            await this.updateProviderIndexFile(providerName);
            results.success.push('index.js');
        } catch (error) {
            results.failed.push({ file: 'index.js', error: error.message });
        }

        // 2. 更新ai-services-unified.js
        try {
            await this.updateAiServicesUnifiedFile(providerName);
            results.success.push('ai-services-unified.js');
        } catch (error) {
            results.failed.push({ file: 'ai-services-unified.js', error: error.message });
        }

        // 3. 更新config-manager.js
        try {
            const configResult = await this.updateConfigManagerFile(providerName);
            if (configResult) {
                results.success.push('config-manager.js');
            } else {
                results.failed.push({ file: 'config-manager.js', error: 'updateConfigManagerFile returned false' });
            }
        } catch (error) {
            results.failed.push({ file: 'config-manager.js', error: error.message });
        }

        // 4. 更新supported-models.json
        try {
            await this.updateSupportedModelsFileProviderOnly(providerName);
            results.success.push('supported-models.json');
        } catch (error) {
            results.failed.push({ file: 'supported-models.json', error: error.message });
        }

        // 5. 更新MCP配置（非关键，失败不影响整体）
        try {
            const mcpResult = await this.updateMCPConfigFile(providerName, providerConfig.apiKey);
            if (mcpResult) {
                results.success.push('mcp.json');
            } else {
                results.warnings.push('MCP配置更新失败，但不影响供应商创建');
            }
        } catch (error) {
            results.warnings.push(`MCP配置更新失败: ${error.message}`);
        }

        // 6. 更新init.js文件（非关键，失败不影响整体）
        try {
            await this.updateInitJsFile(providerName);
            results.success.push('init.js');
        } catch (error) {
            results.warnings.push(`init.js更新失败: ${error.message}`);
        }

        // 7. 更新UI工具配置文件（非关键，失败不影响整体）
        try {
            await this.updateUIToolConfigs(providerName, providerConfig);
            results.success.push('UI工具配置');
        } catch (error) {
            results.warnings.push(`UI工具配置更新失败: ${error.message}`);
        }

        return results;
    }

    /**
     * 手动修复遗漏的供应商配置
     * @param {string} providerName - 供应商名称
     */
    async fixMissingProviderConfig(providerName) {
        const results = {
            success: [],
            failed: [],
            warnings: []
        };

        // 强制更新config-manager.js
        try {
            await this.updateConfigManagerFile(providerName);
            results.success.push('config-manager.js');
        } catch (error) {
            results.failed.push({ file: 'config-manager.js', error: error.message });
        }

        return results;
    }

    /**
     * 更新现有供应商的API密钥
     * @param {string} providerName - 供应商名称
     * @param {string} apiKeyValue - 新的API密钥值
     */
    async updateProviderApiKey(providerName, apiKeyValue) {
        const results = {
            success: [],
            failed: [],
            warnings: []
        };

        // 更新MCP配置中的API密钥
        try {
            const mcpResult = await this.updateMCPConfigFile(providerName, apiKeyValue);
            if (mcpResult) {
                results.success.push('mcp.json');
            } else {
                results.failed.push({ file: 'mcp.json', error: 'API密钥更新失败' });
            }
        } catch (error) {
            results.failed.push({ file: 'mcp.json', error: error.message });
        }

        return results;
    }

    /**
     * 更新现有的AI provider文件（强制重新生成以更新配置）
     * @param {string} providerName - 供应商名称
     * @param {object} providerConfig - 供应商配置信息
     */
    async updateProviderFile(providerName, providerConfig) {
        const providerFileName = `${providerName.toLowerCase()}.js`;
        const providerFilePath = `src/ai-providers/${providerFileName}`;

        // 强制重新生成provider文件内容（覆盖现有文件）
        const providerContent = this.generateProviderFileContentBasic(providerName, providerConfig);

        // 直接写入文件到TaskMaster项目（覆盖现有文件）
        await this.saveConfig.writeJavaScriptFile(providerFilePath, providerContent);

        // 更新init.js文件（确保新项目初始化时包含此供应商）
        try {
            await this.updateInitJsFile(providerName);
        } catch (error) {
            // init.js更新失败不影响主要功能，只记录警告
            // 使用静默方式处理，避免影响用户体验
        }

        // 跳过UI工具配置文件更新，避免触发页面刷新
        // 注意：更新现有供应商时不需要修改UI工具源代码
        // await this.updateUIToolConfigs(providerName, providerConfig);

        // 成功更新文件
        // 注意：API密钥更新由syncProviderToTaskMaster方法统一处理
        return { updated: true, filePath: providerFilePath };
    }

    /**
     * 获取正确的默认端点
     * @param {string} providerKey - 供应商键名
     * @returns {string} 正确的默认端点
     */
    getCorrectDefaultEndpoint(providerKey) {
        const defaultEndpoints = {
            'openai': 'https://api.openai.com',
            'anthropic': 'https://api.anthropic.com',
            'google': 'https://generativelanguage.googleapis.com',
            'polo': 'https://api.polo.ai',
            'poloai': 'https://api.polo.ai',
            'foapi': 'https://v2.voct.top',
            'aoapi': 'https://api.aoapi.com',
            'perplexity': 'https://api.perplexity.ai',
            'xai': 'https://api.x.ai',
            'openrouter': 'https://openrouter.ai/api',
            'ollama': 'http://localhost:11434',
            't': 'https://tbai.xin',
            't2': 'https://api.t2.com'
        };
        return defaultEndpoints[providerKey] || `https://api.${providerKey}.com`;
    }

    /**
     * 生成AI provider文件内容
     */
    generateProviderFileContent(providerName, _originalModelId, _prefixedModelId, providerConfig = null) {
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
        const configuredEndpoint = providerConfig?.endpoint || this.getCorrectDefaultEndpoint(providerName.toLowerCase());

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

            // 使用配置的API端点，可以通过baseURL参数覆盖
            const effectiveBaseURL = baseURL || '${configuredEndpoint}';

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
        // 自动去除${providerName.toLowerCase()}-前缀，类似poloai的处理方式
        if (modelId.startsWith('${providerName.toLowerCase()}-')) {
            return modelId.replace('${providerName.toLowerCase()}-', '');
        }

        // 对于特殊情况的手动映射（如果需要）
        const modelMap = {
            // 在这里添加特殊的模型映射，如果有的话
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
        const configuredEndpoint = providerConfig?.endpoint || this.getCorrectDefaultEndpoint(providerName.toLowerCase());

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

            // 使用配置的API端点，可以通过baseURL参数覆盖
            const effectiveBaseURL = baseURL || '${configuredEndpoint}';

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
        // 自动去除${providerName.toLowerCase()}-前缀，类似poloai的处理方式
        if (modelId.startsWith('${providerName.toLowerCase()}-')) {
            return modelId.replace('${providerName.toLowerCase()}-', '');
        }

        // 对于特殊情况的手动映射（如果需要）
        const modelMap = {
            // 在这里添加特殊的模型映射，如果有的话
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
     * 更新supported-models.json文件，只添加供应商条目（不添加模型）
     * @param {string} providerName - 供应商名称
     */
    async updateSupportedModelsFileProviderOnly(providerName) {
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

        // 确保供应商部分存在（如果不存在则创建空数组）
        const providerKey = providerName.toLowerCase();
        if (!supportedModels[providerKey]) {
            supportedModels[providerKey] = [];
        }

        // 写入更新后的文件
        await this.saveConfig.writeFileToDirectory(
            this.saveConfig.directoryHandleCache.get('taskmaster-project'),
            supportedModelsPath,
            JSON.stringify(supportedModels, null, 2)
        );

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

            // 确保内容以换行符结尾，然后添加新的导出行
            let updatedContent = existingContent.trim();
            if (updatedContent.length > 0) {
                updatedContent += '\n';
            }
            updatedContent += exportLine;

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
            const providersRegex = /const PROVIDERS = \{([\s\S]*?)\};/s;
            const providersMatch = updatedContent.match(providersRegex);

            if (providersMatch && !providersMatch[1].includes(`${providerKey}:`)) {
                const providersContent = providersMatch[1];

                // 按行处理，更安全的方式
                const lines = providersContent.split('\n');
                const filteredLines = lines.filter(line => line.trim().length > 0);

                // 确保最后一行有逗号
                if (filteredLines.length > 0) {
                    const lastLineIndex = filteredLines.length - 1;
                    const lastLine = filteredLines[lastLineIndex].trim();
                    if (!lastLine.endsWith(',')) {
                        filteredLines[lastLineIndex] = filteredLines[lastLineIndex] + ',';
                    }
                }

                // 添加新的供应商行
                filteredLines.push(`\t${providerKey}: new ${className}()`);

                const newProvidersContent = filteredLines.join('\n');
                updatedContent = updatedContent.replace(providersRegex,
                    `const PROVIDERS = {\n${newProvidersContent}\n};`);
            }

            // 3. 添加到keyMap中
            const keyMapRegex = /const keyMap = \{([\s\S]*?)\};/;
            const keyMapMatch = updatedContent.match(keyMapRegex);

            if (keyMapMatch && !keyMapMatch[1].includes(`${providerKey}:`)) {
                const apiKeyName = `${providerKey.toUpperCase()}_API_KEY`;
                const keyMapContent = keyMapMatch[1];

                // 从开头插入新条目，避免末尾逗号问题
                const lines = keyMapContent.split('\n');
                const filteredLines = lines.filter(line => line.trim().length > 0);

                // 找到第一个有效的keyMap条目行，在其前面插入新条目
                let insertIndex = 0;
                for (let i = 0; i < filteredLines.length; i++) {
                    const line = filteredLines[i].trim();
                    if (line.includes(':') && !line.startsWith('//')) {
                        insertIndex = i;
                        break;
                    }
                }

                // 插入新的keyMap条目（带逗号）
                const newEntry = `\t\t\t${providerKey}: '${apiKeyName}',`;
                filteredLines.splice(insertIndex, 0, newEntry);

                const newKeyMapContent = filteredLines.join('\n');
                updatedContent = updatedContent.replace(keyMapRegex, `const keyMap = {\n${newKeyMapContent}\n\t\t};`);
            }

            return updatedContent;
        });

        return true;
    }

    /**
     * 更新config-manager.js文件，添加新供应商的配置
     * @param {string} providerName - 供应商名称
     */
    async updateConfigManagerFile(providerName) {
        const configManagerPath = 'scripts/modules/config-manager.js';
        const providerKey = providerName.toLowerCase();
        const apiKeyName = `${providerName.toUpperCase()}_API_KEY`;

        try {
            const result = await this.saveConfig.updateExistingFile(configManagerPath, (existingContent) => {
                let updatedContent = existingContent;
                let keyMapUpdated = false;
                let switchUpdated = false;

                // 1. 添加到keyMap中
                const keyMapRegex = /const keyMap = \{([\s\S]*?)\};/;
                const keyMapMatch = existingContent.match(keyMapRegex);

                if (keyMapMatch) {
                    if (!keyMapMatch[1].includes(`${providerKey}:`)) {
                        const keyMapContent = keyMapMatch[1];

                        // 从开头插入新条目，避免末尾逗号问题
                        const lines = keyMapContent.split('\n');
                        const filteredLines = lines.filter(line => line.trim().length > 0);

                        // 找到第一个有效的keyMap条目行，在其前面插入新条目
                        let insertIndex = 0;
                        for (let i = 0; i < filteredLines.length; i++) {
                            const line = filteredLines[i].trim();
                            if (line.includes(':') && !line.startsWith('//')) {
                                insertIndex = i;
                                break;
                            }
                        }

                        // 插入新的keyMap条目（带逗号）
                        const newEntry = `\t\t\t${providerKey}: '${apiKeyName}',`;
                        filteredLines.splice(insertIndex, 0, newEntry);

                        const newKeyMapContent = filteredLines.join('\n');
                        updatedContent = updatedContent.replace(keyMapRegex, `const keyMap = {\n${newKeyMapContent}\n\t\t};`);
                        keyMapUpdated = true;
                    }
                } else {
                    throw new Error('无法找到keyMap对象');
                }

                // 2. 添加到getMcpApiKeyStatus函数的switch语句中
                const switchRegex = /switch \(providerName\) \{([\s\S]*?)\s*default:/;
                const switchMatch = updatedContent.match(switchRegex);

                if (switchMatch) {
                    if (!switchMatch[1].includes(`case '${providerKey}':`)) {
                        const switchContent = switchMatch[1];
                        const newCaseStatement = `\t\t\tcase '${providerKey}':\n\t\t\t\tapiKeyToCheck = mcpEnv.${apiKeyName}; // ${providerName} uses its own API key\n\t\t\t\tplaceholderValue = 'YOUR_${apiKeyName}_HERE';\n\t\t\t\tbreak;`;

                        // 确保switch内容正确格式化，在default前添加新的case
                        let newSwitchContent = switchContent.trim();
                        if (newSwitchContent.length > 0 && !newSwitchContent.endsWith('\n')) {
                            newSwitchContent += '\n';
                        }
                        newSwitchContent += newCaseStatement + '\n\t\t\t';

                        updatedContent = updatedContent.replace(switchRegex, `switch (providerName) {\n${newSwitchContent}default:`);
                        switchUpdated = true;
                    }
                } else {
                    throw new Error('无法找到switch语句');
                }

                // 验证更新是否成功
                if (!keyMapUpdated && !switchUpdated) {
                    throw new Error(`供应商 ${providerKey} 已存在于config-manager.js中`);
                }

                return updatedContent;
            });

            return result;
        } catch (error) {
            throw new Error(`更新config-manager.js失败: ${error.message}`);
        }
    }

    /**
     * 更新MCP配置文件，添加API密钥
     * @param {string} providerName - 供应商名称
     * @param {string} [apiKeyValue] - 实际的API密钥值，如果不提供则使用占位符
     */
    async updateMCPConfigFile(providerName, apiKeyValue = null) {
        const mcpConfigPath = '.cursor/mcp.json';
        const apiKeyName = `${providerName.toUpperCase()}_API_KEY`;
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            // 读取现有的MCP配置
            let mcpConfig = {};
            try {
                const mcpContent = await this.saveConfig.readFileFromDirectory(projectDirHandle, mcpConfigPath);
                if (mcpContent) {
                    mcpConfig = JSON.parse(mcpContent);
                }
            } catch (error) {
                // 文件不存在，创建默认结构
                mcpConfig = {
                    mcpServers: {
                        'taskmaster-api': {
                            command: 'node',
                            args: ['dist/index.js'],
                            env: {}
                        }
                    }
                };
            }

            // 确保MCP配置结构存在
            if (!mcpConfig.mcpServers) {
                mcpConfig.mcpServers = {};
            }
            if (!mcpConfig.mcpServers['taskmaster-api']) {
                mcpConfig.mcpServers['taskmaster-api'] = {
                    command: 'node',
                    args: ['dist/index.js'],
                    env: {}
                };
            }
            if (!mcpConfig.mcpServers['taskmaster-api'].env) {
                mcpConfig.mcpServers['taskmaster-api'].env = {};
            }

            const mcpEnv = mcpConfig.mcpServers['taskmaster-api'].env;

            // 设置API密钥值
            const keyValue = apiKeyValue && apiKeyValue.trim() !== ''
                ? apiKeyValue.trim()
                : `${apiKeyName}_HERE`;

            // 添加或更新API密钥
            mcpEnv[apiKeyName] = keyValue;

            // 写入更新后的MCP配置
            await this.saveConfig.writeFileToDirectory(
                projectDirHandle,
                mcpConfigPath,
                JSON.stringify(mcpConfig, null, 2)
            );

            return true;
        } catch (error) {
            // MCP配置更新失败不应该阻止供应商创建
            // 静默处理错误，不影响供应商创建流程
            return false;
        }
    }

    /**
     * 更新init.js文件，在MCP配置模板中添加新供应商的API密钥
     * @param {string} providerName - 供应商名称
     */
    async updateInitJsFile(providerName) {
        const initJsPath = 'scripts/init.js';
        const apiKeyName = `${providerName.toUpperCase()}_API_KEY`;

        try {
            const result = await this.updateFileContent(initJsPath, (content) => {
                // 查找MCP配置模板中的env部分
                const envSectionRegex = /(\s+env:\s*\{\s*\n)([\s\S]*?)(\n\s+\}\s*\n)/;
                const match = content.match(envSectionRegex);

                if (!match) {
                    throw new Error('未找到MCP配置模板中的env部分');
                }

                const [, envStart, envContent, envEnd] = match;

                // 检查API密钥是否已存在
                if (envContent.includes(`${apiKeyName}:`)) {
                    // API密钥已存在，不需要添加
                    return content;
                }

                // 解析现有的env条目，保持格式一致
                const envLines = envContent.split('\n').filter(line => line.trim());

                // 找到最后一个API密钥条目的缩进格式
                let indentation = '\t\t\t\t\t';  // 默认缩进
                if (envLines.length > 0) {
                    const lastLine = envLines[envLines.length - 1];
                    const indentMatch = lastLine.match(/^(\s*)/);
                    if (indentMatch) {
                        indentation = indentMatch[1];
                    }
                }

                // 构建新的API密钥条目
                const newApiKeyEntry = `${indentation}${apiKeyName}: '${apiKeyName}_HERE'`;

                // 在最后一个条目后添加新的API密钥（确保有逗号）
                let updatedEnvContent = envContent;
                if (envLines.length > 0) {
                    // 确保最后一行有逗号
                    const lastLineIndex = updatedEnvContent.lastIndexOf(envLines[envLines.length - 1]);
                    const lastLine = envLines[envLines.length - 1];
                    if (!lastLine.trim().endsWith(',')) {
                        updatedEnvContent = updatedEnvContent.substring(0, lastLineIndex + lastLine.length) +
                                          ',' + updatedEnvContent.substring(lastLineIndex + lastLine.length);
                    }
                    updatedEnvContent += `\n${newApiKeyEntry}`;
                } else {
                    updatedEnvContent = `\n${newApiKeyEntry}`;
                }

                // 替换env部分
                const updatedContent = content.replace(envSectionRegex, `${envStart}${updatedEnvContent}${envEnd}`);

                return updatedContent;
            });

            return result;
        } catch (error) {
            throw new Error(`更新init.js失败: ${error.message}`);
        }
    }

    /**
     * 更新UI工具配置文件
     * @param {string} providerName - 供应商名称
     * @param {object} providerConfig - 供应商配置
     */
    async updateUIToolConfigs(providerName, providerConfig) {
        const providerKey = providerName.toLowerCase();

        // 只更新ConfigTransformer.js的映射配置（用于数据转换）
        // 不更新默认供应商配置，因为UI应该只显示实际导入的供应商

        // 更新UI工具的ConfigTransformer.js
        const configTransformerPath = 'ui-config-tool/src/utils/ConfigTransformer.js';
        await this.saveConfig.updateExistingFile(configTransformerPath, (existingContent) => {
            let updatedContent = existingContent;

            // 添加到providerTypeMap
            const typeMapRegex = /this\.providerTypeMap = \{([^}]+)\};/s;
            const typeMapMatch = existingContent.match(typeMapRegex);

            if (typeMapMatch && !typeMapMatch[1].includes(`'${providerKey}':`)) {
                const typeMapContent = typeMapMatch[1].trim();
                const newTypeMapEntry = `'${providerKey}': '${providerConfig.type || 'openai'}'`;

                // 确保正确的逗号处理
                let newTypeMapContent;
                if (typeMapContent.endsWith(',')) {
                    // 如果已经有逗号，直接添加新条目
                    newTypeMapContent = typeMapContent + '\n            ' + newTypeMapEntry;
                } else {
                    // 如果没有逗号，先添加逗号再添加新条目
                    newTypeMapContent = typeMapContent + ',\n            ' + newTypeMapEntry;
                }

                updatedContent = updatedContent.replace(typeMapRegex, `this.providerTypeMap = {\n            ${newTypeMapContent}\n        };`);
            }

            // 添加到defaultEndpoints
            const endpointsRegex = /this\.defaultEndpoints = \{([^}]+)\};/s;
            const endpointsMatch = updatedContent.match(endpointsRegex);

            if (endpointsMatch && !endpointsMatch[1].includes(`'${providerKey}':`)) {
                const endpointsContent = endpointsMatch[1].trim();
                const newEndpointEntry = `'${providerKey}': '${providerConfig.endpoint || this.getCorrectDefaultEndpoint(providerKey)}'`;

                // 确保正确的逗号处理
                let newEndpointsContent;
                if (endpointsContent.endsWith(',')) {
                    // 如果已经有逗号，直接添加新条目
                    newEndpointsContent = endpointsContent + '\n            ' + newEndpointEntry;
                } else {
                    // 如果没有逗号，先添加逗号再添加新条目
                    newEndpointsContent = endpointsContent + ',\n            ' + newEndpointEntry;
                }

                updatedContent = updatedContent.replace(endpointsRegex, `this.defaultEndpoints = {\n            ${newEndpointsContent}\n        };`);
            }

            // 添加到nameMap（在transformProviderName方法中）
            const nameMapRegex = /const nameMap = \{([^}]+)\};/s;
            const nameMapMatch = updatedContent.match(nameMapRegex);

            if (nameMapMatch && !nameMapMatch[1].includes(`'${providerKey}':`)) {
                const nameMapContent = nameMapMatch[1].trim();
                const newNameMapEntry = `'${providerKey}': '${providerName}'`;

                // 确保正确的逗号处理
                let newNameMapContent;
                if (nameMapContent.endsWith(',')) {
                    // 如果已经有逗号，直接添加新条目
                    newNameMapContent = nameMapContent + '\n            ' + newNameMapEntry;
                } else {
                    // 如果没有逗号，先添加逗号再添加新条目
                    newNameMapContent = nameMapContent + ',\n            ' + newNameMapEntry;
                }

                updatedContent = updatedContent.replace(nameMapRegex, `const nameMap = {\n            ${newNameMapContent}\n        };`);
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

    /**
     * 完整删除供应商及其相关文件和配置
     * @param {string} providerName - 供应商名称
     * @returns {Promise<Object>} - 删除结果
     */
    async deleteProviderFromTaskMaster(providerName) {
        const results = {
            success: true,
            deletedFiles: [],
            updatedFiles: [],
            errors: [],
            warnings: []
        };

        try {
            const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');
            if (!projectDirHandle) {
                throw new Error('TaskMaster项目目录句柄不可用');
            }

            // 1. 检查配置引用
            const configUsage = await this.checkProviderUsageInConfig(providerName);
            if (configUsage.isUsed) {
                results.warnings.push(`供应商 ${providerName} 正在被以下配置使用: ${configUsage.usedIn.join(', ')}`);
                results.warnings.push('建议先更改配置再删除供应商');
            }

            // 2. 删除 supported-models.json 中的供应商条目
            try {
                const removed = await this.removeProviderFromSupportedModels(providerName);
                if (removed) {
                    results.updatedFiles.push('scripts/modules/supported-models.json');
                }
            } catch (error) {
                results.errors.push(`删除 supported-models.json 中的条目失败: ${error.message}`);
                results.success = false;
            }

            // 3. 删除 .cursor/mcp.json 中的API密钥
            try {
                const removed = await this.removeProviderFromMCPConfig(providerName);
                if (removed) {
                    results.updatedFiles.push('.cursor/mcp.json');
                }
            } catch (error) {
                results.errors.push(`删除 MCP 配置中的API密钥失败: ${error.message}`);
                results.success = false;
            }

            // 4. 删除供应商JavaScript文件
            try {
                const deleted = await this.deleteProviderFile(providerName);
                if (deleted) {
                    results.deletedFiles.push(`src/ai-providers/${providerName.toLowerCase()}.js`);
                }
            } catch (error) {
                results.errors.push(`删除供应商文件失败: ${error.message}`);
                results.success = false;
            }

            // 5. 更新 index.js 文件
            try {
                const updated = await this.updateProviderIndexFileForDeletion(providerName);
                if (updated) {
                    results.updatedFiles.push('src/ai-providers/index.js');
                }
            } catch (error) {
                results.errors.push(`更新 index.js 失败: ${error.message}`);
                results.success = false;
            }

            // 6. 更新 ai-services-unified.js 文件
            try {
                const updated = await this.updateAiServicesUnifiedFileForDeletion(providerName);
                if (updated) {
                    results.updatedFiles.push('scripts/modules/ai-services-unified.js');
                }
            } catch (error) {
                results.errors.push(`更新 ai-services-unified.js 失败: ${error.message}`);
                results.success = false;
            }

            // 7. 更新 config-manager.js 文件
            try {
                const updated = await this.removeProviderFromConfigManager(providerName);
                if (updated) {
                    results.updatedFiles.push('scripts/modules/config-manager.js');
                }
            } catch (error) {
                results.errors.push(`更新 config-manager.js 失败: ${error.message}`);
                results.success = false;
            }

            // 8. 更新 UI工具的 ConfigTransformer.js 文件（跳过configManager.js，因为UI只显示实际导入的供应商）
            try {
                const updated = await this.removeProviderFromConfigTransformer(providerName);
                if (updated) {
                    results.updatedFiles.push('ui-config-tool/src/utils/ConfigTransformer.js');
                }
            } catch (error) {
                results.errors.push(`更新 ConfigTransformer.js 失败: ${error.message}`);
                results.success = false;
            }

            return results;
        } catch (error) {
            results.success = false;
            results.errors.push(`删除供应商失败: ${error.message}`);
            return results;
        }
    }

    /**
     * 检查供应商在配置中的使用情况
     * @param {string} providerName - 供应商名称
     * @returns {Promise<Object>} - 使用情况
     */
    async checkProviderUsageInConfig(providerName) {
        const result = {
            isUsed: false,
            usedIn: []
        };

        try {
            const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');
            if (!projectDirHandle) {
                return result;
            }

            // 检查 .taskmaster/config.json
            const configContent = await this.saveConfig.readFileFromDirectory(projectDirHandle, '.taskmaster/config.json');
            if (configContent) {
                const config = JSON.parse(configContent);
                if (config.models) {
                    for (const [role, modelConfig] of Object.entries(config.models)) {
                        if (modelConfig.provider === providerName.toLowerCase()) {
                            result.isUsed = true;
                            result.usedIn.push(`${role} 模型`);
                        }
                    }
                }
            }

            return result;
        } catch (error) {
            // 配置文件读取失败，假设没有使用
            return result;
        }
    }

    /**
     * 从 supported-models.json 中删除供应商条目
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否删除成功
     */
    async removeProviderFromSupportedModels(providerName) {
        const supportedModelsPath = 'scripts/modules/supported-models.json';
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const content = await this.saveConfig.readFileFromDirectory(projectDirHandle, supportedModelsPath);
            if (!content) {
                return false; // 文件不存在
            }

            const supportedModels = JSON.parse(content);
            const providerKey = providerName.toLowerCase();

            if (supportedModels[providerKey]) {
                delete supportedModels[providerKey];

                // 写入更新后的文件
                await this.saveConfig.writeFileToDirectory(
                    projectDirHandle,
                    supportedModelsPath,
                    JSON.stringify(supportedModels, null, 2)
                );

                return true;
            }

            return false; // 供应商不存在
        } catch (error) {
            throw new Error(`删除 supported-models.json 中的供应商失败: ${error.message}`);
        }
    }

    /**
     * 从 .cursor/mcp.json 中删除供应商的API密钥
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否删除成功
     */
    async removeProviderFromMCPConfig(providerName) {
        const mcpConfigPath = '.cursor/mcp.json';
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const content = await this.saveConfig.readFileFromDirectory(projectDirHandle, mcpConfigPath);
            if (!content) {
                return false; // 文件不存在
            }

            const mcpConfig = JSON.parse(content);
            const apiKeyName = `${providerName.toUpperCase()}_API_KEY`;
            let removed = false;

            // 检查并删除API密钥
            if (mcpConfig.mcpServers && mcpConfig.mcpServers['taskmaster-api'] && mcpConfig.mcpServers['taskmaster-api'].env) {
                const env = mcpConfig.mcpServers['taskmaster-api'].env;
                if (env[apiKeyName]) {
                    delete env[apiKeyName];
                    removed = true;
                }
            }

            if (removed) {
                // 写入更新后的文件
                await this.saveConfig.writeFileToDirectory(
                    projectDirHandle,
                    mcpConfigPath,
                    JSON.stringify(mcpConfig, null, 2)
                );
            }

            return removed;
        } catch (error) {
            throw new Error(`删除 MCP 配置中的API密钥失败: ${error.message}`);
        }
    }

    /**
     * 删除供应商JavaScript文件
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否删除成功
     */
    async deleteProviderFile(providerName) {
        const providerFilePath = `src/ai-providers/${providerName.toLowerCase()}.js`;
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const deleted = await this.saveConfig.deleteFileFromDirectory(projectDirHandle, providerFilePath);
            return deleted;
        } catch (error) {
            throw new Error(`删除供应商文件失败: ${error.message}`);
        }
    }

    /**
     * 更新 index.js 文件，删除供应商的导出
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async updateProviderIndexFileForDeletion(providerName) {
        const indexPath = 'src/ai-providers/index.js';
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const updated = await this.saveConfig.updateFileContent(projectDirHandle, indexPath, (existingContent) => {
                // 删除导出行
                const exportLine = `export { ${className} } from './${providerName.toLowerCase()}.js';`;
                const lines = existingContent.split('\n');
                const filteredLines = lines.filter(line => !line.includes(exportLine.trim()));
                return filteredLines.join('\n');
            });

            return updated;
        } catch (error) {
            throw new Error(`更新 index.js 文件失败: ${error.message}`);
        }
    }

    /**
     * 更新 ai-services-unified.js 文件，删除供应商的导入和实例
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async updateAiServicesUnifiedFileForDeletion(providerName) {
        const unifiedPath = 'scripts/modules/ai-services-unified.js';
        const className = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Provider`;
        const providerKey = providerName.toLowerCase();
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const updated = await this.saveConfig.updateFileContent(projectDirHandle, unifiedPath, (existingContent) => {
                let updatedContent = existingContent;

                // 1. 从import语句中删除
                const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/src\/ai-providers\/index\.js['"];?/;
                const importMatch = existingContent.match(importRegex);

                if (importMatch && importMatch[1].includes(className)) {
                    const currentImports = importMatch[1]
                        .split(',')
                        .map(imp => imp.trim())
                        .filter(imp => imp !== className)
                        .join(',\n\t');

                    updatedContent = updatedContent.replace(importRegex,
                        `import {\n\t${currentImports}\n} from '../../src/ai-providers/index.js';`);
                }

                // 2. 从PROVIDERS对象中删除
                const providerInstanceRegex = new RegExp(`\\s*${providerKey}:\\s*new\\s+${className}\\(\\)\\s*,?`, 'g');
                updatedContent = updatedContent.replace(providerInstanceRegex, '');

                // 3. 从keyMap中删除
                const keyMapRegex = /const keyMap = \{([\s\S]*?)\};/;
                const keyMapMatch = updatedContent.match(keyMapRegex);

                if (keyMapMatch) {
                    const keyMapContent = keyMapMatch[1];
                    // 删除该供应商的行，更精确的匹配
                    const lines = keyMapContent.split('\n');
                    const filteredLines = lines.filter(line => {
                        const trimmedLine = line.trim();
                        return !trimmedLine.includes(`${providerKey}:`) || trimmedLine.startsWith('//');
                    });
                    const newKeyMapContent = filteredLines.join('\n');

                    updatedContent = updatedContent.replace(keyMapRegex, `const keyMap = {${newKeyMapContent}\n\t\t};`);
                }

                // 清理多余的逗号和空行
                updatedContent = updatedContent.replace(/,\s*,/g, ',');
                updatedContent = updatedContent.replace(/,\s*\n\s*\}/g, '\n\t\t}');
                updatedContent = updatedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

                return updatedContent;
            });

            return updated;
        } catch (error) {
            throw new Error(`更新 ai-services-unified.js 文件失败: ${error.message}`);
        }
    }

    /**
     * 从 config-manager.js 中删除供应商的配置
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async removeProviderFromConfigManager(providerName) {
        const configManagerPath = 'scripts/modules/config-manager.js';
        const providerKey = providerName.toLowerCase();
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const updated = await this.saveConfig.updateFileContent(projectDirHandle, configManagerPath, (existingContent) => {
                let updatedContent = existingContent;

                // 1. 从keyMap中删除供应商条目
                const keyMapRegex = /const keyMap = \{([\s\S]*?)\};/s;
                const keyMapMatch = updatedContent.match(keyMapRegex);

                if (keyMapMatch) {
                    const keyMapContent = keyMapMatch[1];
                    // 按行删除，更安全的方式
                    const lines = keyMapContent.split('\n');
                    const filteredLines = lines.filter(line => {
                        const trimmedLine = line.trim();
                        return !trimmedLine.includes(`${providerKey}:`) || trimmedLine.startsWith('//');
                    });
                    const newKeyMapContent = filteredLines.join('\n');

                    // 清理多余的逗号
                    const cleanedKeyMapContent = newKeyMapContent.replace(/,\s*,/g, ',').replace(/,\s*\n\s*\}/g, '\n\t\t}');

                    updatedContent = updatedContent.replace(keyMapRegex, `const keyMap = {${cleanedKeyMapContent}};`);
                }

                // 2. 从getMcpApiKeyStatus函数的switch语句中删除case
                const switchRegex = /switch \(providerName\) \{([\s\S]*?)\s*default:/;
                const switchMatch = updatedContent.match(switchRegex);

                if (switchMatch) {
                    const switchContent = switchMatch[1];
                    // 更安全的删除方式：按case块删除
                    const casePattern = new RegExp(`\\s*case\\s+'${providerKey}':[\\s\\S]*?break;\\s*`, 'g');
                    let newSwitchContent = switchContent.replace(casePattern, '');

                    // 确保格式正确
                    newSwitchContent = newSwitchContent.trim();
                    if (newSwitchContent && !newSwitchContent.endsWith('\n')) {
                        newSwitchContent += '\n';
                    }

                    updatedContent = updatedContent.replace(switchRegex, `switch (providerName) {\n${newSwitchContent}\t\t\tdefault:`);
                }

                return updatedContent;
            });

            return updated;
        } catch (error) {
            throw new Error(`更新 config-manager.js 文件失败: ${error.message}`);
        }
    }

    /**
     * 从UI工具的configManager.js中删除默认供应商配置
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async removeProviderFromUIConfigManager(providerName) {
        const uiConfigManagerPath = 'ui-config-tool/src/utils/configManager.js';
        const providerKey = providerName.toLowerCase();
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const updated = await this.saveConfig.updateFileContent(projectDirHandle, uiConfigManagerPath, (existingContent) => {
                // 删除默认供应商配置对象
                const providerObjectRegex = new RegExp(
                    `\\s*\\{[^}]*id:\\s*'provider_${providerKey}_default'[^}]*\\}\\s*,?`,
                    'g'
                );

                let updatedContent = existingContent.replace(providerObjectRegex, '');

                // 清理多余的逗号
                updatedContent = updatedContent.replace(/,\s*,/g, ',');
                updatedContent = updatedContent.replace(/,\s*\]/g, '\n        ]');

                return updatedContent;
            });

            return updated;
        } catch (error) {
            throw new Error(`更新 UI configManager.js 文件失败: ${error.message}`);
        }
    }

    /**
     * 从UI工具的ConfigTransformer.js中删除供应商配置
     * @param {string} providerName - 供应商名称
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async removeProviderFromConfigTransformer(providerName) {
        const configTransformerPath = 'ui-config-tool/src/utils/ConfigTransformer.js';
        const providerKey = providerName.toLowerCase();
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        try {
            const updated = await this.saveConfig.updateFileContent(projectDirHandle, configTransformerPath, (existingContent) => {
                let updatedContent = existingContent;

                // 1. 从providerTypeMap中删除
                const typeMapRegex = /this\.providerTypeMap = \{([\s\S]*?)\};/s;
                const typeMapMatch = updatedContent.match(typeMapRegex);

                if (typeMapMatch) {
                    const typeMapContent = typeMapMatch[1];
                    // 按行删除，更安全
                    const lines = typeMapContent.split('\n');
                    const filteredLines = lines.filter(line => {
                        const trimmedLine = line.trim();
                        return !trimmedLine.includes(`'${providerKey}':`) || trimmedLine.startsWith('//');
                    });
                    const newTypeMapContent = filteredLines.join('\n');
                    const cleanedTypeMapContent = newTypeMapContent.replace(/,\s*,/g, ',').replace(/,\s*\n\s*\}/g, '\n        }');

                    updatedContent = updatedContent.replace(typeMapRegex, `this.providerTypeMap = {${cleanedTypeMapContent}};`);
                }

                // 2. 从defaultEndpoints中删除
                const endpointsRegex = /this\.defaultEndpoints = \{([\s\S]*?)\};/s;
                const endpointsMatch = updatedContent.match(endpointsRegex);

                if (endpointsMatch) {
                    const endpointsContent = endpointsMatch[1];
                    // 按行删除，更安全
                    const lines = endpointsContent.split('\n');
                    const filteredLines = lines.filter(line => {
                        const trimmedLine = line.trim();
                        return !trimmedLine.includes(`'${providerKey}':`) || trimmedLine.startsWith('//');
                    });
                    const newEndpointsContent = filteredLines.join('\n');
                    const cleanedEndpointsContent = newEndpointsContent.replace(/,\s*,/g, ',').replace(/,\s*\n\s*\}/g, '\n        }');

                    updatedContent = updatedContent.replace(endpointsRegex, `this.defaultEndpoints = {${cleanedEndpointsContent}};`);
                }

                // 3. 从nameMap中删除
                const nameMapRegex = /const nameMap = \{([\s\S]*?)\};/s;
                const nameMapMatch = updatedContent.match(nameMapRegex);

                if (nameMapMatch) {
                    const nameMapContent = nameMapMatch[1];
                    // 按行删除，更安全
                    const lines = nameMapContent.split('\n');
                    const filteredLines = lines.filter(line => {
                        const trimmedLine = line.trim();
                        return !trimmedLine.includes(`'${providerKey}':`) || trimmedLine.startsWith('//');
                    });
                    const newNameMapContent = filteredLines.join('\n');
                    const cleanedNameMapContent = newNameMapContent.replace(/,\s*,/g, ',').replace(/,\s*\n\s*\}/g, '\n        }');

                    updatedContent = updatedContent.replace(nameMapRegex, `const nameMap = {${cleanedNameMapContent}};`);
                }

                return updatedContent;
            });

            return updated;
        } catch (error) {
            throw new Error(`更新 ConfigTransformer.js 文件失败: ${error.message}`);
        }
    }
}
