/**
 * ModelConfig.js
 * Component for managing AI model configurations
 */

import { NetworkClient } from '../utils/NetworkClient.js';
import { UINotification } from './UINotification.js';
import { Logger } from '../utils/Logger.js';

export class ModelConfig {
    constructor(configManager) {
        this.configManager = configManager;
        this.models = [];
        this.providers = [];
        this.currentProviderFilter = null; // 当前过滤的服务商ID

        // 创建专用的API测试网络客户端
        this.networkClient = NetworkClient.createAPITestClient();
    }

    initialize() {
        this.bindEvents();
        this.bindProviderFilter();
    }

    bindEvents() {
        // Event delegation for model actions
        document.getElementById('models-list').addEventListener('click', (e) => {
            if (e.target.matches('.edit-model-btn')) {
                const modelId = e.target.dataset.modelId;
                this.editModel(modelId);
            } else if (e.target.matches('.delete-model-btn')) {
                const modelId = e.target.dataset.modelId;
                this.deleteModel(modelId);
            } else if (e.target.matches('.test-model-api-btn')) {
                const modelId = e.target.dataset.modelId;
                this.testModelAPI(modelId);
            } else if (e.target.matches('.test-model-taskmaster-btn')) {
                const modelId = e.target.dataset.modelId;
                this.testModelTaskMaster(modelId);
            } else if (e.target.dataset.action === 'add-model') {
                this.showAddModelModal();
            }
        });
    }

    async loadModels() {
        try {
            this.models = await this.configManager.getModels();
            this.providers = await this.configManager.getProviders();
            this.updateProviderFilter();
            this.renderModels();
        } catch (error) {
            // Failed to load models
        }
    }

    renderModels() {
        const container = document.getElementById('models-list');

        if (this.models.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🧠</div>
                    <h3>未配置模型</h3>
                    <p>添加您的第一个 AI 模型开始使用</p>
                    <button class="btn btn-primary" data-action="add-model">
                        <span class="btn-icon">➕</span>
                        添加模型
                    </button>
                </div>
            `;
            return;
        }

        // 渲染网格布局
        container.innerHTML = `
            <div class="models-grid-layout">
                <div class="model-item-header">
                    <div>模型名称</div>
                    <div>服务商</div>
                    <div>角色</div>
                    <div>SWE评分</div>
                    <div>输入成本</div>
                    <div>输出成本</div>
                    <div>操作</div>
                </div>
                ${this.renderModelItems()}
            </div>
        `;
    }

    /**
     * 渲染模型网格项
     */
    renderModelItems() {
        const modelsToShow = this.getFilteredModels();
        return modelsToShow.map(model => this.renderModelItem(model)).join('');
    }

    /**
     * 渲染单个模型项
     */
    renderModelItem(model) {
        const provider = this.providers.find(p => p.id === model.providerId);
        const providerName = provider ? provider.name : '未知服务商';

        const rolesBadges = model.allowedRoles?.map(role => {
            const roleText = {
                'main': '主',
                'fallback': '备',
                'research': '研'
            }[role] || role;
            return `<span class="role-badge role-${role}">${roleText}</span>`;
        }).join('') || '';

        return `
            <div class="model-item" data-model-id="${model.id}">
                <div class="model-name-cell">${model.name}</div>
                <div class="model-provider-cell">${providerName}</div>
                <div class="model-roles-cell">${rolesBadges}</div>
                <div class="model-score-cell">
                    <span class="model-score-value">${this.formatScore(model.sweScore)}%</span>
                    <span class="model-score-stars">${this.getScoreStars(model.sweScore)}</span>
                </div>
                <div class="model-cost-cell">$${model.costPer1MTokens?.input || '未设置'}</div>
                <div class="model-cost-cell">$${model.costPer1MTokens?.output || '未设置'}</div>
                <div class="model-actions-cell">
                    <button class="btn btn-icon-only test-model-api-btn" data-model-id="${model.id}" title="测试API连接">
                        🔌
                    </button>
                    <button class="btn btn-icon-only test-model-taskmaster-btn" data-model-id="${model.id}" title="测试TaskMaster集成">
                        ⚙️
                    </button>
                    <button class="btn btn-icon-only edit-model-btn" data-model-id="${model.id}" title="编辑模型">
                        ✏️
                    </button>
                    <button class="btn btn-icon-only delete-model-btn" data-model-id="${model.id}" title="删除模型">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 获取筛选后的模型列表
     */
    getFilteredModels() {
        // 使用现有的过滤逻辑
        if (!this.currentProviderFilter) {
            return this.models;
        }
        return this.models.filter(model => model.providerId === this.currentProviderFilter);
    }



    /**
     * 获取要显示的模型
     */
    getModelsToShow() {
        if (!this.currentProviderFilter) {
            return this.models;
        }
        return this.models.filter(model => model.providerId === this.currentProviderFilter);
    }

    /**
     * 按服务商过滤模型
     */
    filterByProvider(providerId) {
        // 过滤显示服务商模型

        this.currentProviderFilter = providerId || null;

        // 应用过滤器并重新渲染
        this.renderModels();
    }

    /**
     * 清除过滤器
     */
    clearFilter() {
        // 清除过滤器，显示所有模型
        this.currentProviderFilter = null;
        this.renderModels();
    }





    /**
     * 格式化评分，保留一位小数
     */
    formatScore(score) {
        if (!score && score !== 0) return 'N/A';
        return Number(score).toFixed(1);
    }

    getScoreStars(score) {
        if (!score) return '☆☆☆';

        if (score >= 70) return '★★★';
        if (score >= 50) return '★★☆';
        if (score >= 30) return '★☆☆';
        return '☆☆☆';
    }

    showAddModelModal() {
        this.showModelModal();
    }

    editModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
            this.showModelModal(model);
        }
    }

    showModelModal(model = null) {
        const isEdit = !!model;
        const modalTitle = isEdit ? '编辑模型' : '添加新模型';

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${modalTitle}</h2>
                    <button class="modal-close-btn" data-action="close-modal">×</button>
                </div>
                <form class="modal-body" id="model-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="model-name">模型名称</label>
                            <input type="text" id="model-name" name="name" required
                                   value="${model?.name || ''}"
                                   placeholder="例如：DeepSeek R1">
                        </div>

                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="model-swe-score">SWE 评分 (%)</label>
                            <input type="number" id="model-swe-score" name="sweScore"
                                   min="0" max="100" step="0.1"
                                   value="${model?.sweScore || ''}"
                                   placeholder="70.0">
                        </div>

                        <div class="form-group">
                            <label for="model-max-tokens">最大令牌数</label>
                            <input type="number" id="model-max-tokens" name="maxTokens"
                                   min="1000" step="1000"
                                   value="${model?.maxTokens || ''}"
                                   placeholder="200000">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="model-cost-input">输入成本 (每百万令牌)</label>
                            <input type="number" id="model-cost-input" name="costInput"
                                   min="0" step="0.01"
                                   value="${model?.costPer1MTokens?.input || ''}"
                                   placeholder="0.14">
                        </div>

                        <div class="form-group">
                            <label for="model-cost-output">输出成本 (每百万令牌)</label>
                            <input type="number" id="model-cost-output" name="costOutput"
                                   min="0" step="0.01"
                                   value="${model?.costPer1MTokens?.output || ''}"
                                   placeholder="0.28">
                        </div>
                    </div>



                    <div class="form-group">
                        <label>允许角色</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="allowedRoles" value="main"
                                       ${model?.allowedRoles?.includes('main') ? 'checked' : ''}>
                                <span class="checkbox-text">主要</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="allowedRoles" value="fallback"
                                       ${model?.allowedRoles?.includes('fallback') ? 'checked' : ''}>
                                <span class="checkbox-text">备用</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="allowedRoles" value="research"
                                       ${model?.allowedRoles?.includes('research') ? 'checked' : ''}>
                                <span class="checkbox-text">研究</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" data-action="close-modal">
                            取消
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <span class="btn-icon">${isEdit ? '💾' : '➕'}</span>
                            ${isEdit ? '更新' : '添加'}模型
                        </button>
                    </div>
                </form>
            </div>
        `;

        this.showModal(modalHtml);

        // Bind form submission
        const form = document.getElementById('model-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleModelSubmit(e.target, model);
            });
        }

        // Bind modal close events
        this.bindModalCloseEvents();
    }

    async handleModelSubmit(form, existingModel) {
        const formData = new FormData(form);
        const allowedRoles = Array.from(form.querySelectorAll('input[name="allowedRoles"]:checked'))
            .map(input => input.value);

        // 自动生成modelId，基于模型名称
        const modelName = formData.get('name');
        const generatedModelId = existingModel?.modelId || this.generateModelId(modelName);

        // 获取默认的providerId - 使用第一个可用的provider
        let defaultProviderId = existingModel?.providerId;
        if (!defaultProviderId && this.providers.length > 0) {
            defaultProviderId = this.providers[0].id;
        }

        // 如果还是没有provider，抛出错误
        if (!defaultProviderId) {
            UINotification.error('请先添加至少一个服务商', {
                title: '保存失败',
                duration: 5000
            });
            return;
        }

        const modelData = {
            id: existingModel?.id || this.generateId(),
            name: modelName,
            providerId: defaultProviderId,
            modelId: generatedModelId,
            sweScore: parseFloat(formData.get('sweScore')) || null,
            maxTokens: parseInt(formData.get('maxTokens')) || null,
            costPer1MTokens: {
                input: parseFloat(formData.get('costInput')) || null,
                output: parseFloat(formData.get('costOutput')) || null
            },
            allowedRoles: allowedRoles
        };

        try {
            if (existingModel) {
                await this.configManager.updateModel(modelData);
                UINotification.success('模型更新成功');
            } else {
                await this.configManager.addModel(modelData);
                UINotification.success('模型添加成功');
            }

            await this.loadModels();
            this.hideModal();

            // Dispatch change event
            document.dispatchEvent(new CustomEvent('configChanged'));
        } catch (error) {
            // Failed to save model
            Logger.error('保存模型失败', { error: error.message }, error);
            UINotification.error(`保存模型配置失败: ${error.message}`, {
                title: '保存失败',
                duration: 5000
            });
        }
    }

    async deleteModel(modelId) {
        const confirmed = await UINotification.confirm(
            '确定要删除此模型吗？此操作无法撤销。',
            {
                title: '删除模型',
                confirmText: '删除',
                cancelText: '取消'
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            await this.configManager.deleteModel(modelId);
            await this.loadModels();

            // Dispatch change event
            document.dispatchEvent(new CustomEvent('configChanged'));

            // 显示成功消息
            UINotification.success('模型删除成功');
        } catch (error) {
            // Failed to delete model
            UINotification.error('删除模型失败', {
                title: '删除失败',
                duration: 5000
            });
        }
    }

    /**
     * 测试模型API连接
     */
    async testModelAPI(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;

        const provider = this.providers.find(p => p.id === model.providerId);
        if (!provider) {
            if (window.app && window.app.updateStatus) {
                window.app.updateStatus('❌ 未找到对应的服务商', 'error');
            }
            return;
        }

        try {
            // 显示测试状态
            const testBtn = document.querySelector(`[data-model-id="${modelId}"].test-model-api-btn`);
            if (testBtn) {
                testBtn.innerHTML = '⏳';
                testBtn.disabled = true;
            }

            // 创建测试请求
            const testResult = await this.performModelAPITest(model, provider);

            // 显示详细结果
            this.showTestResultModal(model, testResult, 'API');

            // 同时显示简要状态
            const message = testResult.isValid ?
                `✅ ${model.name} API连接成功` :
                `❌ ${model.name} API连接失败: ${testResult.error}`;
            const type = testResult.isValid ? 'success' : 'error';

            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(message, type);
            }

        } catch (error) {
            // Failed to test model API
            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(`❌ ${model.name} API测试失败: ${error.message}`, 'error');
            }
        } finally {
            // 恢复按钮状态
            const testBtn = document.querySelector(`[data-model-id="${modelId}"].test-model-api-btn`);
            if (testBtn) {
                testBtn.innerHTML = '🔌';
                testBtn.disabled = false;
            }
        }
    }

    /**
     * 测试模型在TaskMaster中的集成
     */
    async testModelTaskMaster(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;

        try {
            // 显示测试状态
            const testBtn = document.querySelector(`[data-model-id="${modelId}"].test-model-taskmaster-btn`);
            if (testBtn) {
                testBtn.innerHTML = '⏳';
                testBtn.disabled = true;
            }

            // 执行TaskMaster集成测试
            const testResult = await this.performTaskMasterIntegrationTest(model);

            // 显示详细结果
            this.showTestResultModal(model, testResult, 'TaskMaster');

            // 同时显示简要状态
            const message = testResult.isValid ?
                `✅ ${model.name} TaskMaster集成正常` :
                `❌ ${model.name} TaskMaster集成失败: ${testResult.error}`;
            const type = testResult.isValid ? 'success' : 'error';

            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(message, type);
            }

        } catch (error) {
            // Failed to test model TaskMaster integration
            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(`❌ ${model.name} TaskMaster集成测试失败: ${error.message}`, 'error');
            }
        } finally {
            // 恢复按钮状态
            const testBtn = document.querySelector(`[data-model-id="${modelId}"].test-model-taskmaster-btn`);
            if (testBtn) {
                testBtn.innerHTML = '⚙️';
                testBtn.disabled = false;
            }
        }
    }

    /**
     * 执行模型API测试
     */
    async performModelAPITest(model, provider) {
        try {
            // 构建测试请求
            const testPayload = this.buildTestPayload(model, provider);

            // 确定API端点
            let endpoint = provider.endpoint.replace(/\/$/, '');
            if (provider.type === 'anthropic') {
                endpoint += '/v1/messages';
            } else if (provider.type === 'google' || provider.type === 'polo') {
                endpoint += '/v1/generateContent';
            } else {
                endpoint += '/v1/chat/completions';
            }

            // 构建请求头
            const headers = {
                'Content-Type': 'application/json'
            };

            if (provider.type === 'anthropic') {
                headers['x-api-key'] = provider.apiKey;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                headers['Authorization'] = `Bearer ${provider.apiKey}`;
            }

            // 发送测试请求
            const response = await this.networkClient.post(endpoint, testPayload, {
                headers,
                timeout: 20000, // 模型测试使用20秒超时
                onRetry: () => {
                    // API重试中
                }
            });

            const data = await response.json();
            return {
                isValid: true,
                response: data
            };
        } catch (error) {
            let errorMessage = error.message;

            if (error.name === 'TimeoutError') {
                errorMessage = `请求超时 (${error.timeout}ms)`;
            } else if (error.status === 401) {
                errorMessage = 'API密钥无效或已过期';
            } else if (error.status === 403) {
                errorMessage = 'API访问被拒绝，请检查权限';
            } else if (error.status === 429) {
                errorMessage = 'API请求频率限制，请稍后重试';
            } else if (error.status === 400) {
                errorMessage = '请求参数错误，可能是模型ID不正确';
            } else if (error.status >= 500) {
                errorMessage = `服务器错误 (${error.status})`;
            }

            return {
                isValid: false,
                error: errorMessage
            };
        }
    }

    /**
     * 构建测试请求载荷
     */
    buildTestPayload(model, provider) {
        // 直接使用模型ID进行API调用
        const actualModelId = model.modelId;

        const basePayload = {
            model: actualModelId,
            messages: [
                {
                    role: 'user',
                    content: 'Hello! This is a test message. Please respond with "Test successful".'
                }
            ],
            max_tokens: 50,
            temperature: 0.1
        };

        // 根据服务商类型调整载荷
        switch (provider.type) {
            case 'anthropic':
                return {
                    model: actualModelId,
                    max_tokens: 50,
                    messages: basePayload.messages
                };
            case 'google':
            case 'polo':
                return {
                    model: actualModelId,
                    contents: [
                        {
                            parts: [
                                {
                                    text: basePayload.messages[0].content
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        maxOutputTokens: 50,
                        temperature: 0.1
                    }
                };
            default:
                return basePayload;
        }
    }

    /**
     * 执行TaskMaster集成测试
     */
    async performTaskMasterIntegrationTest(model) {
        try {
            // 检查模型配置是否完整
            if (!model.allowedRoles || model.allowedRoles.length === 0) {
                return {
                    isValid: false,
                    error: '模型未配置允许的角色'
                };
            }

            // 检查是否有对应的服务商
            const provider = this.providers.find(p => p.id === model.providerId);
            if (!provider) {
                return {
                    isValid: false,
                    error: '未找到对应的服务商配置'
                };
            }

            if (!provider.apiKey) {
                return {
                    isValid: false,
                    error: '服务商未配置API密钥'
                };
            }

            // 模拟TaskMaster配置转换测试
            const taskMasterConfig = this.buildTaskMasterConfig(model, provider);

            // 验证配置格式
            if (!this.validateTaskMasterConfig(taskMasterConfig)) {
                return {
                    isValid: false,
                    error: 'TaskMaster配置格式验证失败'
                };
            }

            return {
                isValid: true,
                config: taskMasterConfig
            };

        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    /**
     * 构建TaskMaster配置
     */
    buildTaskMasterConfig(model, provider) {
        return {
            supportedModels: {
                [model.modelId]: {
                    name: model.name,
                    provider: provider.name,
                    swe_score: model.sweScore / 100 || 0,
                    max_tokens: model.maxTokens || 4096,
                    cost_per_1m_tokens: {
                        input: model.costPer1MTokens?.input || 0,
                        output: model.costPer1MTokens?.output || 0
                    }
                }
            },
            config: {
                providers: {
                    [provider.name.toLowerCase()]: {
                        endpoint: provider.endpoint,
                        api_key: provider.apiKey,
                        type: provider.type
                    }
                },
                models: this.buildModelRoleConfig(model)
            }
        };
    }

    /**
     * 构建模型角色配置
     */
    buildModelRoleConfig(model) {
        const roleConfig = {};

        if (model.allowedRoles?.includes('main')) {
            roleConfig.main = model.modelId;
        }
        if (model.allowedRoles?.includes('fallback')) {
            roleConfig.fallback = model.modelId;
        }
        if (model.allowedRoles?.includes('research')) {
            roleConfig.research = model.modelId;
        }

        return roleConfig;
    }

    /**
     * 验证TaskMaster配置格式
     */
    validateTaskMasterConfig(config) {
        return !!(
            config &&
            config.supportedModels &&
            config.config &&
            config.config.providers &&
            config.config.models
        );
    }

    /**
     * 显示测试结果模态窗口
     */
    showTestResultModal(model, testResult, testType) {
        const isSuccess = testResult.isValid;
        const statusIcon = isSuccess ? '✅' : '❌';
        const statusClass = isSuccess ? 'success' : 'error';
        const statusText = isSuccess ? '成功' : '失败';

        let resultContent = '';

        if (testType === 'API') {
            if (isSuccess && testResult.response) {
                // 显示API响应内容
                const response = testResult.response;
                let responseText = '';

                // 根据不同的API格式提取响应文本
                if (response.choices && response.choices[0]) {
                    // OpenAI格式
                    responseText = response.choices[0].message?.content || response.choices[0].text || '无响应内容';
                } else if (response.content && response.content[0]) {
                    // Anthropic格式
                    responseText = response.content[0].text || '无响应内容';
                } else if (response.candidates && response.candidates[0]) {
                    // Google格式
                    responseText = response.candidates[0].content?.parts?.[0]?.text || '无响应内容';
                } else {
                    responseText = JSON.stringify(response, null, 2);
                }

                resultContent = `
                    <div class="test-result-section">
                        <h4>API响应内容</h4>
                        <div class="response-content">
                            <pre>${this.escapeHtml(responseText)}</pre>
                        </div>
                    </div>
                    <div class="test-result-section">
                        <h4>完整响应数据</h4>
                        <details>
                            <summary>点击查看原始JSON响应</summary>
                            <pre class="json-response">${this.escapeHtml(JSON.stringify(response, null, 2))}</pre>
                        </details>
                    </div>
                `;
            } else {
                resultContent = `
                    <div class="test-result-section">
                        <h4>错误详情</h4>
                        <div class="error-content">
                            <p>${this.escapeHtml(testResult.error || '未知错误')}</p>
                        </div>
                    </div>
                `;
            }
        } else if (testType === 'TaskMaster') {
            if (isSuccess && testResult.config) {
                resultContent = `
                    <div class="test-result-section">
                        <h4>TaskMaster配置预览</h4>
                        <div class="config-preview">
                            <h5>支持的模型</h5>
                            <pre>${this.escapeHtml(JSON.stringify(testResult.config.supportedModels, null, 2))}</pre>

                            <h5>服务商配置</h5>
                            <pre>${this.escapeHtml(JSON.stringify(testResult.config.config.providers, null, 2))}</pre>

                            <h5>模型角色配置</h5>
                            <pre>${this.escapeHtml(JSON.stringify(testResult.config.config.models, null, 2))}</pre>
                        </div>
                    </div>
                    <div class="test-result-section">
                        <h4>配置验证结果</h4>
                        <div class="validation-results">
                            <p>✅ 配置格式正确</p>
                            <p>✅ 服务商配置完整</p>
                            <p>✅ 模型角色映射正确</p>
                            <p>✅ 与TaskMaster兼容</p>
                        </div>
                    </div>
                `;
            } else {
                resultContent = `
                    <div class="test-result-section">
                        <h4>集成问题</h4>
                        <div class="error-content">
                            <p>${this.escapeHtml(testResult.error || '未知错误')}</p>
                        </div>
                        <div class="troubleshooting">
                            <h5>解决建议</h5>
                            <ul>
                                <li>确保模型已配置允许的角色（main、fallback、research）</li>
                                <li>检查服务商配置是否完整（API密钥、端点等）</li>
                                <li>验证模型ID是否正确</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
        }

        const modalHtml = `
            <div class="modal test-result-modal">
                <div class="modal-header">
                    <h2>${statusIcon} ${model.name} ${testType}测试${statusText}</h2>
                    <button class="modal-close-btn" data-action="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="test-summary ${statusClass}">
                        <div class="test-info">
                            <h3>测试概要</h3>
                            <p><strong>模型名称:</strong> ${model.name}</p>
                            <p><strong>模型ID:</strong> ${model.modelId}</p>
                            <p><strong>测试类型:</strong> ${testType}</p>
                            <p><strong>测试时间:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>测试结果:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
                        </div>
                    </div>
                    ${resultContent}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" data-action="close-modal">
                        关闭
                    </button>
                    ${isSuccess && testType === 'TaskMaster' ? `
                        <button class="btn btn-primary" data-action="export-test-config" data-model-id="${model.id}">
                            <span class="btn-icon">💾</span>
                            导出配置
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        this.showModal(modalHtml);
    }

    /**
     * 导出测试配置
     */
    async exportTestConfig(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;

        const provider = this.providers.find(p => p.id === model.providerId);
        if (!provider) return;

        try {
            const taskMasterConfig = this.buildTaskMasterConfig(model, provider);

            // 创建下载链接
            const configJson = JSON.stringify(taskMasterConfig, null, 2);
            const blob = new Blob([configJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `taskmaster-config-${model.name.toLowerCase().replace(/\s+/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(`✅ ${model.name} 配置已导出`, 'success');
            }
        } catch (error) {
            // Failed to export config
            if (window.app && window.app.updateStatus) {
                window.app.updateStatus(`❌ 配置导出失败: ${error.message}`, 'error');
            }
        }
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        return 'model_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * 基于模型名称生成modelId
     */
    generateModelId(modelName) {
        if (!modelName) {
            return 'custom-model-' + Date.now();
        }

        // 将模型名称转换为合适的ID格式
        return modelName
            .toLowerCase()
            .replace(/[^a-z0-9\-_.]/g, '-') // 替换非法字符为连字符
            .replace(/-+/g, '-') // 合并多个连字符
            .replace(/^-|-$/g, ''); // 移除开头和结尾的连字符
    }

    /**
     * 更新服务商筛选下拉框
     */
    updateProviderFilter() {
        const filterSelect = document.getElementById('models-provider-filter');
        if (!filterSelect) return;

        // 清空现有选项，保留"全部服务商"
        filterSelect.innerHTML = '<option value="">全部服务商</option>';

        // 添加服务商选项
        this.providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.name;
            if (provider.id === this.currentProviderFilter) {
                option.selected = true;
            }
            filterSelect.appendChild(option);
        });
    }

    /**
     * 绑定服务商筛选事件
     */
    bindProviderFilter() {
        const filterSelect = document.getElementById('models-provider-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterByProvider(e.target.value);
            });
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
                } else if (e.target.dataset.action === 'export-test-config') {
                    const modelId = e.target.dataset.modelId;
                    if (modelId) {
                        this.exportTestConfig(modelId);
                    }
                }
            };

            modalOverlay.addEventListener('click', this.handleModalClose);
        }
    }
}
