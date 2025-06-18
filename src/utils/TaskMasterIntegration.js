/**
 * TaskMasterIntegration.js
 * 集成TaskMaster包定位和UI工具的功能
 */

import { taskMasterLocator } from './TaskMasterPackageLocator.js';

export class TaskMasterIntegration {
    constructor() {
        this.packageInfo = null;
        this.providers = new Map();
    }

    /**
     * 初始化TaskMaster集成
     */
    async initialize() {
        console.log('正在定位TaskMaster包...');
        
        this.packageInfo = await taskMasterLocator.findTaskMasterPackage();
        
        if (this.packageInfo) {
            console.log(`找到TaskMaster包: ${this.packageInfo.type} at ${this.packageInfo.path}`);
            await this.loadProviders();
        } else {
            console.log('未找到TaskMaster包，将使用默认配置');
        }

        return this.packageInfo;
    }

    /**
     * 加载所有供应商
     */
    async loadProviders() {
        if (!this.packageInfo) return;

        const providerFiles = await taskMasterLocator.getProviderFiles(this.packageInfo);
        
        for (const provider of providerFiles) {
            try {
                const content = await taskMasterLocator.readProviderFile(provider.path);
                if (content) {
                    const providerInfo = this.parseProviderFile(content, provider.name);
                    this.providers.set(provider.name, providerInfo);
                }
            } catch (error) {
                console.warn(`无法加载供应商 ${provider.name}:`, error.message);
            }
        }

        console.log(`已加载 ${this.providers.size} 个供应商`);
    }

    /**
     * 解析供应商文件，提取关键信息
     */
    parseProviderFile(content, providerName) {
        const info = {
            name: providerName,
            displayName: this.extractDisplayName(content, providerName),
            defaultEndpoint: this.extractDefaultEndpoint(content),
            models: this.extractModels(content),
            requiredFields: this.extractRequiredFields(content),
            hasBuiltinEndpoint: this.hasBuiltinEndpoint(content)
        };

        return info;
    }

    /**
     * 提取显示名称
     */
    extractDisplayName(content, fallback) {
        // 尝试从注释或类名中提取显示名称
        const displayNameMatch = content.match(/\/\*\*[\s\S]*?@name\s+([^\n\r]+)/);
        if (displayNameMatch) {
            return displayNameMatch[1].trim();
        }

        const classMatch = content.match(/class\s+(\w+)/);
        if (classMatch) {
            return classMatch[1].replace('Provider', '');
        }

        return fallback.charAt(0).toUpperCase() + fallback.slice(1);
    }

    /**
     * 提取默认端点
     */
    extractDefaultEndpoint(content) {
        const endpointMatch = content.match(/this\.endpoint\s*=\s*['"`]([^'"`]+)['"`]/);
        if (endpointMatch) {
            return endpointMatch[1];
        }

        const baseUrlMatch = content.match(/baseURL:\s*['"`]([^'"`]+)['"`]/);
        if (baseUrlMatch) {
            return baseUrlMatch[1];
        }

        return null;
    }

    /**
     * 提取模型列表
     */
    extractModels(content) {
        const models = [];
        
        // 查找模型定义
        const modelMatches = content.matchAll(/['"`]([^'"`]*(?:gpt|claude|gemini|llama|mistral|qwen)[^'"`]*)['"`]/gi);
        for (const match of modelMatches) {
            const model = match[1];
            if (model && !models.includes(model)) {
                models.push(model);
            }
        }

        return models;
    }

    /**
     * 提取必需字段
     */
    extractRequiredFields(content) {
        const fields = ['apiKey']; // 默认需要API密钥
        
        // 检查是否需要其他字段
        if (content.includes('endpoint') || content.includes('baseURL')) {
            fields.push('endpoint');
        }
        
        if (content.includes('region')) {
            fields.push('region');
        }

        return fields;
    }

    /**
     * 检查是否有内置端点
     */
    hasBuiltinEndpoint(content) {
        return content.includes('this.endpoint =') || content.includes('baseURL:');
    }

    /**
     * 获取所有供应商信息
     */
    getProviders() {
        return Array.from(this.providers.values());
    }

    /**
     * 获取特定供应商信息
     */
    getProvider(name) {
        return this.providers.get(name);
    }

    /**
     * 检查供应商是否为默认供应商（应该被过滤）
     */
    isDefaultProvider(providerName) {
        const defaultProviders = [
            'anthropic', 'openai', 'google', 'azure', 'openrouter', 
            'perplexity', 'ollama', 'xai', 'bedrock', 'google-vertex'
        ];
        return defaultProviders.includes(providerName.toLowerCase());
    }

    /**
     * 获取非默认供应商（用于UI显示）
     */
    getCustomProviders() {
        return this.getProviders().filter(provider => 
            !this.isDefaultProvider(provider.name)
        );
    }

    /**
     * 获取包信息
     */
    getPackageInfo() {
        return this.packageInfo;
    }

    /**
     * 检查是否成功初始化
     */
    isInitialized() {
        return this.packageInfo !== null;
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.isInitialized(),
            packageType: this.packageInfo?.type || 'not-found',
            packagePath: this.packageInfo?.path || null,
            providersCount: this.providers.size,
            customProvidersCount: this.getCustomProviders().length
        };
    }
}

// 导出单例实例
export const taskMasterIntegration = new TaskMasterIntegration();
