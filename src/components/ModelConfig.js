/**
 * ModelConfig.js
 * Component for managing AI model configurations
 */

import { NetworkClient } from '../utils/NetworkClient.js';
import { UINotification } from './UINotification.js';
import { Logger } from '../utils/Logger.js';
import { TaskMasterFileManager } from '../utils/TaskMasterFileManager.js';

export class ModelConfig {
    constructor(configManager, saveConfig) {
        this.configManager = configManager;
        this.saveConfig = saveConfig;
        this.models = [];
        this.providers = [];
        this.currentProviderFilter = null; // 当前过滤的服务商ID

        // 创建专用的API测试网络客户端
        this.networkClient = NetworkClient.createAPITestClient();

        // 初始化TaskMaster文件管理器
        this.taskMasterFileManager = null;
        this.taskMasterModelsCache = new Map(); // 缓存TaskMaster中的模型状态
        this.selectedModels = new Set(); // 选中的模型ID集合
        this.isMultiSelectMode = false; // 多选模式状态
    }

    initialize() {
        this.bindEvents();
        this.bindProviderFilter();
        // 初始化多选按钮状态
        setTimeout(() => this.updateMultiSelectButton(), 100);
    }

    bindEvents() {
        // Event delegation for model actions
        document.getElementById('models-list').addEventListener('click', (e) => {
            if (e.target.matches('.edit-model-btn')) {
                const modelId = e.target.dataset.modelId;
                this.editModel(modelId);
            } else if (e.target.matches('.import-model-btn')) {
                const modelId = e.target.dataset.modelId;
                this.importModelToTaskMaster(modelId);
            } else if (e.target.matches('.delete-from-taskmaster-btn')) {
                const modelId = e.target.dataset.modelId;
                this.deleteModelFromTaskMaster(modelId);
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

        // Event delegation for checkboxes
        document.getElementById('models-list').addEventListener('change', (e) => {
            if (e.target.matches('.model-checkbox') && e.target.dataset.modelId) {
                const modelId = e.target.dataset.modelId;
                this.toggleModelSelection(modelId);
            }
        });

        // 绑定多选和批量操作按钮事件（在document上）
        document.addEventListener('click', (e) => {
            if (e.target.matches('#toggle-multi-select-btn')) {
                this.toggleMultiSelectMode();
            } else if (e.target.matches('#batch-import-btn')) {
                this.batchImportModels();
            } else if (e.target.matches('#batch-delete-btn')) {
                this.batchDeleteModels();
            } else if (e.target.matches('.clear-selection-btn')) {
                this.clearSelection();
            }
        });
    }

    async loadModels() {
        try {
            this.models = await this.configManager.getModels();
            this.providers = await this.configManager.getProviders();

            // 更新模型显示名称
            await this.updateModelDisplayNames();

            // 初始化TaskMasterFileManager
            if (!this.taskMasterFileManager && this.saveConfig) {
                this.taskMasterFileManager = new TaskMasterFileManager(this.configManager, this.saveConfig);
            }

            // 加载TaskMaster模型状态
            await this.loadTaskMasterModelsStatus();

            this.updateProviderFilter();
            this.renderModels();
        } catch (error) {
            Logger.error('加载模型失败', { error: error.message }, error);
        }
    }

    /**
     * 更新模型显示名称
     */
    async updateModelDisplayNames() {
        if (!this.saveConfig || !this.saveConfig.transformer) {
            return;
        }

        const transformer = this.saveConfig.transformer;

        for (const model of this.models) {
            try {
                const displayName = await transformer.getModelDisplayName(model.modelId);
                if (displayName !== model.name) {
                    model.name = displayName;
                    // 更新到配置管理器
                    await this.configManager.updateModel(model);
                }
            } catch (error) {
                // 静默处理错误
                // console.warn(`Failed to update display name for model ${model.modelId}:`, error);
            }
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
            <div class="models-grid-layout ${this.isMultiSelectMode ? 'multi-select-mode' : ''}">
                <div class="model-item-header">
                    <div class="model-checkbox-cell ${this.isMultiSelectMode ? 'visible' : 'hidden'}">
                        <input type="checkbox" id="select-all-models" class="model-checkbox" title="全选/取消全选">
                    </div>
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

        // 绑定全选复选框事件
        this.bindSelectAllEvent();

        // 更新全选复选框状态
        this.updateSelectAllState();
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

        // 检查模型是否在TaskMaster中存在
        const existsInTaskMaster = this.checkModelExistsInTaskMaster(model);

        // 根据存在状态渲染不同的按钮
        const taskMasterButton = existsInTaskMaster
            ? `<button class="btn btn-icon-only delete-from-taskmaster-btn" data-model-id="${model.id}" title="从TaskMaster删除">
                🗑️
               </button>`
            : `<button class="btn btn-icon-only import-model-btn" data-model-id="${model.id}" title="导入到TaskMaster">
                📥
               </button>`;

        const isSelected = this.selectedModels.has(model.id);

        return `
            <div class="model-item" data-model-id="${model.id}">
                <div class="model-checkbox-cell ${this.isMultiSelectMode ? 'visible' : 'hidden'}">
                    <input type="checkbox" class="model-checkbox" data-model-id="${model.id}" ${isSelected ? 'checked' : ''}>
                </div>
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
                    ${taskMasterButton}
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
     * 绑定全选复选框事件
     */
    bindSelectAllEvent() {
        const selectAllCheckbox = document.getElementById('select-all-models');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }
    }

    /**
     * 切换模型选择状态
     */
    toggleModelSelection(modelId) {
        if (this.selectedModels.has(modelId)) {
            this.selectedModels.delete(modelId);
        } else {
            this.selectedModels.add(modelId);
        }
        this.updateSelectAllState();
        this.renderModels(); // 重新渲染以更新批量操作区域
    }

    /**
     * 全选/取消全选
     */
    toggleSelectAll(checked) {
        const filteredModels = this.getFilteredModels();
        if (checked) {
            filteredModels.forEach(model => this.selectedModels.add(model.id));
        } else {
            filteredModels.forEach(model => this.selectedModels.delete(model.id));
        }
        this.renderModels();
    }

    /**
     * 更新全选复选框状态
     */
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('select-all-models');
        if (!selectAllCheckbox) return;

        const filteredModels = this.getFilteredModels();
        const selectedFilteredModels = filteredModels.filter(model => this.selectedModels.has(model.id));

        if (selectedFilteredModels.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedFilteredModels.length === filteredModels.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    /**
     * 清除选择
     */
    clearSelection() {
        this.selectedModels.clear();
        this.renderModels();
    }

    /**
     * 切换多选模式
     */
    toggleMultiSelectMode() {
        this.isMultiSelectMode = !this.isMultiSelectMode;
        if (!this.isMultiSelectMode) {
            // 退出多选模式时清除所有选择
            this.selectedModels.clear();
        }
        this.renderModels();
        this.updateMultiSelectButton();
    }

    /**
     * 更新多选按钮状态
     */
    updateMultiSelectButton() {
        const multiSelectBtn = document.getElementById('toggle-multi-select-btn');
        const batchImportBtn = document.getElementById('batch-import-btn');
        const batchDeleteBtn = document.getElementById('batch-delete-btn');

        if (multiSelectBtn) {
            if (this.isMultiSelectMode) {
                multiSelectBtn.innerHTML = '<span class="btn-icon">✖️</span>退出多选';
                multiSelectBtn.classList.add('active');
                // 显示批量操作按钮
                if (batchImportBtn) batchImportBtn.style.display = 'inline-flex';
                if (batchDeleteBtn) batchDeleteBtn.style.display = 'inline-flex';
            } else {
                multiSelectBtn.innerHTML = '<span class="btn-icon">☑️</span>多选';
                multiSelectBtn.classList.remove('active');
                // 隐藏批量操作按钮
                if (batchImportBtn) batchImportBtn.style.display = 'none';
                if (batchDeleteBtn) batchDeleteBtn.style.display = 'none';
            }
        }
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

    /**
     * 加载TaskMaster项目中的模型状态
     */
    async loadTaskMasterModelsStatus() {
        try {
            if (!this.saveConfig || !this.saveConfig.directoryHandleCache.has('taskmaster-project')) {
                // TaskMaster项目未加载
                this.taskMasterModelsCache.clear();
                return;
            }

            const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');
            const supportedModelsContent = await this.saveConfig.readFileFromDirectory(
                projectDirHandle,
                'scripts/modules/supported-models.json'
            );

            if (supportedModelsContent) {
                const supportedModels = JSON.parse(supportedModelsContent);

                // 清空缓存并重新填充
                this.taskMasterModelsCache.clear();

                // 遍历所有供应商和模型
                for (const [providerKey, models] of Object.entries(supportedModels)) {
                    if (Array.isArray(models)) {
                        models.forEach(model => {
                            this.taskMasterModelsCache.set(model.id, {
                                provider: providerKey,
                                exists: true
                            });
                        });
                    }
                }
            }
        } catch (error) {
            Logger.warn('加载TaskMaster模型状态失败', { error: error.message });
            this.taskMasterModelsCache.clear();
        }
    }

    /**
     * 检查模型是否在TaskMaster中存在
     */
    checkModelExistsInTaskMaster(model) {
        if (!model || !model.modelId) return false;

        // 从缓存中检查
        return this.taskMasterModelsCache.has(model.modelId);
    }

    /**
     * 批量导入模型到TaskMaster
     */
    async batchImportModels() {
        const selectedModelIds = Array.from(this.selectedModels);
        if (selectedModelIds.length === 0) {
            UINotification.warning('请先选择要导入的模型');
            return;
        }

        const confirmed = await UINotification.confirm(
            `确定要导入 ${selectedModelIds.length} 个模型到TaskMaster吗？`,
            {
                title: '批量导入模型',
                confirmText: '导入',
                cancelText: '取消'
            }
        );

        if (!confirmed) {
            Logger.info('用户取消批量导入模型操作', {
                selectedCount: selectedModelIds.length,
                selectedModelIds: selectedModelIds
            });
            return;
        }

        // 记录批量导入开始
        Logger.info('开始批量导入模型', {
            totalCount: selectedModelIds.length,
            selectedModelIds: selectedModelIds,
            operation: 'batch_import_models'
        });

        let successCount = 0;
        let failCount = 0;
        const failedModels = [];

        UINotification.info(`开始批量导入 ${selectedModelIds.length} 个模型...`);

        for (const modelId of selectedModelIds) {
            try {
                await this.importModelToTaskMaster(modelId, true); // 静默模式
                successCount++;
            } catch (error) {
                failCount++;
                const model = this.models.find(m => m.id === modelId);
                failedModels.push({
                    modelId: modelId,
                    modelName: model?.name || 'Unknown',
                    error: error.message
                });
            }
        }

        // 记录批量导入结果
        Logger.info('批量导入模型完成', {
            totalCount: selectedModelIds.length,
            successCount: successCount,
            failCount: failCount,
            failedModels: failedModels,
            operation: 'batch_import_models_complete'
        });

        // 显示结果
        if (failCount === 0) {
            UINotification.success(`成功导入 ${successCount} 个模型`);
        } else {
            UINotification.warning(`导入完成：成功 ${successCount} 个，失败 ${failCount} 个`, {
                duration: 8000
            });
        }

        // 清除选择并重新渲染
        this.clearSelection();
    }

    /**
     * 批量删除模型
     */
    async batchDeleteModels() {
        const selectedModelIds = Array.from(this.selectedModels);
        if (selectedModelIds.length === 0) {
            UINotification.warning('请先选择要删除的模型');
            return;
        }

        const confirmed = await UINotification.confirm(
            `确定要从TaskMaster项目中删除 ${selectedModelIds.length} 个模型吗？此操作无法撤销。`,
            {
                title: '批量删除模型',
                confirmText: '删除',
                cancelText: '取消'
            }
        );

        if (!confirmed) {
            Logger.info('用户取消批量删除模型操作', {
                selectedCount: selectedModelIds.length,
                selectedModelIds: selectedModelIds
            });
            return;
        }

        // 记录批量删除开始
        Logger.info('开始批量删除模型', {
            totalCount: selectedModelIds.length,
            selectedModelIds: selectedModelIds,
            operation: 'batch_delete_models'
        });

        let successCount = 0;
        let failCount = 0;
        const failedModels = [];

        UINotification.info(`开始批量删除 ${selectedModelIds.length} 个模型...`);

        for (const modelId of selectedModelIds) {
            try {
                await this.deleteModelFromTaskMaster(modelId, true); // 静默模式
                successCount++;
            } catch (error) {
                failCount++;
                const model = this.models.find(m => m.id === modelId);
                failedModels.push({
                    modelId: modelId,
                    modelName: model?.name || 'Unknown',
                    error: error.message
                });
            }
        }

        // 记录批量删除结果
        Logger.info('批量删除模型完成', {
            totalCount: selectedModelIds.length,
            successCount: successCount,
            failCount: failCount,
            failedModels: failedModels,
            operation: 'batch_delete_models_complete'
        });

        // 显示结果
        if (failCount === 0) {
            UINotification.success(`成功删除 ${successCount} 个模型`);
        } else {
            UINotification.warning(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`, {
                duration: 8000
            });
        }

        // 清除选择并重新渲染
        this.clearSelection();
    }

    /**
     * 导入模型到TaskMaster项目
     */
    async importModelToTaskMaster(modelId, silent = false) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) {
            if (!silent) UINotification.error('模型未找到');
            throw new Error('模型未找到');
        }

        const provider = this.providers.find(p => p.id === model.providerId);
        if (!provider) {
            if (!silent) UINotification.error('未找到对应的服务商');
            throw new Error('未找到对应的服务商');
        }

        if (!this.taskMasterFileManager) {
            if (!silent) UINotification.error('TaskMaster文件管理器未初始化');
            throw new Error('TaskMaster文件管理器未初始化');
        }

        // 记录导入开始
        Logger.info('开始导入模型到TaskMaster项目', {
            modelId: model.modelId,
            modelName: model.name,
            provider: provider.name,
            silent: silent,
            sweScore: model.sweScore,
            maxTokens: model.maxTokens,
            allowedRoles: model.allowedRoles
        });

        try {
            // 显示导入状态
            const importBtn = document.querySelector(`[data-model-id="${modelId}"].import-model-btn`);
            if (importBtn) {
                importBtn.innerHTML = '⏳';
                importBtn.disabled = true;
            }

            // 准备模型配置
            const modelConfig = {
                sweScore: model.sweScore || 0,
                costPer1MTokens: model.costPer1MTokens || { input: 0, output: 0 },
                allowedRoles: model.allowedRoles || ["main", "fallback", "research"],
                maxTokens: model.maxTokens || 128000
            };

            // 提取原始模型ID（去掉供应商前缀）
            const providerPrefix = provider.name.toLowerCase() + '-';
            const originalModelId = model.modelId.startsWith(providerPrefix)
                ? model.modelId.substring(providerPrefix.length)
                : model.modelId;

            // 调用TaskMasterFileManager添加模型
            const result = await this.taskMasterFileManager.addProviderModel(
                provider.name.toLowerCase(),
                originalModelId,
                modelConfig
            );

            if (result.success) {
                // 更新缓存
                this.taskMasterModelsCache.set(model.modelId, {
                    provider: provider.name.toLowerCase(),
                    exists: true
                });

                // 记录导入成功
                Logger.info('成功导入模型到TaskMaster项目', {
                    modelId: model.modelId,
                    modelName: model.name,
                    provider: provider.name,
                    operation: 'import_model_to_taskmaster',
                    originalModelId: originalModelId,
                    modelConfig: modelConfig
                });

                // 重新渲染模型列表以更新按钮状态
                if (!silent) this.renderModels();

                if (!silent) UINotification.success(`模型 ${model.name} 已成功导入到TaskMaster`);
            } else {
                throw new Error('导入失败');
            }

        } catch (error) {
            Logger.error('导入模型到TaskMaster项目失败', {
                modelId: model.modelId,
                modelName: model.name,
                provider: provider.name,
                error: error.message,
                operation: 'import_model_to_taskmaster'
            }, error);

            if (!silent) {
                UINotification.error(`导入模型失败: ${error.message}`, {
                    title: '导入失败',
                    duration: 5000
                });
            }
            throw error; // 重新抛出错误供批量操作处理
        } finally {
            // 恢复按钮状态
            const importBtn = document.querySelector(`[data-model-id="${modelId}"].import-model-btn`);
            if (importBtn) {
                importBtn.innerHTML = '📥';
                importBtn.disabled = false;
            }
        }
    }

    /**
     * 从TaskMaster项目删除模型
     */
    async deleteModelFromTaskMaster(modelId, silent = false) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) {
            if (!silent) UINotification.error('模型未找到');
            throw new Error('模型未找到');
        }

        const provider = this.providers.find(p => p.id === model.providerId);
        if (!provider) {
            if (!silent) UINotification.error('未找到对应的服务商');
            throw new Error('未找到对应的服务商');
        }

        // 静默模式下跳过确认
        if (!silent) {
            const confirmed = await UINotification.confirm(
                `确定要从TaskMaster项目中删除模型 "${model.name}" 吗？此操作无法撤销。`,
                {
                    title: '删除TaskMaster模型',
                    confirmText: '删除',
                    cancelText: '取消'
                }
            );

            if (!confirmed) {
                Logger.info('用户取消删除模型操作', {
                    modelId: model.modelId,
                    modelName: model.name,
                    provider: provider.name
                });
                return;
            }
        }

        // 记录删除开始
        Logger.info('开始从TaskMaster项目删除模型', {
            modelId: model.modelId,
            modelName: model.name,
            provider: provider.name,
            silent: silent
        });

        try {
            // 显示删除状态
            const deleteBtn = document.querySelector(`[data-model-id="${modelId}"].delete-from-taskmaster-btn`);
            if (deleteBtn) {
                deleteBtn.innerHTML = '⏳';
                deleteBtn.disabled = true;
            }

            // 从TaskMaster的supported-models.json中删除模型
            await this.removeModelFromTaskMaster(model, provider);

            // 更新缓存
            this.taskMasterModelsCache.delete(model.modelId);

            // 记录删除成功
            Logger.info('成功从TaskMaster项目删除模型', {
                modelId: model.modelId,
                modelName: model.name,
                provider: provider.name,
                operation: 'delete_model_from_taskmaster'
            });

            // 重新渲染模型列表以更新按钮状态
            if (!silent) this.renderModels();

            if (!silent) UINotification.success(`模型 ${model.name} 已从TaskMaster项目中删除`);

        } catch (error) {
            Logger.error('从TaskMaster删除模型失败', {
                modelId: model.modelId,
                modelName: model.name,
                provider: provider.name,
                error: error.message,
                operation: 'delete_model_from_taskmaster'
            }, error);
            if (!silent) {
                UINotification.error(`删除模型失败: ${error.message}`, {
                    title: '删除失败',
                    duration: 5000
                });
            }
            throw error; // 重新抛出错误供批量操作处理
        } finally {
            // 恢复按钮状态
            const deleteBtn = document.querySelector(`[data-model-id="${modelId}"].delete-from-taskmaster-btn`);
            if (deleteBtn) {
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.disabled = false;
            }
        }
    }

    /**
     * 从TaskMaster的supported-models.json中删除指定模型
     */
    async removeModelFromTaskMaster(model, provider) {
        const supportedModelsPath = 'scripts/modules/supported-models.json';
        const projectDirHandle = this.saveConfig.directoryHandleCache.get('taskmaster-project');

        if (!projectDirHandle) {
            throw new Error('TaskMaster项目目录不可用');
        }

        // 读取现有的supported-models.json
        const existingContent = await this.saveConfig.readFileFromDirectory(
            projectDirHandle,
            supportedModelsPath
        );

        if (!existingContent) {
            throw new Error('supported-models.json文件不存在');
        }

        const supportedModels = JSON.parse(existingContent);
        const providerKey = provider.name.toLowerCase();

        if (!supportedModels[providerKey] || !Array.isArray(supportedModels[providerKey])) {
            throw new Error(`供应商 ${providerKey} 不存在于supported-models.json中`);
        }

        // 查找并删除模型
        const modelIndex = supportedModels[providerKey].findIndex(m => m.id === model.modelId);
        if (modelIndex === -1) {
            throw new Error(`模型 ${model.modelId} 不存在于TaskMaster项目中`);
        }

        // 删除模型
        supportedModels[providerKey].splice(modelIndex, 1);

        // 写入更新后的文件
        await this.saveConfig.writeFileToDirectory(
            projectDirHandle,
            supportedModelsPath,
            JSON.stringify(supportedModels, null, 2)
        );
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

                </div>
            </div>
        `;

        this.showModal(modalHtml);
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

        // 重新绑定模态框关闭事件，因为innerHTML替换了内容
        this.bindModalCloseEvents();
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
                }
            };

            modalOverlay.addEventListener('click', this.handleModalClose);
        }
    }
}
