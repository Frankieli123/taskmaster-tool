/**
 * SaveConfig.js
 * Component for managing configuration import/export operations
 */



import { ConfigTransformer } from '../utils/ConfigTransformer.js';
import { Logger } from '../utils/Logger.js';
import { DirectoryHandleManager } from '../utils/DirectoryHandleManager.js';
import { ProviderFileParser } from '../utils/ProviderFileParser.js';

export class SaveConfig {
    constructor(configManager) {
        this.configManager = configManager;
        this.transformer = new ConfigTransformer();

        // Directory handle cache for File System Access API
        this.directoryHandleCache = new Map();
        this.fileHandleCache = new Map();

        // Directory handle manager for persistent storage
        this.directoryHandleManager = new DirectoryHandleManager();

        // Provider file parser for dynamic provider configuration
        this.providerFileParser = new ProviderFileParser(this);
    }

    initialize() {
        // Component is initialized through main app event listeners
    }



    async exportToTaskMaster() {
        try {
            // Get current configuration
            const providers = await this.configManager.getProviders();
            const models = await this.configManager.getModels();

            // Validate configuration before export
            const validation = this.transformer.validateUiConfig(providers, models);
            if (!validation.isValid) {
                throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
            }

            // Transform to Task Master format using ConfigTransformer
            const taskMasterConfig = this.transformer.uiToTaskMaster(providers, models);

            // Validate TaskMaster configuration
            const tmValidation = this.transformer.validateTaskMasterConfig(taskMasterConfig);
            if (!tmValidation.isValid) {
                throw new Error(`TaskMaster 配置验证失败: ${tmValidation.errors.join(', ')}`);
            }

            // Save to Task Master configuration files
            await this.saveToTaskMasterFiles(taskMasterConfig);

            return true;
        } catch (error) {
            Logger.error('Failed to export to Task Master', { error: error.message }, error);
            throw error;
        }
    }

    async importFromTaskMaster() {
        try {
            // Read Task Master configuration files
            const taskMasterConfig = await this.readTaskMasterFiles();

            // Validate TaskMaster configuration
            const tmValidation = this.transformer.validateTaskMasterConfig(taskMasterConfig);
            if (!tmValidation.isValid) {
                throw new Error(`TaskMaster 配置验证失败: ${tmValidation.errors.join(', ')}`);
            }

            // Transform to UI tool format using ConfigTransformer
            const { providers, models } = await this.transformer.taskMasterToUi(taskMasterConfig);

            // Validate UI configuration
            const validation = this.transformer.validateUiConfig(providers, models);
            if (!validation.isValid) {
                throw new Error(`UI 配置验证失败: ${validation.errors.join(', ')}`);
            }

            // Update configuration manager
            await this.configManager.importConfiguration(providers, models);

            return true;
        } catch (error) {
            Logger.error('Failed to import from Task Master', { error: error.message }, error);
            throw error;
        }
    }



    async saveToTaskMasterFiles(taskMasterConfig) {
        try {
            // Check if project path is set
            if (!this.configManager.isProjectValid()) {
                throw new Error('TaskMaster 项目路径未设置或无效。请先选择有效的项目路径。');
            }

            // Save supported-models.json
            Logger.info('正在保存 supported-models.json...');
            await this.writeJsonFileWithBackup('supported-models.json', taskMasterConfig.supportedModels);

            // For config.json, we'll need to merge with existing config
            // Since we can't directly read the existing file in browser environment,
            // we'll save the new config and let user manually merge if needed
            Logger.info('正在保存 config.json...');
            await this.writeJsonFileWithBackup('config.json', taskMasterConfig.config);

            return true;
        } catch (error) {
            Logger.error('Failed to save Task Master files', { error: error.message }, error);
            throw error;
        }
    }

    async readTaskMasterFiles() {
        try {
            // Check if project path is set
            if (!this.configManager.isProjectValid()) {
                throw new Error('TaskMaster 项目路径未设置或无效。请先选择有效的项目路径。');
            }

            // Try to restore directory handle from IndexedDB first
            let projectDirHandle = await this.directoryHandleManager.restoreWithPermission('taskmaster-project', 'read');

            if (!projectDirHandle) {
                // Try to use cached directory handle
                projectDirHandle = this.directoryHandleCache.get('taskmaster-project');

                if (projectDirHandle) {
                    // Check permission for cached handle
                    const hasPermission = await this.directoryHandleManager.requestPermission(projectDirHandle, 'read');
                    if (!hasPermission) {
                        projectDirHandle = null;
                        this.directoryHandleCache.delete('taskmaster-project');
                    }
                }
            }

            if (!projectDirHandle) {
                // Request directory access
                if ('showDirectoryPicker' in window) {
                    try {
                        projectDirHandle = await window.showDirectoryPicker({
                            mode: 'read',
                            startIn: 'documents'
                        });
                        this.directoryHandleCache.set('taskmaster-project', projectDirHandle);
                        // Save to IndexedDB for persistence
                        await this.directoryHandleManager.saveDirectoryHandle('taskmaster-project', projectDirHandle);
                    } catch (error) {
                        if (error.name === 'AbortError') {
                            throw new Error('用户取消了目录选择');
                        }
                        throw error;
                    }
                }
            }

            // Read supported-models.json
            Logger.info('正在读取 supported-models.json...');
            const supportedModels = await this.readJsonFileFromDirectory(projectDirHandle, 'scripts/modules/supported-models.json');

            // Read .taskmaster/config.json
            Logger.info('正在读取 config.json...');
            const config = await this.readJsonFileFromDirectory(projectDirHandle, '.taskmaster/config.json') || {};

            return {
                supportedModels: supportedModels || {},
                config: config
            };
        } catch (error) {
            Logger.error('Failed to read Task Master files', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 从TaskMaster项目读取真实配置
     */
    async tryAutoLoadExistingConfig() {
        try {
            Logger.info('🔍 开始读取TaskMaster项目配置...');
            Logger.info('🔍 方法被调用了！');

            // 检查是否有项目路径
            if (!this.configManager.isProjectValid()) {
                Logger.error('❌ 没有有效的TaskMaster项目路径');
                return false;
            }

            // 尝试从IndexedDB恢复目录句柄
            let projectDirHandle = await this.directoryHandleManager.restoreWithPermission('taskmaster-project', 'read');

            if (!projectDirHandle) {
                // 尝试使用缓存的目录句柄
                projectDirHandle = this.directoryHandleCache.get('taskmaster-project');

                if (projectDirHandle) {
                    // 检查权限
                    const hasPermission = await this.directoryHandleManager.requestPermission(projectDirHandle, 'read');
                    if (!hasPermission) {
                        projectDirHandle = null;
                        this.directoryHandleCache.delete('taskmaster-project');
                    }
                }
            }

            if (!projectDirHandle) {
                Logger.error('❌ 没有项目目录访问权限');
                Logger.error('💡 请点击"选择项目"按钮选择TaskMaster项目目录');
                return false;
            }

            Logger.info('📁 使用缓存的项目目录句柄: ' + projectDirHandle.name);

            // 读取TaskMaster配置文件
            const taskMasterConfig = await this.readTaskMasterConfig(projectDirHandle);

            if (!taskMasterConfig) {
                Logger.error('❌ 未找到TaskMaster配置文件');
                return false;
            }

            Logger.info('✅ 成功读取TaskMaster配置', { config: taskMasterConfig });

            // 转换为UI格式
            const { providers, models } = await this.transformer.taskMasterToUi(taskMasterConfig);

            Logger.info(`📊 转换结果: ${providers.length} 个供应商, ${models.length} 个模型`);

            // 导入到配置管理器
            await this.configManager.importConfiguration(providers, models);

            Logger.info('🎉 TaskMaster配置加载成功');
            return true;
        } catch (error) {
            Logger.error('❌ 加载TaskMaster配置失败', { error: error.message }, error);
            return false;
        }
    }

    /**
     * 读取TaskMaster项目的配置文件
     */
    async readTaskMasterConfig(projectDirHandle) {
        try {
            const taskMasterConfig = {
                supportedModels: {},
                config: { providers: {}, models: {} }
            };

            // 1. 读取 scripts/modules/supported-models.json
            Logger.info('📖 读取 supported-models.json...');
            try {
                Logger.info('🔍 尝试读取文件路径: scripts/modules/supported-models.json');
                const supportedModelsContent = await this.readFileFromDirectory(
                    projectDirHandle,
                    'scripts/modules/supported-models.json'
                );
                Logger.info('📄 文件内容长度: ' + (supportedModelsContent ? supportedModelsContent.length : 'null'));
                if (supportedModelsContent) {
                    taskMasterConfig.supportedModels = JSON.parse(supportedModelsContent);
                    Logger.info('✅ supported-models.json 读取成功，供应商数量: ' + Object.keys(taskMasterConfig.supportedModels).length);
                } else {
                    Logger.warn('⚠️ supported-models.json 不存在或为空');
                }
            } catch (error) {
                Logger.error('⚠️ 读取 supported-models.json 失败: ' + error.message);
                Logger.error('完整错误', { error: error.message }, error);
            }

            // 2. 读取 .taskmaster/config.json
            Logger.info('📖 读取 .taskmaster/config.json...');
            try {
                const configContent = await this.readFileFromDirectory(
                    projectDirHandle,
                    '.taskmaster/config.json'
                );
                if (configContent) {
                    const config = JSON.parse(configContent);
                    taskMasterConfig.config = config;
                    Logger.info('✅ config.json 读取成功');
                } else {
                    Logger.info('⚠️ config.json 不存在');
                }
            } catch (error) {
                Logger.warn('⚠️ 读取 config.json 失败: ' + error.message);
            }

            // 3. 读取 .cursor/mcp.json 获取API密钥
            Logger.info('📖 读取 .cursor/mcp.json...');
            try {
                const mcpContent = await this.readFileFromDirectory(
                    projectDirHandle,
                    '.cursor/mcp.json'
                );
                if (mcpContent) {
                    const mcpConfig = JSON.parse(mcpContent);
                    const mcpEnv = mcpConfig?.mcpServers?.['taskmaster-api']?.env || {};
                    Logger.info('✅ mcp.json 读取成功');

                    // 根据supportedModels和API密钥构建providers配置
                    taskMasterConfig.config.providers = await this.buildProvidersFromConfig(
                        taskMasterConfig.supportedModels,
                        mcpEnv,
                        projectDirHandle
                    );
                } else {
                    Logger.info('⚠️ mcp.json 不存在，将使用默认供应商配置');
                    // 没有API密钥，创建默认供应商配置
                    taskMasterConfig.config.providers = await this.buildDefaultProviders(
                        taskMasterConfig.supportedModels,
                        projectDirHandle
                    );
                }
            } catch (error) {
                Logger.warn('⚠️ 读取 mcp.json 失败: ' + error.message);
                // 创建默认供应商配置
                taskMasterConfig.config.providers = await this.buildDefaultProviders(
                    taskMasterConfig.supportedModels,
                    projectDirHandle
                );
            }

            // 检查是否读取到任何配置
            const hasModels = Object.keys(taskMasterConfig.supportedModels).length > 0;
            const hasProviders = Object.keys(taskMasterConfig.config.providers || {}).length > 0;

            if (!hasModels && !hasProviders) {
                Logger.warn('❌ 未找到任何TaskMaster配置');
                return null;
            }

            Logger.info(`📊 配置读取完成: ${Object.keys(taskMasterConfig.supportedModels).length} 个供应商类型, ${hasProviders ? Object.keys(taskMasterConfig.config.providers).length : 0} 个供应商配置`);
            return taskMasterConfig;
        } catch (error) {
            Logger.error('❌ 读取TaskMaster配置失败', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 根据supportedModels和API密钥构建providers配置
     */
    async buildProvidersFromConfig(supportedModels, mcpEnv, projectDirHandle) {
        const providers = {};

        // 解析供应商文件获取动态配置
        let providerConfigs = {};
        try {
            providerConfigs = await this.providerFileParser.parseAllProviderFiles(projectDirHandle);
            Logger.info(`🔍 解析到 ${Object.keys(providerConfigs).length} 个供应商文件配置`);
        } catch (error) {
            Logger.warn('⚠️ 解析供应商文件失败，使用默认配置:', error.message);
        }

        Object.keys(supportedModels).forEach(providerKey => {
            // 自动生成环境变量名：{PROVIDER_KEY}_API_KEY
            const envVarName = `${providerKey.toUpperCase()}_API_KEY`;
            const apiKey = mcpEnv[envVarName] || '';

            // 获取动态解析的配置或使用默认值
            const providerConfig = providerConfigs[providerKey];

            providers[providerKey] = {
                name: providerConfig?.displayName || this.getProviderDisplayName(providerKey),
                endpoint: providerConfig?.endpoint || this.getDefaultEndpointFallback(providerKey),
                type: providerConfig?.type || this.getProviderType(providerKey),
                apiKey: apiKey
            };
        });

        return providers;
    }

    /**
     * 构建默认供应商配置（没有API密钥时）
     */
    async buildDefaultProviders(supportedModels, projectDirHandle) {
        const providers = {};

        // 解析供应商文件获取动态配置
        let providerConfigs = {};
        try {
            providerConfigs = await this.providerFileParser.parseAllProviderFiles(projectDirHandle);
            Logger.info(`🔍 解析到 ${Object.keys(providerConfigs).length} 个供应商文件配置`);
        } catch (error) {
            Logger.warn('⚠️ 解析供应商文件失败，使用默认配置:', error.message);
        }

        Object.keys(supportedModels).forEach(providerKey => {
            // 获取动态解析的配置或使用默认值
            const providerConfig = providerConfigs[providerKey];

            providers[providerKey] = {
                name: providerConfig?.displayName || this.getProviderDisplayName(providerKey),
                endpoint: providerConfig?.endpoint || this.getDefaultEndpointFallback(providerKey),
                type: providerConfig?.type || this.getProviderType(providerKey),
                apiKey: '请在编辑时设置您的API密钥'
            };
        });

        return providers;
    }

    /**
     * 获取默认端点（备用方案）
     */
    getDefaultEndpointFallback(providerKey) {
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
            'whi': 'https://doi9.top'
        };
        return defaultEndpoints[providerKey] || `https://api.${providerKey.toLowerCase()}.com`;
    }

    /**
     * 获取供应商显示名称
     */
    getProviderDisplayName(providerKey) {
        const nameMap = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google',
            'polo': 'PoloAI',
            'poloai': 'PoloAI',
            'foapi': 'FoApi',
            'aoapi': 'AoApi',
            'perplexity': 'Perplexity',
            'xai': 'xAI',
            'openrouter': 'OpenRouter',
            'ollama': 'Ollama',
            'whi': 'Whi'
        };
        return nameMap[providerKey] || providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
    }

    /**
     * 获取供应商类型
     */
    getProviderType(providerKey) {
        const typeMap = {
            'openai': 'openai',
            'anthropic': 'anthropic',
            'google': 'google',
            'polo': 'openai',
            'poloai': 'openai',
            'foapi': 'openai',
            'aoapi': 'openai',
            'perplexity': 'openai',
            'xai': 'openai',
            'openrouter': 'openai',
            'ollama': 'custom',
            'whi': 'openai'
        };
        return typeMap[providerKey] || 'openai';
    }

    /**
     * 保存配置到TaskMaster项目
     */
    async saveToTaskMasterProject() {
        try {
            Logger.info('💾 开始保存配置到TaskMaster项目...');

            if (!this.configManager.isProjectValid()) {
                throw new Error('TaskMaster 项目路径未设置或无效。请先选择有效的项目路径。');
            }

            // 获取当前配置
            const providers = await this.configManager.getProviders();
            const models = await this.configManager.getModels();

            Logger.info(`📊 准备保存: ${providers.length} 个供应商, ${models.length} 个模型`);

            // 转换为TaskMaster格式
            const taskMasterConfig = this.transformer.uiToTaskMaster(providers, models);

            // 尝试从IndexedDB恢复目录句柄
            let projectDirHandle = await this.directoryHandleManager.restoreWithPermission('taskmaster-project', 'readwrite');

            if (!projectDirHandle) {
                // 尝试使用缓存的目录句柄
                projectDirHandle = this.directoryHandleCache.get('taskmaster-project');

                if (projectDirHandle) {
                    // 检查权限
                    const hasPermission = await this.directoryHandleManager.requestPermission(projectDirHandle, 'readwrite');
                    if (!hasPermission) {
                        projectDirHandle = null;
                        this.directoryHandleCache.delete('taskmaster-project');
                    }
                }
            }

            if (!projectDirHandle) {
                Logger.info('📁 请求TaskMaster项目目录访问权限...');
                if ('showDirectoryPicker' in window) {
                    projectDirHandle = await window.showDirectoryPicker({
                        mode: 'readwrite',
                        startIn: 'documents'
                    });
                    this.directoryHandleCache.set('taskmaster-project', projectDirHandle);
                    // Save to IndexedDB for persistence
                    await this.directoryHandleManager.saveDirectoryHandle('taskmaster-project', projectDirHandle);
                } else {
                    throw new Error('浏览器不支持File System Access API');
                }
            }

            // 保存配置文件到TaskMaster项目
            await this.saveTaskMasterConfigFiles(projectDirHandle, taskMasterConfig);

            // 保存API密钥到MCP配置文件
            await this.saveMCPConfigFile(projectDirHandle, providers);

            Logger.info('✅ 配置已成功保存到TaskMaster项目');
            return true;
        } catch (error) {
            Logger.error('❌ 保存到TaskMaster项目失败', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 保存TaskMaster配置文件
     */
    async saveTaskMasterConfigFiles(projectDirHandle, taskMasterConfig) {
        try {
            // 只保存 scripts/modules/supported-models.json
            // config.json 由用户通过 TaskMaster 初始化流程管理
            if (taskMasterConfig.supportedModels && Object.keys(taskMasterConfig.supportedModels).length > 0) {
                Logger.info('💾 保存 supported-models.json...');
                await this.writeFileToDirectory(
                    projectDirHandle,
                    'scripts/modules/supported-models.json',
                    JSON.stringify(taskMasterConfig.supportedModels, null, 2)
                );
                Logger.info('✅ supported-models.json 保存成功');
            }

            Logger.info('🎉 TaskMaster配置文件保存完成');
        } catch (error) {
            Logger.error('❌ 保存TaskMaster配置文件失败', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 保存API密钥到MCP配置文件
     */
    async saveMCPConfigFile(projectDirHandle, providers) {
        try {
            Logger.info('💾 保存API密钥到 .cursor/mcp.json...');

            // 读取现有的MCP配置
            let mcpConfig = {};
            try {
                const mcpContent = await this.readFileFromDirectory(
                    projectDirHandle,
                    '.cursor/mcp.json'
                );
                if (mcpContent) {
                    mcpConfig = JSON.parse(mcpContent);
                }
            } catch (error) {
                Logger.info('📄 .cursor/mcp.json 不存在，将创建新文件');
                // 创建默认的MCP配置结构
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

            // 更新每个供应商的API密钥
            providers.forEach(provider => {
                if (provider.apiKey && provider.apiKey.trim() !== '') {
                    // 自动生成环境变量名：{PROVIDER_NAME}_API_KEY
                    const providerKey = provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const envVarName = `${providerKey.toUpperCase()}_API_KEY`;

                    // 保存API密钥到MCP环境变量
                    mcpEnv[envVarName] = provider.apiKey;
                    Logger.info(`🔑 更新 ${envVarName}: ${provider.apiKey.substring(0, 8)}...`);
                }
            });

            // 保存更新后的MCP配置
            await this.writeFileToDirectory(
                projectDirHandle,
                '.cursor/mcp.json',
                JSON.stringify(mcpConfig, null, 2)
            );

            Logger.info('✅ .cursor/mcp.json 保存成功');
        } catch (error) {
            Logger.error('❌ 保存MCP配置文件失败', { error: error.message }, error);
            // 不抛出错误，因为这不是关键功能
            Logger.warn('⚠️ MCP配置保存失败，但TaskMaster配置已成功保存');
        }
    }

    async readJsonFile(filePath) {
        try {
            // Use File System Access API if available
            if (this.isFileSystemAccessSupported()) {
                return await this.readJsonFileWithFSA(filePath);
            } else {
                // Fallback: prompt user to select file
                return await this.readJsonFileWithInput(filePath);
            }
        } catch (error) {
            Logger.error(`Failed to read JSON file ${filePath}`, { error: error.message }, error);
            throw new Error(`读取文件失败: ${this.getFileName(filePath)} - ${error.message}`);
        }
    }

    async readJsonFileWithFSA(filePath) {
        try {
            const fileName = this.getFileName(filePath);

            // Check if we have a cached file handle
            const cacheKey = `file-${fileName}`;
            let fileHandle = this.fileHandleCache.get(cacheKey);

            if (fileHandle) {
                // Check permission for cached handle
                const permission = await fileHandle.queryPermission({ mode: 'read' });
                if (permission !== 'granted') {
                    const requestPermission = await fileHandle.requestPermission({ mode: 'read' });
                    if (requestPermission !== 'granted') {
                        // Remove invalid handle from cache
                        this.fileHandleCache.delete(cacheKey);
                        fileHandle = null;
                    }
                }
            }

            if (!fileHandle) {
                // Use file picker to select file
                const pickerOptions = {
                    types: [{
                        description: 'JSON files',
                        accept: { 'application/json': ['.json'] }
                    }],
                    multiple: false
                };

                const [selectedFileHandle] = await window.showOpenFilePicker(pickerOptions);
                fileHandle = selectedFileHandle;

                // Cache the file handle
                this.fileHandleCache.set(cacheKey, fileHandle);
            }

            // Read file content
            const file = await fileHandle.getFile();
            const content = await file.text();
            const jsonData = JSON.parse(content);

            return jsonData;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('用户取消了文件选择');
            }
            throw error;
        }
    }

    async readJsonFileWithInput(_filePath) {
        // Fallback method for older browsers - use input element
        // const fileName = this.getFileName(filePath); // 暂时不使用

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';

        return new Promise((resolve, reject) => {
            input.addEventListener('change', async (event) => {
                try {
                    const file = event.target.files[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }

                    const content = await file.text();
                    const jsonData = JSON.parse(content);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                } finally {
                    document.body.removeChild(input);
                }
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    /**
     * Read JSON file from a directory handle using File System Access API
     */
    async readJsonFileFromDirectory(directoryHandle, relativePath) {
        try {
            if (!directoryHandle) {
                throw new Error('目录句柄无效');
            }

            // Navigate to the file through the directory structure
            const pathParts = relativePath.split('/').filter(part => part.length > 0);
            let currentHandle = directoryHandle;

            // Navigate through directories
            for (let i = 0; i < pathParts.length - 1; i++) {
                const dirName = pathParts[i];
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(dirName);
                } catch (error) {
                    throw new Error(`找不到目录: ${dirName}`);
                }
            }

            // Get the file
            const fileName = pathParts[pathParts.length - 1];
            try {
                const fileHandle = await currentHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                const content = await file.text();
                return JSON.parse(content);
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    Logger.warn(`文件不存在: ${relativePath}`);
                    return null;
                }
                throw error;
            }
        } catch (error) {
            Logger.error(`读取文件失败 ${relativePath}`, { error: error.message }, error);
            throw error;
        }
    }

    async writeJsonFileWithBackup(filePath, data) {
        try {
            const fileName = this.getFileName(filePath);
            const jsonContent = JSON.stringify(data, null, 2);

            // Use File System Access API if available
            if (this.isFileSystemAccessSupported()) {
                return await this.writeJsonFileWithFSA(fileName, jsonContent);
            } else {
                // Fallback: download file
                return await this.downloadJsonFile(fileName, jsonContent);
            }
        } catch (error) {
            Logger.error(`Failed to write JSON file ${filePath}`, { error: error.message }, error);
            throw new Error(`写入文件失败: ${this.getFileName(filePath)} - ${error.message}`);
        }
    }

    async writeJsonFileWithFSA(fileName, content) {
        try {
            // Check if we have a cached file handle for this file
            const cacheKey = `file-${fileName}`;
            let fileHandle = this.fileHandleCache.get(cacheKey);

            if (fileHandle) {
                // Check write permission for cached handle
                const permission = await fileHandle.queryPermission({ mode: 'readwrite' });
                if (permission !== 'granted') {
                    const requestPermission = await fileHandle.requestPermission({ mode: 'readwrite' });
                    if (requestPermission !== 'granted') {
                        // Remove invalid handle from cache and create new one
                        this.fileHandleCache.delete(cacheKey);
                        fileHandle = null;
                    }
                }
            }

            if (!fileHandle) {
                // Provide better file picker options based on file type
                const pickerOptions = {
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON files',
                        accept: { 'application/json': ['.json'] }
                    }]
                };

                // Add helpful description for TaskMaster files
                if (fileName === 'supported-models.json') {
                    pickerOptions.suggestedName = 'supported-models.json';
                    pickerOptions.types[0].description = 'TaskMaster Supported Models (supported-models.json)';
                } else if (fileName === 'config.json') {
                    pickerOptions.suggestedName = 'config.json';
                    pickerOptions.types[0].description = 'TaskMaster Configuration (config.json)';
                }

                fileHandle = await window.showSaveFilePicker(pickerOptions);

                // Cache the file handle for future use
                this.fileHandleCache.set(cacheKey, fileHandle);
            }

            // Write to file
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            Logger.info(`Successfully wrote file: ${fileName}`);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('用户取消了文件保存');
            }
            throw error;
        }
    }

    async downloadJsonFile(fileName, content) {
        // Fallback: create download link
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Logger.info(`Downloaded file: ${fileName}`);
        return true;
    }

    getFileName(filePath) {
        return filePath.split('/').pop().split('\\').pop();
    }

    /**
     * Clear cached directory and file handles
     */
    clearHandleCache() {
        this.directoryHandleCache.clear();
        this.fileHandleCache.clear();
        Logger.info('File System Access API 缓存已清理');
    }

    /**
     * Check if File System Access API is supported
     */
    isFileSystemAccessSupported() {
        return 'showDirectoryPicker' in window && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
    }

    /**
     * 写入JavaScript文件到TaskMaster项目
     */
    async writeJavaScriptFile(relativePath, content) {
        try {
            if (!this.configManager.isProjectValid()) {
                throw new Error('TaskMaster 项目路径未设置或无效。请先选择有效的项目路径。');
            }

            // 获取项目目录句柄
            let projectDirHandle = this.directoryHandleCache.get('taskmaster-project');

            if (!projectDirHandle) {
                // 请求目录访问权限
                if ('showDirectoryPicker' in window) {
                    projectDirHandle = await window.showDirectoryPicker({
                        mode: 'readwrite',
                        startIn: 'documents'
                    });
                    this.directoryHandleCache.set('taskmaster-project', projectDirHandle);
                } else {
                    throw new Error('浏览器不支持File System Access API');
                }
            }

            // 写入文件到指定路径
            await this.writeFileToDirectory(projectDirHandle, relativePath, content);

            Logger.info(`Successfully wrote JavaScript file: ${relativePath}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to write JavaScript file ${relativePath}`, { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 写入文件到目录结构中
     */
    async writeFileToDirectory(directoryHandle, relativePath, content) {
        try {
            const pathParts = relativePath.split('/').filter(part => part.length > 0);
            let currentHandle = directoryHandle;

            // 创建/导航到目录结构
            for (let i = 0; i < pathParts.length - 1; i++) {
                const dirName = pathParts[i];
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(dirName);
                } catch (error) {
                    if (error.name === 'NotFoundError') {
                        // 目录不存在，创建它
                        currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true });
                    } else {
                        throw error;
                    }
                }
            }

            // 创建/写入文件
            const fileName = pathParts[pathParts.length - 1];
            const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });

            // 写入内容
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            return true;
        } catch (error) {
            Logger.error(`写入文件失败 ${relativePath}`, { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 更新现有文件（如在index.js中添加导出行）
     */
    async updateExistingFile(relativePath, updateFunction) {
        try {
            if (!this.configManager.isProjectValid()) {
                throw new Error('TaskMaster 项目路径未设置或无效。请先选择有效的项目路径。');
            }

            // 获取项目目录句柄
            let projectDirHandle = this.directoryHandleCache.get('taskmaster-project');

            if (!projectDirHandle) {
                projectDirHandle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'documents'
                });
                this.directoryHandleCache.set('taskmaster-project', projectDirHandle);
            }

            // 读取现有文件内容
            const existingContent = await this.readFileFromDirectory(projectDirHandle, relativePath);

            // 使用更新函数处理内容
            const updatedContent = updateFunction(existingContent || '');

            // 写入更新后的内容
            await this.writeFileToDirectory(projectDirHandle, relativePath, updatedContent);

            Logger.info(`Successfully updated file: ${relativePath}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to update file ${relativePath}`, { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 从目录中读取文件内容（支持任意文件类型）
     */
    async readFileFromDirectory(directoryHandle, relativePath) {
        try {
            const pathParts = relativePath.split('/').filter(part => part.length > 0);
            let currentHandle = directoryHandle;

            // 导航到目录
            for (let i = 0; i < pathParts.length - 1; i++) {
                const dirName = pathParts[i];
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(dirName);
                } catch (error) {
                    if (error.name === 'NotFoundError') {
                        return null; // 目录不存在
                    }
                    throw error;
                }
            }

            // 读取文件
            const fileName = pathParts[pathParts.length - 1];
            try {
                const fileHandle = await currentHandle.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                return await file.text();
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    return null; // 文件不存在
                }
                throw error;
            }
        } catch (error) {
            Logger.error(`读取文件失败 ${relativePath}`, { error: error.message }, error);
            throw error;
        }
    }

    // Note: Provider and model utility methods are now handled by ConfigTransformer

    async exportConfigurationFile() {
        try {
            const providers = await this.configManager.getProviders();
            const models = await this.configManager.getModels();

            const exportData = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                providers: providers,
                models: models
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `taskmaster-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            Logger.error('Failed to export configuration file', { error: error.message }, error);
            throw error;
        }
    }

    async importConfigurationFile(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.providers || !importData.models) {
                throw new Error('Invalid configuration file format');
            }

            await this.configManager.importConfiguration(importData.providers, importData.models);
            return true;
        } catch (error) {
            Logger.error('Failed to import configuration file', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 从目录中删除指定文件
     * @param {FileSystemDirectoryHandle} dirHandle - 目录句柄
     * @param {string} filePath - 要删除的文件路径
     * @returns {Promise<boolean>} - 删除是否成功
     */
    async deleteFileFromDirectory(dirHandle, filePath) {
        try {
            const pathParts = filePath.split('/').filter(part => part.length > 0);
            let currentDir = dirHandle;

            // 导航到文件所在的目录
            for (let i = 0; i < pathParts.length - 1; i++) {
                try {
                    currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
                } catch (error) {
                    if (error.name === 'NotFoundError') {
                        Logger.warn(`Directory not found: ${pathParts.slice(0, i + 1).join('/')}`);
                        return false; // 目录不存在，文件也不存在
                    }
                    throw error;
                }
            }

            const fileName = pathParts[pathParts.length - 1];

            try {
                await currentDir.removeEntry(fileName);
                Logger.info(`Successfully deleted file: ${filePath}`);
                return true;
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    Logger.warn(`File not found: ${filePath}`);
                    return false; // 文件不存在，视为删除成功
                }
                throw error;
            }
        } catch (error) {
            Logger.error(`Failed to delete file: ${filePath}`, { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 更新文件内容
     * @param {FileSystemDirectoryHandle} dirHandle - 目录句柄
     * @param {string} filePath - 文件路径
     * @param {Function} updateFunction - 更新函数，接收当前内容，返回新内容
     * @returns {Promise<boolean>} - 更新是否成功
     */
    async updateFileContent(dirHandle, filePath, updateFunction) {
        try {
            // 读取当前文件内容
            let currentContent = '';
            try {
                currentContent = await this.readFileFromDirectory(dirHandle, filePath);
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    Logger.warn(`File not found for update: ${filePath}`);
                    return false;
                }
                throw error;
            }

            // 应用更新函数
            const newContent = updateFunction(currentContent);

            // 写入新内容
            await this.writeFileToDirectory(dirHandle, filePath, newContent);
            Logger.info(`Successfully updated file: ${filePath}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to update file: ${filePath}`, { error: error.message }, error);
            throw error;
        }
    }
}
