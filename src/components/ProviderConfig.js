/**
 * ProviderConfig.js
 * Component for managing API provider configurations
 */

import { ProviderValidator } from '../utils/ProviderValidator.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { Logger } from '../utils/Logger.js';
import { UINotification } from './UINotification.js';
import { TaskMasterFileManager } from '../utils/TaskMasterFileManager.js';

export class ProviderConfig {
    constructor(configManager, saveConfig) {
        this.configManager = configManager;
        this.saveConfig = saveConfig;
        this.providers = [];
        this.validator = new ProviderValidator();
        this.fileManager = new TaskMasterFileManager(configManager, saveConfig);
    }

    initialize() {
        this.bindEvents();
    }

    bindEvents() {
        // Event delegation for provider actions
        document.getElementById('providers-list').addEventListener('click', (e) => {
            if (e.target.matches('.edit-provider-btn')) {
                const providerId = e.target.dataset.providerId;
                this.editProvider(providerId);
            } else if (e.target.matches('.delete-provider-btn')) {
                const providerId = e.target.dataset.providerId;
                this.deleteProvider(providerId);
            } else if (e.target.matches('.load-models-btn')) {
                const providerId = e.target.dataset.providerId;
                this.loadProviderModels(providerId);
            } else if (e.target.matches('.filter-models-btn')) {
                const providerId = e.target.dataset.providerId;
                this.filterProviderModels(providerId);
            }
        });
    }

    async loadProviders() {
        try {
            this.providers = await this.configManager.getProviders();
            this.renderProviders();
        } catch (error) {
            // 使用 ErrorHandler 处理错误，并显示用户友好的错误信息
            ErrorHandler.handle(error, {
                component: 'ProviderConfig',
                method: 'loadProviders',
                action: 'load_providers'
            });

            // 显示错误状态给用户
            if (window.app && window.app.updateStatus) {
                window.app.updateStatus('加载供应商失败，请检查配置', 'error');
            }
        }
    }

    renderProviders() {
        const container = document.getElementById('providers-list');

        if (this.providers.length === 0) {
            // 为空状态添加特殊CSS类以实现完美居中
            container.classList.add('empty-state-container');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔌</div>
                    <h3>未配置服务商</h3>
                    <p>添加您的第一个 API 服务商以开始使用</p>
                    <button class="btn btn-primary" onclick="document.getElementById('add-provider-btn').click()">
                        <span class="btn-icon">➕</span>
                        添加服务商
                    </button>
                </div>
            `;
            return;
        }

        // 移除空状态CSS类，恢复正常grid布局
        container.classList.remove('empty-state-container');
        container.innerHTML = this.providers.map(provider => this.renderProviderCard(provider)).join('');
    }

    renderProviderCard(provider) {
        const statusClass = provider.isValid === true ? 'status-valid' :
                           provider.isValid === false ? 'status-invalid' : 'status-unknown';
        const statusIcon = provider.isValid === true ? '✅' :
                          provider.isValid === false ? '❌' : '❓';
        const statusText = provider.isValid === true ? '已连接' :
                          provider.isValid === false ? '配置错误' : '未测试';

        return `
            <div class="card provider-card" data-provider-id="${provider.id}">
                <div class="provider-header">
                    <div class="provider-info">
                        <h3 class="provider-name">${provider.name}</h3>
                        <div class="provider-status ${statusClass}">
                            <span class="status-icon">${statusIcon}</span>
                            <span class="status-text">${statusText}</span>
                        </div>
                    </div>
                </div>
                <div class="provider-details">
                    <div class="detail-item">
                        <label>端点地址:</label>
                        <span class="detail-value">${provider.endpoint || '未配置'}</span>
                    </div>
                    <div class="detail-item">
                        <label>API 密钥:</label>
                        <span class="detail-value">${provider.apiKey ? '••••••••' : '未配置'}</span>
                    </div>
                    <div class="detail-item">
                        <label>模型数量:</label>
                        <span class="detail-value">${provider.models?.length || 0} 个已配置</span>
                    </div>
                </div>
                <div class="provider-actions">
                    <button class="btn btn-sm btn-success load-models-btn" data-provider-id="${provider.id}">
                        <span class="btn-icon">📥</span>
                        加载模型
                    </button>
                    <button class="btn btn-sm btn-primary edit-provider-btn" data-provider-id="${provider.id}">
                        <span class="btn-icon">✏️</span>
                        编辑
                    </button>
                    <button class="btn btn-sm btn-danger delete-provider-btn" data-provider-id="${provider.id}">
                        <span class="btn-icon">🗑️</span>
                        删除
                    </button>
                    <button class="btn btn-sm btn-filter filter-models-btn" data-provider-id="${provider.id}">
                        <span class="btn-icon">🔍</span>
                        筛选模型
                    </button>
                </div>
            </div>
        `;
    }

    showAddProviderModal() {
        this.showProviderModal();
    }

    editProvider(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (provider) {
            this.showProviderModal(provider);
        }
    }

    showProviderModal(provider = null) {
        const isEdit = !!provider;
        const modalTitle = isEdit ? '编辑服务商' : '添加新服务商';

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${modalTitle}</h2>
                    <button class="modal-close-btn" data-action="close-modal">×</button>
                </div>
                <form class="modal-body" id="provider-form">
                    <div class="form-group">
                        <label for="provider-name">服务商名称</label>
                        <input type="text" id="provider-name" name="name"
                               value="${provider?.name || ''}"
                               placeholder="例如：FoApi、自定义 OpenAI">
                    </div>

                    <div class="form-group">
                        <label for="provider-endpoint">API 端点</label>
                        <div class="input-with-button">
                            <input type="text" id="provider-endpoint" name="endpoint"
                                   value="${provider?.endpoint || ''}"
                                   placeholder="https://api.example.com">
                            <button type="button" id="test-endpoint-btn" class="btn btn-secondary btn-sm">
                                <span class="btn-icon">🔍</span>
                                测试连接
                            </button>
                        </div>
                        <small class="form-help">API 的基础 URL（不包含 /v1 后缀）</small>
                        <div id="endpoint-test-result" class="test-result"></div>
                    </div>

                    <div class="form-group">
                        <label for="provider-api-key">API 密钥</label>
                        <input type="password" id="provider-api-key" name="apiKey"
                               value="${provider?.apiKey || ''}"
                               placeholder="输入您的 API 密钥">
                        <small class="form-help">您的 API 密钥将被安全存储</small>
                    </div>

                    <div class="form-group">
                        <label for="provider-type">服务商类型</label>
                        <select id="provider-type" name="type" required>
                            <option value="openai" ${provider?.type === 'openai' ? 'selected' : ''}>OpenAI 兼容</option>
                            <option value="anthropic" ${provider?.type === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                            <option value="google" ${provider?.type === 'google' ? 'selected' : ''}>Google</option>
                            <option value="poloai" ${provider?.type === 'poloai' ? 'selected' : ''}>PoloAI</option>
                            <option value="foapi" ${provider?.type === 'foapi' ? 'selected' : ''}>FoApi</option>
                            <option value="custom" ${provider?.type === 'custom' ? 'selected' : ''}>自定义</option>
                        </select>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" data-action="close-modal">
                            取消
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <span class="btn-icon">${isEdit ? '💾' : '➕'}</span>
                            ${isEdit ? '更新' : '添加'}服务商
                        </button>
                    </div>
                </form>
            </div>
        `;

        this.showModal(modalHtml);

        // Bind form submission
        const form = document.getElementById('provider-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProviderSubmit(e.target, provider);
            });
        }

        // 不需要手动调用 bindModalCloseEvents，因为 showModal 中已经自动调用了

        // 绑定测试连接按钮事件
        this.bindTestEndpointButton();
    }

    async handleProviderSubmit(form, existingProvider) {
        const formData = new FormData(form);
        const providerData = {
            id: existingProvider?.id || this.generateId(),
            name: formData.get('name').trim(),
            endpoint: formData.get('endpoint').trim(),
            apiKey: formData.get('apiKey').trim(),
            type: formData.get('type'),
            isValid: true // 默认设置为有效，用户可以通过"加载模型"来验证
        };

        try {
            // 只在添加新供应商时检查重复名称，更新现有供应商时跳过此检查
            if (!existingProvider) {
                const existingProviders = this.configManager.getAllProviders();
                const duplicateName = existingProviders.find(p =>
                    p.name.toLowerCase() === providerData.name.toLowerCase()
                );

                if (duplicateName) {
                    this.showValidationErrors(['服务商名称已存在']);
                    return;
                }
            }

            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="btn-icon">⏳</span>保存中...';
            submitBtn.disabled = true;

            try {
                if (existingProvider) {
                    // 检查供应商是否在configManager中存在
                    const providerInManager = this.configManager.getProviderById(providerData.id);
                    if (providerInManager) {
                        // 供应商存在，执行更新
                        await this.configManager.updateProvider(providerData);
                    } else {
                        // 供应商不存在（可能是从TaskMaster项目加载的），需要特殊处理
                        Logger.info(`供应商 ${providerData.name} 在configManager中不存在，检查是否有同名供应商需要替换`);

                        // 检查是否有同名的供应商，如果有就替换，没有就添加
                        const existingByName = this.configManager.getAllProviders().find(p =>
                            p.name.toLowerCase() === providerData.name.toLowerCase()
                        );

                        if (existingByName) {
                            // 有同名供应商，使用其ID进行更新
                            Logger.info(`找到同名供应商，使用ID ${existingByName.id} 进行更新`);
                            providerData.id = existingByName.id;
                            await this.configManager.updateProvider(providerData);
                        } else {
                            // 没有同名供应商，直接添加
                            Logger.info(`没有同名供应商，直接添加`);
                            await this.configManager.addProvider(providerData);
                        }
                    }
                } else {
                    await this.configManager.addProvider(providerData);
                }

                // 确保供应商状态为有效（已在providerData中设置）
                Logger.info(`✅ 供应商 ${providerData.name} 保存成功，状态: ${providerData.isValid ? '有效' : '无效'}`);

                // 如果有有效的TaskMaster项目路径，同步保存到TaskMaster项目
                if (this.configManager.isProjectValid()) {
                    try {
                        Logger.info(`🚀 开始TaskMaster项目同步流程，供应商: ${providerData.name}`);
                        Logger.info(`📋 供应商数据:`, {
                            name: providerData.name,
                            endpoint: providerData.endpoint,
                            type: providerData.type,
                            hasApiKey: !!(providerData.apiKey && providerData.apiKey.trim()),
                            apiKeyLength: providerData.apiKey ? providerData.apiKey.length : 0
                        });

                        if (existingProvider) {
                            // 更新现有供应商：强制重新生成JS文件以更新配置
                            Logger.info(`🔧 更新供应商 ${providerData.name} 的JavaScript文件...`);
                            const result = await this.fileManager.updateProviderFile(
                                providerData.name,
                                providerData
                            );

                            if (result.updated) {
                                Logger.info(`✅ 成功更新供应商文件: ${result.filePath}`);
                            } else {
                                Logger.warn(`⚠️ 供应商文件更新失败`);
                            }
                        } else {
                            // 新建供应商：创建JS文件
                            Logger.info(`🔧 为供应商 ${providerData.name} 创建JavaScript文件...`);
                            const result = await this.fileManager.createProviderFileOnly(
                                providerData.name,
                                providerData
                            );

                            if (result.created) {
                                Logger.info(`✅ 成功创建供应商文件: ${result.filePath}`);
                            } else if (result.reason === 'file_exists') {
                                Logger.info(`ℹ️ 供应商文件已存在，跳过创建`);
                            }
                        }

                        // 同步保存单个供应商配置和API密钥到TaskMaster项目
                        Logger.info(`💾 开始同步保存供应商配置到TaskMaster项目...`);
                        Logger.info(`🔑 准备更新API密钥，长度: ${providerData.apiKey ? providerData.apiKey.length : 0}`);

                        const syncResult = await this.syncSingleProviderToTaskMaster(providerData);

                        if (syncResult) {
                            Logger.info(`✅ 供应商配置已成功同步到TaskMaster项目`);
                        } else {
                            Logger.error(`❌ 供应商配置同步失败`);
                        }

                        // 确保文件写入操作完全完成
                        await new Promise(resolve => setTimeout(resolve, 500));
                        Logger.info(`⏳ 文件写入操作已完成，等待500ms确保同步`);

                    } catch (fileError) {
                        Logger.error(`❌ TaskMaster项目同步失败:`, {
                            error: fileError.message,
                            stack: fileError.stack,
                            providerName: providerData.name
                        });
                        // 重新抛出错误，让用户知道失败了
                        throw new Error(`TaskMaster项目同步失败: ${fileError.message}`);
                    }
                }

                // 显示成功消息（在UI更新之前）
                const message = '服务商保存成功！';
                const type = 'success';

                if (window.app && window.app.updateStatus) {
                    window.app.updateStatus(message, type);
                }

                // 等待一小段时间确保用户看到成功消息
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 重新加载供应商列表
                Logger.info(`🔄 重新加载供应商列表...`);
                await this.loadProviders();
                Logger.info(`✅ 供应商列表重新加载完成`);

                // 关闭模态框
                this.hideModal();

                // 触发配置变更事件（最后执行）
                document.dispatchEvent(new CustomEvent('configChanged'));

                Logger.info(`🎉 供应商 ${providerData.name} 保存流程完全完成`);

            } finally {
                // 确保所有异步操作完成后再恢复按钮状态
                Logger.info(`🔄 恢复按钮状态...`);
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                Logger.info(`✅ 按钮状态已恢复`);
            }

        } catch (error) {
            const errorInfo = ErrorHandler.handle(error, {
                component: 'ProviderConfig',
                method: 'saveProvider',
                action: 'save_provider',
                providerId: existingProvider?.id || providerData.id
            });
            this.showValidationErrors([`保存服务商失败: ${errorInfo.userMessage}`]);
        }
    }

    async deleteProvider(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider) {
            UINotification.error('供应商未找到');
            return;
        }

        // 检查是否有TaskMaster项目路径
        const hasTaskMasterProject = this.configManager.isProjectValid();
        let confirmMessage = '确定要删除此服务商吗？此操作无法撤销。';

        if (hasTaskMasterProject) {
            // 检查配置引用
            try {
                const configUsage = await this.fileManager.checkProviderUsageInConfig(provider.name);
                if (configUsage.isUsed) {
                    confirmMessage += `\n\n⚠️ 警告：该供应商正在被以下配置使用：\n${configUsage.usedIn.join(', ')}\n\n删除后这些配置将失效，建议先更改配置。`;
                }

                confirmMessage += '\n\n将删除以下内容：';
                confirmMessage += '\n• UI配置中的供应商和模型';
                confirmMessage += '\n• TaskMaster项目中的供应商文件';
                confirmMessage += '\n• supported-models.json中的条目';
                confirmMessage += '\n• .cursor/mcp.json中的API密钥';
                confirmMessage += '\n• 相关导入和导出配置';
            } catch (error) {
                Logger.warn('检查配置引用失败', { error: error.message });
            }
        }

        const confirmed = await UINotification.confirm(confirmMessage, {
            title: '删除服务商',
            confirmText: '删除',
            cancelText: '取消'
        });

        if (!confirmed) {
            return;
        }

        try {
            Logger.info(`开始删除供应商: ${provider.name}`);

            // 1. 从UI配置中删除供应商
            await this.configManager.deleteProvider(providerId);
            Logger.info('✅ 已从UI配置中删除供应商');

            // 2. 如果有TaskMaster项目，删除相关文件
            if (hasTaskMasterProject) {
                Logger.info('🔧 开始清理TaskMaster项目文件...');

                try {
                    const deleteResult = await this.fileManager.deleteProviderFromTaskMaster(provider.name);

                    if (deleteResult.success) {
                        Logger.info('✅ TaskMaster项目文件清理完成');

                        // 显示详细的删除结果
                        let resultMessage = '供应商删除成功！\n\n';

                        if (deleteResult.deletedFiles.length > 0) {
                            resultMessage += '已删除文件：\n';
                            deleteResult.deletedFiles.forEach(file => {
                                resultMessage += `• ${file}\n`;
                            });
                        }

                        if (deleteResult.updatedFiles.length > 0) {
                            resultMessage += '\n已更新文件：\n';
                            deleteResult.updatedFiles.forEach(file => {
                                resultMessage += `• ${file}\n`;
                            });
                        }

                        if (deleteResult.warnings.length > 0) {
                            resultMessage += '\n⚠️ 警告：\n';
                            deleteResult.warnings.forEach(warning => {
                                resultMessage += `• ${warning}\n`;
                            });
                        }

                        UINotification.success(resultMessage, { duration: 8000 });
                    } else {
                        Logger.warn('TaskMaster项目文件清理部分失败');

                        let errorMessage = '供应商从UI配置中删除成功，但TaskMaster项目文件清理遇到问题：\n\n';
                        deleteResult.errors.forEach(error => {
                            errorMessage += `• ${error}\n`;
                        });

                        UINotification.warning(errorMessage, { duration: 10000 });
                    }
                } catch (taskMasterError) {
                    Logger.error('TaskMaster项目文件清理失败', { error: taskMasterError.message });
                    UINotification.warning(
                        `供应商从UI配置中删除成功，但TaskMaster项目文件清理失败：\n${taskMasterError.message}\n\n请手动检查并清理相关文件。`,
                        { duration: 10000 }
                    );
                }
            } else {
                UINotification.success('供应商删除成功');
            }

            // 3. 刷新UI
            await this.loadProviders();

            // Dispatch change event
            document.dispatchEvent(new CustomEvent('configChanged'));

            Logger.info('Provider deleted successfully', { providerId, providerName: provider.name });

        } catch (error) {
            Logger.error('删除供应商失败', { error: error.message, providerId });
            ErrorHandler.handle(error, {
                component: 'ProviderConfig',
                method: 'deleteProvider',
                action: 'delete_provider',
                providerId
            });
        }
    }

    /**
     * 同步单个供应商配置到TaskMaster项目（只更新当前供应商）
     */
    async syncSingleProviderToTaskMaster(providerData) {
        Logger.info(`🔄 syncSingleProviderToTaskMaster 开始执行`);
        Logger.info(`📋 接收到的供应商数据:`, {
            name: providerData.name,
            hasApiKey: !!(providerData.apiKey && providerData.apiKey.trim()),
            apiKeyPreview: providerData.apiKey ? `${providerData.apiKey.substring(0, 8)}...` : 'null'
        });

        try {
            // 使用已有的SaveConfig实例
            const saveConfig = this.saveConfig;
            if (!saveConfig) {
                Logger.error(`❌ SaveConfig实例不可用`);
                throw new Error('SaveConfig实例不可用');
            }
            Logger.info(`✅ SaveConfig实例可用`);

            // 获取项目目录句柄
            let projectDirHandle = saveConfig.directoryHandleCache.get('taskmaster-project');
            Logger.info(`🔍 检查项目目录句柄:`, {
                hasCachedHandle: !!projectDirHandle
            });

            if (!projectDirHandle) {
                Logger.info(`🔄 尝试从IndexedDB恢复项目目录句柄...`);
                // 尝试从IndexedDB恢复
                projectDirHandle = await saveConfig.directoryHandleManager.restoreWithPermission('taskmaster-project', 'readwrite');
                if (projectDirHandle) {
                    saveConfig.directoryHandleCache.set('taskmaster-project', projectDirHandle);
                    Logger.info(`✅ 成功从IndexedDB恢复项目目录句柄`);
                } else {
                    Logger.error(`❌ 无法从IndexedDB恢复项目目录句柄`);
                }
            }

            if (!projectDirHandle) {
                Logger.error(`❌ 无法获取TaskMaster项目目录访问权限`);
                throw new Error('无法获取TaskMaster项目目录访问权限');
            }

            Logger.info(`📁 项目目录句柄已准备就绪`);

            // 只更新单个供应商的API密钥到.cursor/mcp.json
            Logger.info(`🔧 开始更新单个供应商的MCP配置...`);
            await this.updateSingleProviderMCPConfig(projectDirHandle, providerData);
            Logger.info(`✅ 单个供应商MCP配置更新完成`);

            Logger.info(`🎉 syncSingleProviderToTaskMaster 执行成功`);
            return true;
        } catch (error) {
            Logger.error(`❌ syncSingleProviderToTaskMaster 执行失败:`, {
                error: error.message,
                stack: error.stack,
                providerName: providerData?.name
            });
            throw error;
        }
    }

    /**
     * 查找现有的TaskMaster服务器名称
     * @param {object} mcpConfig - MCP配置对象
     * @returns {string} - 找到的服务器名称或默认名称
     */
    findTaskMasterServer(mcpConfig) {
        const possibleNames = ['taskmaster-ai', 'task-master-ai'];

        if (mcpConfig.mcpServers) {
            for (const serverName of possibleNames) {
                if (mcpConfig.mcpServers[serverName]) {
                    return serverName;
                }
            }
        }

        // 如果都不存在，返回默认名称
        return 'taskmaster-ai';
    }

    /**
     * 更新单个供应商的MCP配置
     */
    async updateSingleProviderMCPConfig(projectDirHandle, providerData) {
        const mcpConfigPath = '.cursor/mcp.json';

        Logger.info(`🔧 updateSingleProviderMCPConfig 开始执行`);
        Logger.info(`📁 目标文件路径: ${mcpConfigPath}`);
        Logger.info(`📋 供应商信息:`, {
            name: providerData.name,
            hasApiKey: !!(providerData.apiKey && providerData.apiKey.trim()),
            apiKeyLength: providerData.apiKey ? providerData.apiKey.length : 0
        });

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
                        'taskmaster-ai': {
                            command: 'node',
                            args: ['dist/index.js'],
                            env: {}
                        }
                    }
                };
            }

            // 查找现有的TaskMaster服务器名称
            const serverName = this.findTaskMasterServer(mcpConfig);

            // 确保MCP配置结构存在
            if (!mcpConfig.mcpServers) {
                mcpConfig.mcpServers = {};
            }
            if (!mcpConfig.mcpServers[serverName]) {
                mcpConfig.mcpServers[serverName] = {
                    command: 'node',
                    args: ['dist/index.js'],
                    env: {}
                };
            }
            if (!mcpConfig.mcpServers[serverName].env) {
                mcpConfig.mcpServers[serverName].env = {};
            }

            const mcpEnv = mcpConfig.mcpServers[serverName].env;

            // 只更新当前供应商的API密钥
            if (providerData.apiKey && providerData.apiKey.trim() !== '') {
                const providerKey = providerData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const envVarName = `${providerKey.toUpperCase()}_API_KEY`;

                mcpEnv[envVarName] = providerData.apiKey;
                Logger.info(`🔑 更新单个供应商API密钥 ${envVarName}: ${providerData.apiKey.substring(0, 8)}...`);
            }

            // 保存更新后的MCP配置
            Logger.info(`📝 开始写入MCP配置文件: ${mcpConfigPath}`);
            await this.saveConfig.writeFileToDirectory(
                projectDirHandle,
                mcpConfigPath,
                JSON.stringify(mcpConfig, null, 2)
            );
            Logger.info(`💾 MCP配置文件写入完成`);

            // 验证写入是否成功
            try {
                const verifyContent = await this.saveConfig.readFileFromDirectory(projectDirHandle, mcpConfigPath);
                const verifyConfig = JSON.parse(verifyContent);
                const verifyServerName = this.findTaskMasterServer(verifyConfig);
                const verifyEnv = verifyConfig.mcpServers?.[verifyServerName]?.env;

                if (providerData.apiKey && providerData.apiKey.trim() !== '') {
                    const providerKey = providerData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const envVarName = `${providerKey.toUpperCase()}_API_KEY`;

                    if (verifyEnv && verifyEnv[envVarName] === providerData.apiKey) {
                        Logger.info(`✅ 验证成功：API密钥 ${envVarName} 已正确保存`);
                    } else {
                        Logger.warn(`⚠️ 验证失败：API密钥可能未正确保存`);
                    }
                }
            } catch (verifyError) {
                Logger.warn(`⚠️ 无法验证MCP配置文件写入结果: ${verifyError.message}`);
            }

            Logger.info('✅ 单个供应商MCP配置更新成功');
        } catch (error) {
            Logger.error('❌ 更新单个供应商MCP配置失败', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 同步所有供应商配置到TaskMaster项目（用于批量操作）
     */
    async syncProviderToTaskMaster(updatedProviderData) {
        try {
            // 获取当前所有供应商，但确保使用最新的供应商数据
            const allProviders = await this.configManager.getProviders();
            const allModels = await this.configManager.getModels();

            // 确保使用最新的供应商数据（替换数组中的对应项）
            if (updatedProviderData) {
                const index = allProviders.findIndex(p => p.id === updatedProviderData.id);
                if (index >= 0) {
                    allProviders[index] = updatedProviderData;
                } else {
                    allProviders.push(updatedProviderData);
                }
            }

            // 使用已有的SaveConfig实例
            const saveConfig = this.saveConfig;
            if (!saveConfig) {
                throw new Error('SaveConfig实例不可用');
            }

            // 转换为TaskMaster格式
            const taskMasterConfig = saveConfig.transformer.uiToTaskMaster(allProviders, allModels);

            // 获取项目目录句柄
            let projectDirHandle = saveConfig.directoryHandleCache.get('taskmaster-project');
            if (!projectDirHandle) {
                // 尝试从IndexedDB恢复
                projectDirHandle = await saveConfig.directoryHandleManager.restoreWithPermission('taskmaster-project', 'readwrite');
                if (projectDirHandle) {
                    saveConfig.directoryHandleCache.set('taskmaster-project', projectDirHandle);
                }
            }

            if (!projectDirHandle) {
                throw new Error('无法获取TaskMaster项目目录访问权限');
            }

            // 保存supported-models.json（如果有模型的话）
            if (taskMasterConfig.supportedModels && Object.keys(taskMasterConfig.supportedModels).length > 0) {
                // 获取TaskMaster包目录句柄
                const packageDirHandle = saveConfig.directoryHandleCache.get('taskmaster-package');
                if (!packageDirHandle) {
                    throw new Error('TaskMaster包目录不可用，请先选择TaskMaster包目录');
                }

                await saveConfig.writeFileToDirectory(
                    packageDirHandle,
                    'scripts/modules/supported-models.json',
                    JSON.stringify(taskMasterConfig.supportedModels, null, 2)
                );
            }

            // 保存API密钥到.cursor/mcp.json
            await saveConfig.saveMCPConfigFile(projectDirHandle, allProviders);

            return true;
        } catch (error) {
            Logger.error('同步供应商到TaskMaster项目失败', { error: error.message }, error);
            throw error;
        }
    }

    /**
     * 加载指定服务商的模型并导航到模型页面
     */
    async loadProviderModels(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider) return;

        try {
            // 显示加载状态
            const loadBtn = document.querySelector(`[data-provider-id="${providerId}"].load-models-btn`);
            if (loadBtn) {
                loadBtn.innerHTML = '<span class="btn-icon">⏳</span>加载中...';
                loadBtn.disabled = true;
            }

            // 获取支持的模型列表
            const supportedModels = await this.getSupportedModelsForProvider(provider);

            if (supportedModels.length === 0) {
                if (window.app && window.app.updateStatus) {
                    window.app.updateStatus(`❌ 未找到${provider.name}支持的模型`, 'error');
                }
                return;
            }

            // 为每个模型创建配置并添加到系统中
            let addedCount = 0;
            for (const modelInfo of supportedModels) {
                // 生成带前缀的模型ID，保持与TaskMaster格式一致
                const providerPrefix = provider.name.toLowerCase() + '-';
                const prefixedModelId = modelInfo.id.startsWith(providerPrefix)
                    ? modelInfo.id
                    : providerPrefix + modelInfo.id;

                const modelData = {
                    id: this.generateModelId(),
                    name: modelInfo.name || modelInfo.id, // 使用原始模型名称（不带前缀）
                    modelId: prefixedModelId, // 使用带前缀的模型ID，与TaskMaster格式一致
                    providerId: provider.id,
                    providerName: provider.name,
                    allowedRoles: ['main', 'fallback'], // 默认角色
                    maxTokens: modelInfo.maxTokens || 4096,
                    costPer1MTokens: {
                        input: modelInfo.inputCost || modelInfo.cost || 0.001,
                        output: modelInfo.outputCost || modelInfo.cost || 0.001
                    },
                    sweScore: (modelInfo.swe_score * 100) || 0, // 转换为百分比
                    isActive: true
                };

                // 检查是否已存在相同的模型（使用带前缀的模型ID）
                const existingModels = await this.configManager.getModels();
                const exists = existingModels.find(m =>
                    m.modelId === modelData.modelId
                );

                if (!exists) {
                    await this.configManager.addModel(modelData);
                    addedCount++;
                }
            }

            // 更新当前供应商的模型数量显示，而不是重新加载所有供应商
            await this.updateProviderModelCount(provider.id);

            // 导航到模型页面并过滤显示该服务商的模型
            this.navigateToModelsPage(provider);

            // 显示结果
            const message = addedCount > 0 ?
                `✅ 成功加载 ${addedCount} 个${provider.name}模型` :
                `ℹ️ ${provider.name}的所有模型都已存在`;

            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(message, addedCount > 0 ? 'success' : 'info');
            }

            // 触发配置变更事件
            document.dispatchEvent(new CustomEvent('configChanged'));

        } catch (error) {
            // Failed to load provider models
            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(`❌ 加载${provider.name}模型失败: ${error.message}`, 'error');
            }
        } finally {
            // 恢复按钮状态
            const loadBtn = document.querySelector(`[data-provider-id="${providerId}"].load-models-btn`);
            if (loadBtn) {
                loadBtn.innerHTML = '<span class="btn-icon">📥</span>加载模型';
                loadBtn.disabled = false;
            }
        }
    }

    /**
     * 更新指定供应商的模型数量显示
     * @param {string} providerId - 供应商ID
     */
    async updateProviderModelCount(providerId) {
        try {
            // 获取该供应商的模型数量
            const allModels = await this.configManager.getModels();
            const providerModels = allModels.filter(model => model.providerId === providerId);
            const modelCount = providerModels.length;

            // 更新UI中的模型数量显示
            const providerCard = document.querySelector(`[data-provider-id="${providerId}"]`);
            if (providerCard) {
                const modelCountElement = providerCard.querySelector('.model-count');
                if (modelCountElement) {
                    modelCountElement.textContent = `${modelCount} 个模型`;
                }

                // 更新模型按钮状态 - 始终显示两个按钮
                const loadBtn = providerCard.querySelector('.load-models-btn');
                const filterBtn = providerCard.querySelector('.filter-models-btn');

                if (modelCount > 0) {
                    // 有模型时，显示两个按钮
                    if (loadBtn) loadBtn.style.display = 'inline-block';
                    if (filterBtn) filterBtn.style.display = 'inline-block';
                } else {
                    // 没有模型时，只显示加载按钮
                    if (loadBtn) loadBtn.style.display = 'inline-block';
                    if (filterBtn) filterBtn.style.display = 'none';
                }
            }
        } catch (error) {
            Logger.error('更新供应商模型数量失败', { providerId, error: error.message }, error);
        }
    }

    /**
     * 筛选显示指定服务商的模型（不加载新模型）
     */
    filterProviderModels(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider) return;

        // 切换到模型标签页
        const modelsTab = document.querySelector('[data-tab="models"]');
        if (modelsTab) {
            modelsTab.click();
        }

        // 设置过滤器并重新渲染
        setTimeout(() => {
            if (window.app && window.app.modelConfig) {
                // 直接设置过滤器，不重新加载模型数据
                window.app.modelConfig.filterByProvider(provider.id);

                // 显示筛选状态
                if (window.app && window.app.updateStatus) {
                    window.app.updateStatus(`🔍 正在显示 ${provider.name} 的模型`, 'info');
                }
            }
        }, 100);
    }

    /**
     * 导航到模型页面并过滤显示该服务商的模型
     */
    navigateToModelsPage(provider) {
        // 切换到模型标签页
        const modelsTab = document.querySelector('[data-tab="models"]');
        if (modelsTab) {
            modelsTab.click();
        }

        // 设置过滤器并重新渲染
        setTimeout(() => {
            if (window.app && window.app.modelConfig) {
                // 重新加载模型数据
                window.app.modelConfig.loadModels().then(() => {
                    // 延迟一点确保模型数据已经渲染
                    setTimeout(() => {
                        // 设置过滤器显示该服务商的模型
                        window.app.modelConfig.filterByProvider(provider.id);
                    }, 50);
                }).catch(() => {
                    // 加载模型数据失败
                });
            }
        }, 200);
    }

    /**
     * 获取服务商支持的模型列表 - 仅从API获取
     */
    async getSupportedModelsForProvider(provider) {
        // 只从API动态获取模型列表
        const apiModels = await this.fetchModelsFromAPI(provider);
        return apiModels || [];
    }

    /**
     * 从API动态获取模型列表
     */
    async fetchModelsFromAPI(provider) {
        if (!provider.apiKey || !provider.endpoint) {
            throw new Error('缺少API密钥或端点配置');
        }

        const networkClient = this.validator.networkClient;
        let endpoint, headers;

        // 根据服务商类型构建请求
        switch (provider.type) {
            case 'openai':
            case 'foapi':
                endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/models';
                headers = {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json'
                };
                break;
            case 'anthropic':
                // Anthropic没有公开的模型列表API，使用静态列表
                throw new Error('Anthropic不支持动态模型获取');
            case 'google':
            case 'polo':
                endpoint = provider.endpoint.replace(/\/$/, '') + '/v1/models';
                headers = {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json'
                };
                break;
            default:
                throw new Error(`不支持的服务商类型: ${provider.type}`);
        }

        const response = await networkClient.get(endpoint, {
            headers,
            timeout: 15000,
            retries: 2
        });

        const data = await response.json();
        return this.parseAPIModelsResponse(data, provider);
    }

    /**
     * 解析API返回的模型数据
     */
    parseAPIModelsResponse(data, _provider) {
        const models = [];

        if (data.data && Array.isArray(data.data)) {
            // OpenAI格式
            for (const model of data.data) {
                if (model.id && typeof model.id === 'string') {
                    // 尝试从API响应中提取成本信息
                    const inputCost = this.extractCostFromModel(model, 'input');
                    const outputCost = this.extractCostFromModel(model, 'output');

                    models.push({
                        id: model.id,
                        name: model.id,
                        swe_score: model.swe_score || 0.3, // 使用API返回的值或默认值
                        maxTokens: model.max_tokens || model.maxTokens || 4096, // 使用API返回的值或默认值
                        cost: inputCost || 0.001, // 使用提取的输入成本或默认值0.001
                        inputCost: inputCost || 0.001,
                        outputCost: outputCost || 0.001
                    });
                }
            }
        } else if (data.models && Array.isArray(data.models)) {
            // Google格式
            for (const model of data.models) {
                if (model.name) {
                    const modelId = model.name.split('/').pop(); // 提取模型ID
                    const inputCost = this.extractCostFromModel(model, 'input');
                    const outputCost = this.extractCostFromModel(model, 'output');

                    models.push({
                        id: modelId,
                        name: model.displayName || modelId,
                        swe_score: model.swe_score || 0.3,
                        maxTokens: model.max_tokens || model.maxTokens || 4096,
                        cost: inputCost || 0.001,
                        inputCost: inputCost || 0.001,
                        outputCost: outputCost || 0.001
                    });
                }
            }
        }

        return models;
    }

    /**
     * 从模型数据中提取成本信息
     */
    extractCostFromModel(model, type) {
        // 尝试多种可能的成本字段名称
        const costFields = [
            `${type}_cost`,
            `${type}Cost`,
            `cost_per_1m_tokens_${type}`,
            `costPer1MTokens${type.charAt(0).toUpperCase() + type.slice(1)}`,
            'pricing',
            'cost',
            'price'
        ];

        for (const field of costFields) {
            if (model[field] !== undefined && model[field] !== null) {
                const cost = parseFloat(model[field]);
                if (!isNaN(cost) && cost >= 0) {
                    return cost;
                }
            }
        }

        // 检查嵌套的成本对象
        if (model.pricing) {
            if (model.pricing[type] !== undefined) {
                const cost = parseFloat(model.pricing[type]);
                if (!isNaN(cost) && cost >= 0) {
                    return cost;
                }
            }
        }

        if (model.cost_per_1m_tokens) {
            if (model.cost_per_1m_tokens[type] !== undefined) {
                const cost = parseFloat(model.cost_per_1m_tokens[type]);
                if (!isNaN(cost) && cost >= 0) {
                    return cost;
                }
            }
        }

        return null; // 没有找到有效的成本数据
    }

    /**
     * 生成模型ID
     */
    generateModelId() {
        return 'model_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    showModal(html) {
        const overlay = document.getElementById('modal-overlay');
        overlay.innerHTML = html;
        overlay.classList.remove('hidden');

        // 重新绑定模态框关闭事件，因为innerHTML替换了内容
        this.bindModalCloseEvents();
    }

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    generateId() {
        return 'provider_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * 测试方法：直接更新MCP配置文件
     */
    async testUpdateMCPConfig(providerName, apiKey) {
        try {
            console.log(`🧪 测试更新MCP配置: ${providerName} -> ${apiKey}`);

            const saveConfig = this.saveConfig;
            if (!saveConfig) {
                throw new Error('SaveConfig实例不可用');
            }

            let projectDirHandle = saveConfig.directoryHandleCache.get('taskmaster-project');
            if (!projectDirHandle) {
                projectDirHandle = await saveConfig.directoryHandleManager.restoreWithPermission('taskmaster-project', 'readwrite');
                if (projectDirHandle) {
                    saveConfig.directoryHandleCache.set('taskmaster-project', projectDirHandle);
                }
            }

            if (!projectDirHandle) {
                throw new Error('无法获取TaskMaster项目目录访问权限');
            }

            const mcpConfigPath = '.cursor/mcp.json';

            // 读取现有配置
            let mcpConfig = {};
            try {
                const mcpContent = await saveConfig.readFileFromDirectory(projectDirHandle, mcpConfigPath);
                if (mcpContent) {
                    mcpConfig = JSON.parse(mcpContent);
                    console.log('📖 读取到现有MCP配置:', mcpConfig);
                }
            } catch (error) {
                console.log('📝 创建新的MCP配置结构');
                mcpConfig = {
                    mcpServers: {
                        'taskmaster-ai': {
                            command: 'node',
                            args: ['dist/index.js'],
                            env: {}
                        }
                    }
                };
            }

            // 查找现有的TaskMaster服务器名称
            const serverName = this.findTaskMasterServer(mcpConfig);

            // 确保结构存在
            if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
            if (!mcpConfig.mcpServers[serverName]) {
                mcpConfig.mcpServers[serverName] = {
                    command: 'node',
                    args: ['dist/index.js'],
                    env: {}
                };
            }
            if (!mcpConfig.mcpServers[serverName].env) {
                mcpConfig.mcpServers[serverName].env = {};
            }

            const mcpEnv = mcpConfig.mcpServers[serverName].env;
            const envVarName = `${providerName.toUpperCase()}_API_KEY`;

            console.log(`🔑 设置 ${envVarName} = ${apiKey}`);
            mcpEnv[envVarName] = apiKey;

            console.log('💾 准备写入配置:', JSON.stringify(mcpConfig, null, 2));

            // 写入文件
            await saveConfig.writeFileToDirectory(
                projectDirHandle,
                mcpConfigPath,
                JSON.stringify(mcpConfig, null, 2)
            );

            console.log('✅ 测试更新完成');
            return true;
        } catch (error) {
            console.error('❌ 测试更新失败:', error);
            throw error;
        }
    }

    /**
     * Bind modal close events
     */
    bindModalCloseEvents() {
        // 使用事件委托处理模态框关闭
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            // 移除之前的监听器（如果存在）
            modalOverlay.removeEventListener('click', this.handleModalClose);

            // 添加新的监听器
            this.handleModalClose = (e) => {
                if (e.target.dataset.action === 'close-modal' ||
                    e.target.classList.contains('modal-overlay')) {
                    this.hideModal();
                }
            };

            modalOverlay.addEventListener('click', this.handleModalClose);
        }
    }

    /**
     * 已移除实时表单验证功能
     */
    bindFormValidation() {
        // 不再进行任何格式验证
    }

    /**
     * 绑定测试端点按钮事件
     */
    bindTestEndpointButton() {
        const testBtn = document.getElementById('test-endpoint-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testEndpointConnection());
        }
    }

    /**
     * 测试端点连接
     */
    async testEndpointConnection() {
        const testBtn = document.getElementById('test-endpoint-btn');
        const resultDiv = document.getElementById('endpoint-test-result');
        const nameInput = document.getElementById('provider-name');
        const endpointInput = document.getElementById('provider-endpoint');
        const apiKeyInput = document.getElementById('provider-api-key');
        const typeSelect = document.getElementById('provider-type');

        if (!testBtn || !resultDiv || !endpointInput) return;

        // 获取表单数据
        const testProvider = {
            name: nameInput?.value?.trim() || '测试服务商',
            endpoint: endpointInput.value.trim(),
            apiKey: apiKeyInput?.value?.trim() || '',
            type: typeSelect?.value || 'openai'
        };

        // 基本验证
        if (!testProvider.endpoint) {
            this.showTestResult(resultDiv, false, '请输入API端点');
            return;
        }

        // 显示测试中状态
        testBtn.innerHTML = '<span class="btn-icon">⏳</span>测试中...';
        testBtn.disabled = true;
        resultDiv.innerHTML = '<div class="test-loading">🔍 正在测试连接...</div>';

        try {
            // 使用验证器测试连接
            const result = await this.validator.testProviderConnection(testProvider);

            if (result.isValid) {
                this.showTestResult(resultDiv, true, result.message, result.details);
            } else {
                this.showTestResult(resultDiv, false, result.errors?.join(', ') || '连接测试失败', result.details);
            }

        } catch (error) {
            this.showTestResult(resultDiv, false, `测试失败: ${error.message}`);
        } finally {
            // 恢复按钮状态
            testBtn.innerHTML = '<span class="btn-icon">🔍</span>测试连接';
            testBtn.disabled = false;
        }
    }

    /**
     * 显示测试结果
     */
    showTestResult(resultDiv, isSuccess, message, details = null) {
        const statusIcon = isSuccess ? '✅' : '❌';
        const statusClass = isSuccess ? 'test-success' : 'test-error';

        let html = `
            <div class="test-result-content ${statusClass}">
                <div class="test-message">
                    <span class="test-icon">${statusIcon}</span>
                    <span class="test-text">${message}</span>
                </div>
        `;

        // 添加详细信息
        if (details) {
            html += '<div class="test-details">';

            if (details.status) {
                html += `<div class="detail-item">状态码: ${details.status}</div>`;
            }

            if (details.duration) {
                html += `<div class="detail-item">响应时间: ${details.duration}ms</div>`;
            }

            if (details.modelsCount !== undefined) {
                html += `<div class="detail-item">可用模型: ${details.modelsCount} 个</div>`;
            }

            if (details.endpoint) {
                html += `<div class="detail-item">测试端点: ${details.endpoint}</div>`;
            }

            if (details.note) {
                html += `<div class="detail-item">说明: ${details.note}</div>`;
            }

            html += '</div>';
        }

        html += '</div>';
        resultDiv.innerHTML = html;

        // 自动隐藏结果（成功时5秒，失败时10秒）
        setTimeout(() => {
            if (resultDiv.innerHTML === html) {
                resultDiv.innerHTML = '';
            }
        }, isSuccess ? 5000 : 10000);
    }

    /**
     * Show validation errors in the modal
     */
    showValidationErrors(errors) {
        // Remove existing error display
        const existingError = document.querySelector('.validation-errors');
        if (existingError) {
            existingError.remove();
        }

        // Create error display
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-errors';
        errorDiv.innerHTML = `
            <div class="alert alert-error">
                <strong>验证错误:</strong>
                <ul>
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;

        // Insert before form actions
        const modalActions = document.querySelector('.modal-actions');
        if (modalActions) {
            modalActions.parentNode.insertBefore(errorDiv, modalActions);
        }
    }
}
