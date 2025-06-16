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
            }
        });
    }

    async loadProviders() {
        try {
            this.providers = await this.configManager.getProviders();

            // 调试：检查加载的供应商数据
            console.log('🔍 ProviderConfig.loadProviders - 加载的供应商数据:', this.providers);
            console.log('🔍 供应商数量:', this.providers.length);

            this.renderProviders();
        } catch (error) {
            console.error('❌ 加载供应商失败:', error);
        }
    }

    renderProviders() {
        const container = document.getElementById('providers-list');

        if (this.providers.length === 0) {
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
                        <input type="text" id="provider-name" name="name" required
                               value="${provider?.name || ''}"
                               placeholder="例如：FoApi、自定义 OpenAI">
                    </div>

                    <div class="form-group">
                        <label for="provider-endpoint">API 端点</label>
                        <input type="url" id="provider-endpoint" name="endpoint" required
                               value="${provider?.endpoint || ''}"
                               placeholder="https://api.example.com">
                        <small class="form-help">API 的基础 URL（不包含 /v1 后缀）</small>
                        <div id="endpoint-validation" class="validation-message"></div>
                        <div id="provider-suggestions" class="provider-suggestions"></div>
                    </div>

                    <div class="form-group">
                        <label for="provider-api-key">API 密钥</label>
                        <input type="password" id="provider-api-key" name="apiKey"
                               value="${provider?.apiKey || ''}"
                               placeholder="输入您的 API 密钥">
                        <small class="form-help">您的 API 密钥将被安全存储</small>
                        <div id="apikey-validation" class="validation-message"></div>
                    </div>

                    <div class="form-group">
                        <label for="provider-type">服务商类型</label>
                        <select id="provider-type" name="type" required>
                            <option value="openai" ${provider?.type === 'openai' ? 'selected' : ''}>OpenAI 兼容</option>
                            <option value="anthropic" ${provider?.type === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                            <option value="google" ${provider?.type === 'google' ? 'selected' : ''}>Google</option>
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

        // Bind modal close events
        this.bindModalCloseEvents();

        // Bind real-time validation
        this.bindFormValidation();
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
            // 只进行基本的必填字段检查，不进行严格验证
            if (!providerData.name || !providerData.name.trim()) {
                this.showValidationErrors(['服务商名称不能为空']);
                return;
            }

            // Check for duplicate names (excluding current provider)
            const existingProviders = await this.configManager.getProviders();
            const duplicateName = existingProviders.find(p =>
                p.name.toLowerCase() === providerData.name.toLowerCase() &&
                p.id !== providerData.id
            );

            if (duplicateName) {
                this.showValidationErrors(['服务商名称已存在']);
                return;
            }

            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="btn-icon">⏳</span>保存中...';
            submitBtn.disabled = true;

            try {
                if (existingProvider) {
                    await this.configManager.updateProvider(providerData);
                } else {
                    await this.configManager.addProvider(providerData);
                }

                // 确保供应商状态为有效（已在providerData中设置）
                Logger.info(`✅ 供应商 ${providerData.name} 保存成功，状态: ${providerData.isValid ? '有效' : '无效'}`);

                // 如果有有效的TaskMaster项目路径，同步保存到TaskMaster项目
                if (this.configManager.isProjectValid()) {
                    try {
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

                        // 同步保存供应商配置和API密钥到TaskMaster项目
                        Logger.info(`💾 同步保存供应商配置到TaskMaster项目...`);
                        await this.syncProviderToTaskMaster(providerData);
                        Logger.info(`✅ 供应商配置已同步到TaskMaster项目`);

                    } catch (fileError) {
                        Logger.warn(`⚠️ 同步到TaskMaster项目失败: ${fileError.message}`);
                        // 不阻断保存流程，只记录警告
                    }
                }

                await this.loadProviders();
                this.hideModal();

                // Show success message
                const message = '服务商保存成功！';
                const type = 'success';

                if (window.app && window.app.updateStatus) {
                    window.app.updateStatus(message, type);
                }

                // Dispatch change event
                document.dispatchEvent(new CustomEvent('configChanged'));

            } finally {
                // Restore button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
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
        const confirmed = await UINotification.confirm(
            '确定要删除此服务商吗？此操作无法撤销。',
            {
                title: '删除服务商',
                confirmText: '删除',
                cancelText: '取消'
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            await this.configManager.deleteProvider(providerId);
            await this.loadProviders();

            // Dispatch change event
            document.dispatchEvent(new CustomEvent('configChanged'));

            Logger.info('Provider deleted successfully', { providerId });
            UINotification.success('服务商删除成功');
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'ProviderConfig',
                method: 'deleteProvider',
                action: 'delete_provider',
                providerId
            });
        }
    }







    /**
     * 同步单个供应商配置到TaskMaster项目
     */
    async syncProviderToTaskMaster(_providerData) {
        try {
            // 获取当前所有供应商（包括刚保存的这个）
            const allProviders = await this.configManager.getProviders();
            const allModels = await this.configManager.getModels();

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
                await saveConfig.writeFileToDirectory(
                    projectDirHandle,
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
                const modelData = {
                    id: this.generateModelId(),
                    name: modelInfo.name || modelInfo.id, // 使用原始模型名称
                    modelId: modelInfo.id, // 使用原始模型ID，不添加前缀
                    providerId: provider.id,
                    providerName: provider.name,
                    allowedRoles: ['main', 'fallback'], // 默认角色
                    maxTokens: modelInfo.maxTokens || 4096,
                    costPer1MTokens: {
                        input: modelInfo.cost || 0,
                        output: modelInfo.cost || 0
                    },
                    sweScore: (modelInfo.swe_score * 100) || 0, // 转换为百分比
                    isActive: true
                };

                // 检查是否已存在相同的模型（使用原始模型ID）
                const existingModels = await this.configManager.getModels();
                const exists = existingModels.find(m =>
                    m.modelId === modelData.modelId
                );

                if (!exists) {
                    await this.configManager.addModel(modelData);
                    addedCount++;
                }
            }

            // 重新加载providers数据以更新模型数量显示
            await this.loadProviders();

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
                    models.push({
                        id: model.id,
                        name: model.id,
                        swe_score: 0.3, // 默认值
                        maxTokens: 4096, // 默认值
                        cost: 0.001 // 默认值
                    });
                }
            }
        } else if (data.models && Array.isArray(data.models)) {
            // Google格式
            for (const model of data.models) {
                if (model.name) {
                    const modelId = model.name.split('/').pop(); // 提取模型ID
                    models.push({
                        id: modelId,
                        name: model.displayName || modelId,
                        swe_score: 0.3,
                        maxTokens: 4096,
                        cost: 0.001
                    });
                }
            }
        }

        return models;
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
    }

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    generateId() {
        return 'provider_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
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
     * Bind real-time form validation
     */
    bindFormValidation() {
        const endpointInput = document.getElementById('provider-endpoint');
        const apiKeyInput = document.getElementById('provider-api-key');
        const typeSelect = document.getElementById('provider-type');
        const nameInput = document.getElementById('provider-name');

        if (endpointInput) {
            endpointInput.addEventListener('input', () => this.validateEndpointField());
            endpointInput.addEventListener('blur', () => this.suggestProviderType());
        }

        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', () => this.validateApiKeyField());
        }

        if (nameInput) {
            nameInput.addEventListener('input', () => this.validateNameField());
        }

        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.validateApiKeyField());
        }
    }

    /**
     * Validate endpoint field in real-time
     */
    validateEndpointField() {
        const endpointInput = document.getElementById('provider-endpoint');
        const validationDiv = document.getElementById('endpoint-validation');

        if (!endpointInput || !validationDiv) return;

        const endpoint = endpointInput.value.trim();
        if (!endpoint) {
            validationDiv.innerHTML = '';
            return;
        }

        const validation = this.validator.validateEndpoint(endpoint);
        if (validation.isValid) {
            validationDiv.innerHTML = '<span class="validation-success">✅ 端点格式有效</span>';
        } else {
            validationDiv.innerHTML = `<span class="validation-error">❌ ${validation.errors.join(', ')}</span>`;
        }
    }

    /**
     * Validate API key field in real-time
     */
    validateApiKeyField() {
        const apiKeyInput = document.getElementById('provider-api-key');
        const typeSelect = document.getElementById('provider-type');
        const validationDiv = document.getElementById('apikey-validation');

        if (!apiKeyInput || !validationDiv || !typeSelect) return;

        const apiKey = apiKeyInput.value.trim();
        const providerType = typeSelect.value;

        if (!apiKey) {
            validationDiv.innerHTML = '';
            return;
        }

        const validation = this.validator.validateApiKey(apiKey, providerType);
        if (validation.isValid) {
            validationDiv.innerHTML = '<span class="validation-success">✅ API 密钥格式有效</span>';
        } else {
            validationDiv.innerHTML = `<span class="validation-error">❌ ${validation.errors.join(', ')}</span>`;
        }
    }

    /**
     * Validate name field in real-time
     */
    validateNameField() {
        const nameInput = document.getElementById('provider-name');

        if (!nameInput) return;

        const name = nameInput.value.trim();
        if (!name) return;

        // Basic name validation
        if (name.length < 2) {
            nameInput.setCustomValidity('服务商名称至少需要2个字符');
        } else if (name.length > 50) {
            nameInput.setCustomValidity('服务商名称不能超过50个字符');
        } else if (!/^[a-zA-Z0-9\s\-_.]+$/.test(name)) {
            nameInput.setCustomValidity('服务商名称包含无效字符');
        } else {
            nameInput.setCustomValidity('');
        }
    }

    /**
     * Suggest provider type based on endpoint (removed auto-apply functionality)
     */
    suggestProviderType() {
        const endpointInput = document.getElementById('provider-endpoint');
        const suggestionsDiv = document.getElementById('provider-suggestions');

        if (!endpointInput || !suggestionsDiv) return;

        const endpoint = endpointInput.value.trim();
        if (!endpoint) {
            suggestionsDiv.innerHTML = '';
            return;
        }

        try {
            const suggestions = this.validator.suggestProviderType(endpoint);
            if (suggestions.length > 0) {
                const topSuggestion = suggestions[0];
                suggestionsDiv.innerHTML = `
                    <div class="provider-suggestion">
                        <span class="suggestion-text">💡 检测到: ${topSuggestion.type} 服务商</span>
                    </div>
                `;
            } else {
                suggestionsDiv.innerHTML = '';
            }
        } catch (error) {
            suggestionsDiv.innerHTML = '';
        }
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
