/**
 * configManager.js
 * Central configuration management utility for the UI tool
 */

import { Validation } from './validation.js';

export class ConfigManager {
    constructor() {
        this.validation = new Validation();
        this.providers = [];
        this.models = [];
        this.storageKey = 'taskmaster-ui-config';
        this.projectPathKey = 'taskmaster-project-path';
        this.packagePathKey = 'taskmaster-package-path';
        this.taskmasterProjectPath = null;
        this.taskmasterPackagePath = null;
        this.isValidProject = false;
        this.isValidPackage = false;
    }

    async loadConfiguration() {
        // Initialize project path first
        await this.initializeProjectPath();

        // Initialize package path
        await this.initializePackagePath();

        // 不从localStorage读取，只保持空状态
        // 模型数据只从TaskMaster项目读取
        this.providers = [];
        this.models = [];

        return true;
    }

    async saveConfiguration() {
        const config = {
            providers: this.providers,
            models: this.models,
            lastUpdated: new Date().toISOString()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(config));

        return true;
    }

    async resetConfiguration() {
        this.providers = [];
        this.models = [];
        localStorage.removeItem(this.storageKey);
        await this.saveConfiguration();
        return true;
    }



    // 获取默认服务商名称列表
    getDefaultProviderNames() {
        return [
            'anthropic', 'azure', 'bedrock', 'google-vertex', 'google',
            'ollama', 'openai', 'openrouter', 'perplexity', 'xai'
        ];
    }

    // 检查是否为默认服务商
    isDefaultProvider(provider) {
        const defaultProviderNames = this.getDefaultProviderNames();
        const providerNameLower = provider.name.toLowerCase();
        const providerKeyLower = (provider.key || '').toLowerCase();
        const providerIdLower = (provider.id || '').toLowerCase();

        return defaultProviderNames.some(defaultName => {
            // 检查名称是否完全匹配或包含默认服务商名称
            const nameMatches = providerNameLower === defaultName ||
                              providerNameLower.includes(defaultName);
            // 检查key是否匹配
            const keyMatches = providerKeyLower === defaultName;
            // 检查ID是否包含默认服务商名称
            const idMatches = providerIdLower.includes(defaultName);

            return nameMatches || keyMatches || idMatches;
        });
    }

    // 检查模型是否属于默认服务商
    isModelFromDefaultProvider(model) {
        // 通过providerId查找对应的provider
        const provider = this.providers.find(p => p.id === model.providerId);
        if (!provider) {
            return false;
        }
        return this.isDefaultProvider(provider);
    }

    // Provider Management
    async getProviders() {
        // 过滤掉默认服务商，只显示自定义添加的服务商
        const filteredProviders = this.providers.filter(provider => !this.isDefaultProvider(provider));

        // 为每个provider添加其对应的models数组，以便UI能正确显示模型数量
        return filteredProviders.map(provider => ({
            ...provider,
            models: this.getModelsByProvider(provider.id)
        }));
    }

    // 获取所有供应商（包括默认服务商），用于内部逻辑检查
    getAllProviders() {
        return [...this.providers];
    }

    async addProvider(providerData) {
        // 不进行严格验证，直接添加供应商
        // Check for duplicate names
        if (this.providers.some(p => p.name === providerData.name && p.id !== providerData.id)) {
            throw new Error('服务商名称已存在');
        }

        this.providers.push(providerData);
        await this.saveConfiguration();
        return providerData;
    }

    async updateProvider(providerData) {
        // 不进行严格验证，直接更新供应商
        const index = this.providers.findIndex(p => p.id === providerData.id);
        if (index === -1) {
            throw new Error('服务商未找到');
        }

        // Check for duplicate names (excluding current provider)
        if (this.providers.some(p => p.name === providerData.name && p.id !== providerData.id)) {
            throw new Error('服务商名称已存在');
        }

        this.providers[index] = providerData;
        await this.saveConfiguration();
        return providerData;
    }

    async deleteProvider(providerId) {
        const index = this.providers.findIndex(p => p.id === providerId);
        if (index === -1) {
            throw new Error('服务商未找到');
        }

        // Remove associated models
        this.models = this.models.filter(m => m.providerId !== providerId);

        // Remove provider
        this.providers.splice(index, 1);
        await this.saveConfiguration();
        return true;
    }

    async testProvider(provider) {
        try {
            // Validate provider configuration
            const validationResult = this.validation.validateProvider(provider);
            if (!validationResult.isValid) {
                return false;
            }

            // Simulate API test (in real implementation, this would make an actual API call)
            if (!provider.endpoint || !provider.apiKey) {
                return false;
            }

            // Mock test - in real implementation, make a simple API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update provider status
            const index = this.providers.findIndex(p => p.id === provider.id);
            if (index !== -1) {
                this.providers[index].isValid = true;
                await this.saveConfiguration();
            }

            return true;
        } catch (error) {
            // Provider test failed
            return false;
        }
    }

    // Model Management
    async getModels() {
        // 筛选掉属于默认服务商的模型，只显示自定义服务商的模型
        return this.models.filter(model => !this.isModelFromDefaultProvider(model));
    }

    async addModel(modelData) {
        // 不进行严格验证，只检查基本必填字段
        if (!modelData.name || !modelData.name.trim()) {
            throw new Error('模型名称不能为空');
        }

        // Check if provider exists
        if (!this.providers.find(p => p.id === modelData.providerId)) {
            throw new Error('服务商未找到');
        }

        // Check for duplicate model IDs globally (跨供应商检查)
        if (this.models.some(m =>
            m.modelId === modelData.modelId &&
            m.id !== modelData.id
        )) {
            throw new Error('系统中已存在相同的模型ID，请使用不同的模型标识');
        }

        this.models.push(modelData);
        await this.saveConfiguration();
        return modelData;
    }

    async updateModel(modelData) {
        // 不进行严格验证，只检查基本必填字段
        if (!modelData.name || !modelData.name.trim()) {
            throw new Error('模型名称不能为空');
        }

        const index = this.models.findIndex(m => m.id === modelData.id);
        if (index === -1) {
            throw new Error('模型未找到');
        }

        // Check if provider exists
        if (!this.providers.find(p => p.id === modelData.providerId)) {
            throw new Error('服务商未找到');
        }

        // Check for duplicate model IDs globally (excluding current model)
        if (this.models.some(m =>
            m.modelId === modelData.modelId &&
            m.id !== modelData.id
        )) {
            throw new Error('系统中已存在相同的模型ID，请使用不同的模型标识');
        }

        this.models[index] = modelData;
        await this.saveConfiguration();
        return modelData;
    }

    async deleteModel(modelId) {
        const index = this.models.findIndex(m => m.id === modelId);
        if (index === -1) {
            throw new Error('模型未找到');
        }

        this.models.splice(index, 1);
        await this.saveConfiguration();
        return true;
    }

    async testModel(model) {
        try {
            // Validate model configuration
            const validationResult = this.validation.validateModel(model);
            if (!validationResult.isValid) {
                return false;
            }

            // Get associated provider
            const provider = this.providers.find(p => p.id === model.providerId);
            if (!provider || !provider.isValid) {
                return false;
            }

            // Simulate model test (in real implementation, this would make an actual API call)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return true;
        } catch (error) {
            // Model test failed
            return false;
        }
    }

    // Import/Export
    async importConfiguration(providers, models) {
        // 直接导入配置，不进行验证
        // 加载到什么字段就在前端显示什么字段
        this.providers = providers || [];
        this.models = models || [];

        await this.saveConfiguration();
        return true;
    }

    async exportConfiguration() {
        return {
            providers: [...this.providers],
            models: [...this.models],
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    // Utility methods
    getProviderById(providerId) {
        return this.providers.find(p => p.id === providerId);
    }

    getModelById(modelId) {
        return this.models.find(m => m.id === modelId);
    }

    getModelsByProvider(providerId) {
        // 筛选掉属于默认服务商的模型
        return this.models.filter(m =>
            m.providerId === providerId && !this.isModelFromDefaultProvider(m)
        );
    }

    getModelsByRole(role) {
        // 筛选掉属于默认服务商的模型
        return this.models.filter(m =>
            m.allowedRoles?.includes(role) && !this.isModelFromDefaultProvider(m)
        );
    }

    generateId(prefix = 'item') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    // TaskMaster Project Path Management

    /**
     * Load the saved TaskMaster project path from localStorage
     * @returns {Promise<string|null>} The saved project path or null if not found
     */
    async loadSavedProjectPath() {
        try {
            const savedPath = localStorage.getItem(this.projectPathKey);
            if (savedPath) {
                this.taskmasterProjectPath = savedPath;
                this.isValidProject = await this.validateProjectPath(savedPath);
                return savedPath;
            }
            return null;
        } catch (error) {
            // Failed to load saved project path
            return null;
        }
    }

    /**
     * Save the TaskMaster project path to localStorage
     * @param {string} projectPath - The project path to save
     * @returns {Promise<boolean>} Success status
     */
    async saveProjectPath(projectPath) {
        if (!projectPath) {
            localStorage.removeItem(this.projectPathKey);
            this.taskmasterProjectPath = null;
            this.isValidProject = false;
            return true;
        }

        const isValid = await this.validateProjectPath(projectPath);
        if (isValid) {
            localStorage.setItem(this.projectPathKey, projectPath);
            this.taskmasterProjectPath = projectPath;
            this.isValidProject = true;
            return true;
        } else {
            throw new Error('无效的 TaskMaster 项目路径');
        }
    }

    /**
     * Validate if a given path is a valid TaskMaster project
     * @param {string} projectPath - The path to validate
     * @returns {Promise<boolean>} True if valid TaskMaster project
     */
    async validateProjectPath(projectPath) {
        try {
            if (!projectPath || typeof projectPath !== 'string') {
                return false;
            }

            // In browser environment, we can only do basic path validation
            // The actual file system validation will be done when user selects files

            // Check if path looks like a valid directory path
            const normalizedPath = projectPath.replace(/\\/g, '/');

            // Basic validation: should not be empty and should look like a path
            if (normalizedPath.length === 0) {
                return false;
            }

            // Check if it contains typical TaskMaster project indicators in the path name
            // const pathLower = normalizedPath.toLowerCase(); // 暂时不使用
            // const hasTaskMasterIndicator = pathLower.includes('task-master') ||
            //                              pathLower.includes('taskmaster') ||
            //                              pathLower.includes('claude-task-master');

            // For now, we'll accept any non-empty path and let the user verify
            // by successfully importing/exporting files
            return true;
        } catch (error) {
            // Error validating project path
            return false;
        }
    }

    /**
     * Get the current TaskMaster project path
     * @returns {string|null} The current project path
     */
    getProjectPath() {
        return this.taskmasterProjectPath;
    }

    /**
     * Check if the current project path is valid
     * @returns {boolean} True if project path is valid
     */
    isProjectValid() {
        return this.isValidProject;
    }

    /**
     * Get TaskMaster configuration file paths
     * @returns {object} Object containing configuration file paths
     */
    getTaskMasterConfigPaths() {
        if (!this.taskmasterProjectPath) {
            return null;
        }

        // Simple path joining for browser environment
        const basePath = this.taskmasterProjectPath.replace(/\\/g, '/').replace(/\/$/, '');

        return {
            supportedModels: `${basePath}/scripts/modules/supported-models.json`,
            config: `${basePath}/.taskmaster/config.json`,
            tasksDir: `${basePath}/.taskmaster/tasks`,
            docsDir: `${basePath}/.taskmaster/docs`
        };
    }

    /**
     * Initialize project path on startup
     * @returns {Promise<boolean>} True if project path was loaded and validated
     */
    async initializeProjectPath() {
        try {
            const savedPath = await this.loadSavedProjectPath();
            if (savedPath && this.isValidProject) {
                // TaskMaster project loaded
                return true;
            } else if (savedPath) {
                // Saved project path is no longer valid
                // Clear invalid path
                await this.saveProjectPath(null);
            }
            return false;
        } catch (error) {
            // Failed to initialize project path
            return false;
        }
    }

    // TaskMaster Package Path Management

    /**
     * Load the saved TaskMaster package path from localStorage
     * @returns {Promise<string|null>} The saved package path or null if not found
     */
    async loadSavedPackagePath() {
        try {
            const savedPath = localStorage.getItem(this.packagePathKey);
            if (savedPath) {
                this.taskmasterPackagePath = savedPath;
                this.isValidPackage = await this.validatePackagePath(savedPath);
                return savedPath;
            }
            return null;
        } catch (error) {
            // Failed to load saved package path
            return null;
        }
    }

    /**
     * Save the TaskMaster package path to localStorage
     * @param {string} packagePath - The package path to save
     * @returns {Promise<boolean>} Success status
     */
    async savePackagePath(packagePath) {
        if (!packagePath) {
            localStorage.removeItem(this.packagePathKey);
            this.taskmasterPackagePath = null;
            this.isValidPackage = false;
            return true;
        }

        const isValid = await this.validatePackagePath(packagePath);
        if (isValid) {
            localStorage.setItem(this.packagePathKey, packagePath);
            this.taskmasterPackagePath = packagePath;
            this.isValidPackage = true;
            return true;
        } else {
            throw new Error('无效的 TaskMaster 包路径');
        }
    }

    /**
     * Validate if a given path is a valid TaskMaster package
     * @param {string} packagePath - The path to validate
     * @returns {Promise<boolean>} True if valid TaskMaster package
     */
    async validatePackagePath(packagePath) {
        try {
            if (!packagePath || typeof packagePath !== 'string') {
                return false;
            }

            // In browser environment, we can only do basic path validation
            // The actual file system validation will be done when user selects directory

            // Check if path looks like a valid directory path
            const normalizedPath = packagePath.replace(/\\/g, '/');

            // Basic validation: should not be empty and should look like a path
            if (normalizedPath.length === 0) {
                return false;
            }

            // For now, we'll accept any non-empty path and let the user verify
            // by successfully accessing the package directory
            return true;
        } catch (error) {
            // Error validating package path
            return false;
        }
    }

    /**
     * Get the current TaskMaster package path
     * @returns {string|null} The current package path
     */
    getPackagePath() {
        return this.taskmasterPackagePath;
    }

    /**
     * Check if the current package path is valid
     * @returns {boolean} True if package path is valid
     */
    isPackageValid() {
        return this.isValidPackage;
    }

    /**
     * Initialize package path on startup
     * @returns {Promise<boolean>} True if package path was loaded and validated
     */
    async initializePackagePath() {
        try {
            const savedPath = await this.loadSavedPackagePath();
            if (savedPath && this.isValidPackage) {
                // TaskMaster package loaded
                return true;
            } else if (savedPath) {
                // Saved package path is no longer valid
                // Clear invalid path
                await this.savePackagePath(null);
            }
            return false;
        } catch (error) {
            // Failed to initialize package path
            return false;
        }
    }
}
