/**
 * ProviderFileParser.js
 * 解析 src/ai-providers/ 目录下的JavaScript文件，提取供应商配置信息
 */

export class ProviderFileParser {
    constructor(saveConfig) {
        this.saveConfig = saveConfig;
    }

    /**
     * 扫描并解析所有供应商文件
     * @param {FileSystemDirectoryHandle} projectDirHandle - TaskMaster项目目录句柄
     * @returns {Object} 供应商配置信息映射表
     */
    async parseAllProviderFiles(projectDirHandle) {
        const providerConfigs = {};
        
        try {
            // 获取 src/ai-providers 目录
            const srcDir = await projectDirHandle.getDirectoryHandle('src');
            const providersDir = await srcDir.getDirectoryHandle('ai-providers');
            
            // 遍历目录中的所有文件
            for await (const [name, handle] of providersDir.entries()) {
                if (handle.kind === 'file' && name.endsWith('.js') && 
                    name !== 'index.js' && name !== 'base-provider.js') {
                    
                    try {
                        const config = await this.parseProviderFile(handle, name);
                        if (config) {
                            providerConfigs[config.key] = config;
                        }
                    } catch (error) {
                        console.warn(`解析供应商文件 ${name} 失败:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.warn('扫描供应商目录失败:', error.message);
        }
        
        return providerConfigs;
    }

    /**
     * 解析单个供应商文件
     * @param {FileSystemFileHandle} fileHandle - 文件句柄
     * @param {string} fileName - 文件名
     * @returns {Object|null} 供应商配置信息
     */
    async parseProviderFile(fileHandle, fileName) {
        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            const providerKey = fileName.replace('.js', '');
            const config = {
                key: providerKey,
                name: this.extractProviderName(content, providerKey),
                endpoint: this.extractDefaultEndpoint(content),
                type: this.extractProviderType(content),
                displayName: this.extractDisplayName(content, providerKey)
            };
            
            return config;
        } catch (error) {
            console.warn(`读取供应商文件 ${fileName} 失败:`, error.message);
            return null;
        }
    }

    /**
     * 从文件内容中提取供应商名称
     * @param {string} content - 文件内容
     * @param {string} fallbackKey - 备用键名
     * @returns {string} 供应商名称
     */
    extractProviderName(content, fallbackKey) {
        // 查找 this.name = 'xxx' 模式
        const nameMatch = content.match(/this\.name\s*=\s*['"`]([^'"`]+)['"`]/);
        if (nameMatch) {
            return nameMatch[1];
        }
        
        // 备用方案：使用文件名
        return fallbackKey;
    }

    /**
     * 从文件内容中提取默认端点
     * @param {string} content - 文件内容
     * @returns {string} 默认端点
     */
    extractDefaultEndpoint(content) {
        // 查找 baseURL || 'https://...' 模式
        const endpointMatch = content.match(/baseURL\s*\|\|\s*['"`](https?:\/\/[^'"`]+)['"`]/);
        if (endpointMatch) {
            return endpointMatch[1];
        }
        
        // 查找 effectiveBaseURL = baseURL || 'https://...' 模式
        const effectiveMatch = content.match(/effectiveBaseURL\s*=\s*baseURL\s*\|\|\s*['"`](https?:\/\/[^'"`]+)['"`]/);
        if (effectiveMatch) {
            return effectiveMatch[1];
        }
        
        // 查找其他可能的端点模式
        const urlMatch = content.match(/['"`](https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[^'"`]*)?)['"`]/);
        if (urlMatch) {
            return urlMatch[1];
        }
        
        return '';
    }

    /**
     * 从文件内容中提取供应商类型
     * @param {string} content - 文件内容
     * @returns {string} 供应商类型
     */
    extractProviderType(content) {
        // 检查是否使用 createOpenAI
        if (content.includes('createOpenAI')) {
            return 'openai';
        }
        
        // 检查是否使用 createAnthropic
        if (content.includes('createAnthropic')) {
            return 'anthropic';
        }
        
        // 检查是否使用 createGoogleGenerativeAI
        if (content.includes('createGoogleGenerativeAI')) {
            return 'google';
        }
        
        // 检查是否是 Ollama
        if (content.includes('ollama') || content.includes('Ollama')) {
            return 'ollama';
        }
        
        // 默认为 openai（大多数新供应商都是OpenAI兼容的）
        return 'openai';
    }

    /**
     * 提取显示名称
     * @param {string} content - 文件内容
     * @param {string} fallbackKey - 备用键名
     * @returns {string} 显示名称
     */
    extractDisplayName(content, fallbackKey) {
        // 查找类名，如 export class WhiProvider
        const classMatch = content.match(/export\s+class\s+(\w+)Provider/);
        if (classMatch) {
            return classMatch[1];
        }
        
        // 备用方案：首字母大写的键名
        return fallbackKey.charAt(0).toUpperCase() + fallbackKey.slice(1);
    }

    /**
     * 获取供应商的API密钥环境变量名
     * @param {string} providerKey - 供应商键名
     * @returns {string} 环境变量名
     */
    getApiKeyEnvName(providerKey) {
        return `${providerKey.toUpperCase()}_API_KEY`;
    }

    /**
     * 验证解析结果
     * @param {Object} config - 供应商配置
     * @returns {boolean} 是否有效
     */
    validateConfig(config) {
        return config && 
               config.key && 
               config.name && 
               config.type;
    }

    /**
     * 为缺失的配置提供默认值
     * @param {Object} config - 供应商配置
     * @returns {Object} 补全后的配置
     */
    fillDefaults(config) {
        if (!config.endpoint) {
            // 根据类型提供默认端点
            switch (config.type) {
                case 'openai':
                    config.endpoint = `https://api.${config.key.toLowerCase()}.com`;
                    break;
                case 'anthropic':
                    config.endpoint = 'https://api.anthropic.com';
                    break;
                case 'google':
                    config.endpoint = 'https://generativelanguage.googleapis.com';
                    break;
                case 'ollama':
                    config.endpoint = 'http://localhost:11434';
                    break;
                default:
                    config.endpoint = `https://api.${config.key.toLowerCase()}.com`;
            }
        }
        
        if (!config.displayName) {
            config.displayName = config.key.charAt(0).toUpperCase() + config.key.slice(1);
        }
        
        return config;
    }
}
