/**
 * main.js
 * Main application entry point for Task Master UI Configuration Tool
 */

import { ProviderConfig } from './components/ProviderConfig.js';
import { ModelConfig } from './components/ModelConfig.js';
import { SaveConfig } from './components/SaveConfig.js';
import { ConfigManager } from './utils/configManager.js';
import { TaskMasterTester } from './utils/TaskMasterTester.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { Logger } from './utils/Logger.js';
import { UINotification } from './components/UINotification.js';
import { LogViewer } from './components/LogViewer.js';
import { globalAppController, appActions } from './controllers/AppController.js';
import { globalTabController } from './controllers/TabController.js';
import { stateHelpers } from './utils/StateManager.js';
import { globalEventManager } from './utils/EventManager.js';

// 强制设置Logger为DEBUG级别以便调试，并启用存储
Logger.setLevel(Logger.Levels.DEBUG);
Logger.config.enableStorage = true;

// 添加全局测试函数
window.testAutoLoad = function() {
    Logger.debug('🧪 全局测试函数被调用了！');
    const btn = document.querySelector('#auto-load-config-btn');
    Logger.debug('🔍 按钮存在吗？', { buttonExists: !!btn });
    if (btn) {
        btn.click();
    }
};

class TaskMasterConfigApp {
    constructor() {
        this.configManager = new ConfigManager();
        this.saveConfig = new SaveConfig(this.configManager);
        this.providerConfig = new ProviderConfig(this.configManager, this.saveConfig);
        this.modelConfig = new ModelConfig(this.configManager, this.saveConfig);
        this.taskMasterTester = new TaskMasterTester(this.configManager, this.saveConfig.transformer);
        this.logViewer = new LogViewer();

        Logger.info('TaskMaster Config App created');
        this.init();
    }

    async init() {
        try {
            Logger.info('Initializing TaskMaster Config App');

            // 初始化应用控制器
            await globalAppController.initialize();

            // 注册组件到应用控制器
            globalAppController.registerComponent('configManager', this.configManager);
            globalAppController.registerComponent('providerConfig', this.providerConfig);
            globalAppController.registerComponent('modelConfig', this.modelConfig);
            globalAppController.registerComponent('saveConfig', this.saveConfig);
            globalAppController.registerComponent('taskMasterTester', this.taskMasterTester);
            globalAppController.registerComponent('logViewer', this.logViewer);

            // 初始化标签页控制器
            globalTabController.initialize();
            globalAppController.registerController('tab', globalTabController);

            // Load existing configuration
            await this.configManager.loadConfiguration();

            // Initialize UI components
            this.initializeComponents();
            this.initializeEventListeners();

            // Update project path status
            this.updateProjectPathStatus();

            // Load initial data
            await this.loadInitialData();

            // Try to auto-load TaskMaster configuration if project path is valid
            await this.tryAutoLoadConfiguration();

            Logger.info('App initialization completed successfully');
            appActions.showStatus('配置加载成功');
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'init',
                action: 'initialization'
            });
            appActions.showStatus('配置加载失败', 'error');
        }
    }

    // 标签页导航现在由TabController处理

    initializeComponents() {
        // Initialize provider configuration
        this.providerConfig.initialize();
        
        // Initialize model configuration
        this.modelConfig.initialize();
        
        // Initialize save configuration
        this.saveConfig.initialize();
    }

    initializeEventListeners() {
        this.eventGroup = globalEventManager.createEventGroup('TaskMasterConfigApp');

        // 检查按钮是否存在
        const autoLoadBtn = document.querySelector('#auto-load-config-btn');
        Logger.debug('🔍 自动加载按钮是否存在: ' + (autoLoadBtn ? '是' : '否'));
        if (autoLoadBtn) {
            Logger.debug('🔍 按钮元素存在', { element: autoLoadBtn.tagName, id: autoLoadBtn.id });
        }



        // Add provider button
        this.eventGroup.add('#add-provider-btn', 'click', () => {
            this.providerConfig.showAddProviderModal();
        });

        // Add model button
        this.eventGroup.add('#add-model-btn', 'click', () => {
            this.modelConfig.showAddModelModal();
        });

        // Configuration actions

        this.eventGroup.add('#reset-config-btn', 'click', () => {
            this.resetConfiguration();
        });

        // TaskMaster package location
        this.eventGroup.add('#select-package-btn', 'click', () => {
            this.selectPackagePath();
        });

        this.eventGroup.add('#clear-package-btn', 'click', () => {
            this.clearPackagePath();
        });

        // Project path selection
        this.eventGroup.add('#select-project-btn', 'click', () => {
            this.selectProjectPath();
        });

        this.eventGroup.add('#clear-project-btn', 'click', () => {
            this.clearProjectPath();
        });



        // Auto load config button
        this.eventGroup.add('#auto-load-config-btn', 'click', () => {
            Logger.debug('🔘 自动加载按钮被点击了！');
            this.autoLoadConfiguration();
        });

        // View logs button
        this.eventGroup.add('#view-logs-btn', 'click', () => {
            this.logViewer.toggle();
        });

        // Listen for configuration changes
        this.eventGroup.add(document, 'configChanged', () => {
            stateHelpers.setHasUnsavedChanges(true);
        });

        Logger.debug('Event listeners initialized');
    }

    async loadInitialData() {
        try {
            // Load configuration first
            await this.configManager.loadConfiguration();

            // 如果有TaskMaster项目，先尝试从TaskMaster加载配置
            if (this.configManager.isProjectValid()) {
                const autoLoaded = await this.saveConfig.tryAutoLoadExistingConfig();
                if (autoLoaded) {
                    Logger.info('从TaskMaster项目自动加载配置成功');
                }
            }

            // Load providers (不再重复从TaskMaster加载)
            await this.providerConfig.loadProviders();

            // Load models (不再重复从TaskMaster加载)
            await this.modelConfig.loadModels();

            // Update UI state
            this.updateProjectPathStatus();
            this.updatePackagePathStatus();
            stateHelpers.setHasUnsavedChanges(false);

            // Try to auto-restore TaskMaster package directory handle
            await this.tryAutoRestorePackageHandle();

            Logger.info('Initial data loaded successfully');
        } catch (error) {
            Logger.error('配置加载失败', { error: error.message });
            throw error;
        }
    }

    async saveConfiguration() {
        try {
            this.updateStatus('正在保存配置到TaskMaster项目...', 'loading');

            // 保存到本地存储
            await this.configManager.saveConfiguration();

            // 如果有有效的TaskMaster项目路径，也保存到项目中
            if (this.configManager.isProjectValid()) {
                await this.saveConfig.saveToTaskMasterProject();
                this.updateStatus('配置已保存到TaskMaster项目', 'success');
            } else {
                this.updateStatus('配置已保存到本地存储（未设置TaskMaster项目路径）', 'warning');
            }

            stateHelpers.setHasUnsavedChanges(false);
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'saveConfiguration',
                action: 'save_config'
            });
            this.updateStatus('配置保存失败', 'error');
        }
    }



    async resetConfiguration() {
        const confirmed = await UINotification.confirm(
            '确定要重置所有配置吗？此操作无法撤销。',
            {
                title: '重置配置',
                confirmText: '重置',
                cancelText: '取消'
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            appActions.showStatus('正在重置配置...', 'loading');

            await this.configManager.resetConfiguration();
            // 重置后重新加载所有数据（这是用户明确要求的重置操作）
            await this.loadInitialData();

            stateHelpers.setHasUnsavedChanges(false);
            appActions.showStatus('配置重置成功', 'success');
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'resetConfiguration',
                action: 'reset_config'
            });
            appActions.showStatus('配置重置失败', 'error');
        }
    }

    // updateSaveButtonState现在由AppController通过状态管理自动处理
    // updateStatus现在使用appActions.showStatus

    // 兼容性方法，将updateStatus调用重定向到appActions.showStatus
    updateStatus(message, type) {
        appActions.showStatus(message, type);
    }

    // Project Path Management Methods

    async selectProjectPath() {
        try {
            this.updateStatus('请选择TaskMaster项目目录...', 'loading');

            // 使用File System Access API选择目录
            if ('showDirectoryPicker' in window) {
                // 显示选择指导
                const savedPath = this.configManager.getProjectPath();
                if (savedPath) {
                    this.updateStatus(`请选择TaskMaster项目目录（上次: ${savedPath}）`, 'info');
                } else {
                    this.updateStatus('请选择包含.taskmaster目录或scripts/modules目录的TaskMaster项目根目录', 'info');
                }

                // 尝试获取上次的目录句柄作为startIn参数
                let startInOption = 'documents'; // 默认值

                try {
                    const previousHandle = await this.saveConfig.directoryHandleManager.restoreDirectoryHandle('taskmaster-project');
                    if (previousHandle && previousHandle.handle) {
                        // 尝试使用上次的目录句柄作为startIn
                        startInOption = previousHandle.handle;
                        Logger.debug('🎯 使用上次的目录句柄作为startIn');
                    }
                } catch (error) {
                    Logger.debug('⚠️ 无法使用上次的目录句柄，使用默认startIn');
                }

                // 设置文件选择器选项
                const pickerOptions = {
                    mode: 'readwrite',
                    startIn: startInOption
                };

                let directoryHandle;
                try {
                    directoryHandle = await window.showDirectoryPicker(pickerOptions);
                } catch (error) {
                    // 如果使用目录句柄作为startIn失败，回退到默认值
                    if (startInOption !== 'documents') {
                        Logger.debug('🔄 使用目录句柄作为startIn失败，回退到documents');
                        pickerOptions.startIn = 'documents';
                        directoryHandle = await window.showDirectoryPicker(pickerOptions);
                    } else {
                        throw error;
                    }
                }

                // 获取项目路径 - 只使用目录名作为标识
                const projectPath = directoryHandle.name;

                // 保存路径到配置
                await this.setProjectPath(projectPath);

                // 临时缓存目录句柄用于本次会话
                this.saveConfig.directoryHandleCache.set('taskmaster-project', directoryHandle);

                // 保存到IndexedDB以便下次恢复
                await this.saveConfig.directoryHandleManager.saveDirectoryHandle('taskmaster-project', directoryHandle);

                // 验证是否是有效的TaskMaster项目
                const isValidProject = await this.validateTaskMasterProject(directoryHandle);
                if (isValidProject) {
                    this.updateStatus('✅ TaskMaster项目路径设置成功', 'success');

                    // 自动尝试加载配置
                    setTimeout(() => {
                        this.autoLoadConfiguration();
                    }, 500);
                } else {
                    this.updateStatus('⚠️ 项目路径已设置，但未检测到TaskMaster配置文件', 'warning');
                }
            } else {
                // 降级到传统方式
                await this.selectProjectPathFallback();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.updateStatus('用户取消了目录选择', 'info');
            } else {
                ErrorHandler.handle(error, {
                    component: 'TaskMasterConfigApp',
                    method: 'selectProjectPath',
                    action: 'select_path'
                });
                this.updateStatus('项目路径选择失败', 'error');
            }
        }
    }

    /**
     * 验证是否是有效的TaskMaster项目
     */
    async validateTaskMasterProject(directoryHandle) {
        // 检查是否存在 .taskmaster 目录
        try {
            await directoryHandle.getDirectoryHandle('.taskmaster');
            return true;
        } catch (error) {
            // 检查是否存在 scripts/modules 目录
            try {
                const scriptsHandle = await directoryHandle.getDirectoryHandle('scripts');
                await scriptsHandle.getDirectoryHandle('modules');
                return true;
            } catch (scriptsError) {
                return false;
            }
        }
    }

    /**
     * 传统方式选择项目路径（降级方案）
     */
    async selectProjectPathFallback() {
        // Create a file input for directory selection
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.style.display = 'none';

        input.addEventListener('change', async (event) => {
            const files = event.target.files;
            if (files.length > 0) {
                // Get the directory path from the first file
                const firstFile = files[0];
                const pathParts = firstFile.webkitRelativePath.split('/');
                const projectPath = firstFile.path ?
                    firstFile.path.substring(0, firstFile.path.lastIndexOf(firstFile.webkitRelativePath)) :
                    pathParts[0]; // Fallback for browsers that don't support file.path

                await this.setProjectPath(projectPath);
                this.updateStatus('⚠️ 项目路径已设置（传统模式），点击"自动加载配置"需要重新选择目录', 'warning');
            }
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    }

    async setProjectPath(projectPath) {
        try {
            appActions.showStatus('正在验证项目路径...', 'loading');

            await this.configManager.saveProjectPath(projectPath);
            this.updateProjectPathStatus();

            appActions.showStatus('项目路径设置成功', 'success');
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'setProjectPath',
                action: 'set_path',
                projectPath
            });
            appActions.showStatus('无效的 TaskMaster 项目路径', 'error');
        }
    }

    async clearProjectPath() {
        try {
            await this.configManager.saveProjectPath(null);
            this.updateProjectPathStatus();
            appActions.showStatus('项目路径已清除', 'success');
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'clearProjectPath',
                action: 'clear_path'
            });
            appActions.showStatus('项目路径清除失败', 'error');
        }
    }

    updateProjectPathStatus() {
        const pathElement = document.getElementById('project-path-display');
        const statusElement = document.getElementById('project-path-status');

        const projectPath = this.configManager.getProjectPath();
        const isValid = this.configManager.isProjectValid();

        if (projectPath && isValid) {
            pathElement.textContent = projectPath;
            statusElement.textContent = '✅ 有效的 TaskMaster 项目';
            statusElement.className = 'project-status valid';
        } else if (projectPath && !isValid) {
            pathElement.textContent = projectPath;
            statusElement.textContent = '❌ 无效的项目路径';
            statusElement.className = 'project-status invalid';
        } else {
            pathElement.textContent = '未选择项目';
            statusElement.textContent = '⚠️ 请选择 TaskMaster 项目';
            statusElement.className = 'project-status warning';
        }
    }





    /**
     * 测试TaskMaster集成
     */
    async testTaskMasterIntegration() {
        try {
            this.updateStatus('正在测试TaskMaster集成...', 'loading');

            // 运行完整的TaskMaster测试套件
            const testResults = await this.taskMasterTester.runFullTaskMasterTest();

            // 显示测试结果
            const { overall, tests } = testResults;

            if (overall.failed === 0) {
                this.updateStatus(`✅ TaskMaster集成测试全部通过！(${overall.passed}/${overall.total})`, 'success');
            } else {
                this.updateStatus(`❌ TaskMaster集成测试部分失败 (${overall.passed}/${overall.total} 通过)`, 'error');
            }

            // 在日志中显示详细结果
            Logger.info('⚙️ TaskMaster集成测试结果');
            Logger.info(`总体结果: ${overall.passed}/${overall.total} 通过`);

            tests.forEach(test => {
                if (test.passed) {
                    Logger.info(`✅ ${test.name}: ${test.details}`);
                } else {
                    Logger.error(`❌ ${test.name}: ${test.details}`);
                    if (test.errors.length > 0) {
                        Logger.error('错误详情', { errors: test.errors });
                    }
                }
            });

            // 如果有失败的测试，显示建议
            if (overall.failed > 0) {
                const failedTests = tests.filter(t => !t.passed);
                const suggestions = this.generateTestFailureSuggestions(failedTests);
                Logger.info('💡 修复建议', { suggestions });
            }

        } catch (error) {
            Logger.error('TaskMaster integration test failed', { error: error.message }, error);
            this.updateStatus(`❌ TaskMaster集成测试失败: ${error.message}`, 'error');
        }
    }

    async tryAutoLoadConfiguration() {
        try {
            // 首先尝试从IndexedDB恢复目录句柄
            Logger.debug('🔍 尝试从IndexedDB恢复目录句柄...');
            const directoryHandle = await this.saveConfig.directoryHandleManager.restoreWithPermission('taskmaster-project', 'read');

            if (directoryHandle) {
                Logger.info(`🎉 成功恢复目录句柄: ${directoryHandle.name}`);

                // 更新缓存
                this.saveConfig.directoryHandleCache.set('taskmaster-project', directoryHandle);

                // 保存项目路径到配置
                await this.setProjectPath(directoryHandle.name);

                // 验证是否是有效的TaskMaster项目
                const isValidProject = await this.validateTaskMasterProject(directoryHandle);
                if (isValidProject) {
                    this.updateStatus(`🎉 已自动恢复项目: ${directoryHandle.name}`, 'success');

                    // 尝试自动加载配置
                    await this.tryAutoImportConfiguration();
                    return;
                } else {
                    this.updateStatus(`⚠️ 已恢复项目路径，但未检测到TaskMaster配置文件: ${directoryHandle.name}`, 'warning');
                    return;
                }
            }

            // 无法恢复目录句柄，检查是否有保存的项目路径
            if (!this.configManager.isProjectValid()) {
                Logger.debug('No valid TaskMaster project path set, skipping auto-load');
                return;
            }

            const savedPath = this.configManager.getProjectPath();
            if (savedPath) {
                this.updateStatus(`📁 检测到保存的项目路径: ${savedPath}。请点击"选择项目"授权访问以加载配置。`, 'warning');
                return;
            }

            Logger.info('Valid TaskMaster project detected, attempting auto-load...');
            this.updateStatus('检测到 TaskMaster 项目，正在尝试自动加载配置...', 'loading');

            // Try to auto-load configuration silently
            await this.tryAutoImportConfiguration();

        } catch (error) {
            // Auto-load failure is not critical, just log it
            Logger.debug('Auto-load configuration failed (this is normal): ' + error.message);
            // Don't show error to user for auto-load failures
        }
    }

    async tryAutoImportConfiguration() {
        try {
            const projectPath = this.configManager.getProjectPath();
            const hasTaskMasterProject = projectPath && this.configManager.isProjectValid();

            if (hasTaskMasterProject) {
                Logger.info('检测到有效的TaskMaster项目，尝试自动加载现有配置...');

                // 尝试自动加载现有配置
                const autoLoaded = await this.saveConfig.tryAutoLoadExistingConfig();

                if (autoLoaded) {
                    // 重新加载供应商和模型数据
                    await this.providerConfig.loadProviders();
                    await this.modelConfig.loadModels();
                    const providers = await this.configManager.getProviders();
                    const models = await this.configManager.getModels();

                    this.updateStatus(`🎉 自动加载成功！已加载 ${providers.length} 个服务商和 ${models.length} 个模型`, 'success');
                } else {
                    this.updateStatus(`📁 检测到 TaskMaster 项目: ${projectPath}。点击"自动加载配置"按钮加载现有配置。`, 'info');
                }
            } else {
                // 没有项目路径，显示空状态
                this.updateStatus(`⚠️ 请设置TaskMaster项目路径以加载现有配置`, 'warning');
            }
        } catch (error) {
            Logger.error('Auto import configuration failed', { error: error.message }, error);
            throw error;
        }
    }



    /**
     * 生成测试失败的修复建议
     */
    generateTestFailureSuggestions(failedTests) {
        const suggestions = [];

        failedTests.forEach(test => {
            switch (test.name) {
                case '配置转换测试':
                    suggestions.push('检查服务商和模型配置是否完整');
                    break;
                case '模型选择测试':
                    suggestions.push('确保模型配置了正确的角色（main/fallback/research）');
                    break;
                case '任务创建测试':
                    suggestions.push('确保至少有一个服务商配置了有效的API密钥');
                    break;
                case '配置验证测试':
                    suggestions.push('检查配置格式是否符合TaskMaster要求');
                    break;
                case '端到端流程测试':
                    suggestions.push('检查配置转换过程中是否有数据丢失');
                    break;
            }
        });

        return suggestions;
    }



    async autoLoadConfiguration() {
        try {
            Logger.debug('🚀 autoLoadConfiguration 方法被调用了！');
            // 首先检查项目路径是否已设置
            if (!this.configManager.isProjectValid()) {
                Logger.error('❌ 项目路径无效');
                this.updateStatus('❌ 请先设置有效的TaskMaster项目路径', 'error');
                return;
            }
            Logger.info('✅ 项目路径有效，继续执行...');

            this.updateStatus('正在从TaskMaster项目加载配置...', 'loading');

            // 尝试从TaskMaster项目加载真实配置
            const success = await this.saveConfig.tryAutoLoadExistingConfig();

            if (success) {
                // 重新加载供应商和模型数据
                await this.providerConfig.loadProviders();
                await this.modelConfig.loadModels();

                const providers = await this.configManager.getProviders();
                const models = await this.configManager.getModels();

                this.updateStatus(`🎉 加载成功！已加载 ${providers.length} 个服务商和 ${models.length} 个模型`, 'success');
            } else {
                this.updateStatus('❌ 未找到TaskMaster配置文件，请检查项目路径', 'error');
            }
        } catch (error) {
            Logger.error('Auto load configuration failed', { error: error.message }, error);
            this.updateStatus('❌ 加载配置失败', 'error');
        }
    }

    // TaskMaster Package Management Methods

    async tryAutoRestorePackageHandle() {
        try {
            // 首先尝试从IndexedDB恢复TaskMaster包目录句柄
            Logger.debug('🔍 尝试从IndexedDB恢复TaskMaster包目录句柄...');
            const packageHandle = await this.saveConfig.directoryHandleManager.restoreWithPermission('taskmaster-package', 'readwrite');

            if (packageHandle) {
                Logger.info(`🎉 成功恢复TaskMaster包目录句柄: ${packageHandle.name}`);

                // 更新缓存
                this.saveConfig.directoryHandleCache.set('taskmaster-package', packageHandle);

                // 验证是否是有效的TaskMaster包
                const isValidPackage = await this.isTaskMasterPackage(packageHandle);
                if (isValidPackage) {
                    const version = await this.getPackageVersion(packageHandle);

                    // 保存包路径到配置
                    await this.setPackagePath(packageHandle.name);

                    // 更新UI显示
                    this.updatePackagePathDisplay(packageHandle.name, packageHandle.name);
                    this.updatePackageStatus('valid', `✅ TaskMaster包已自动恢复 (v${version})`);

                    Logger.info(`🎉 已自动恢复TaskMaster包: ${packageHandle.name} (v${version})`);
                    return;
                } else {
                    Logger.warn(`⚠️ 已恢复包路径，但验证失败: ${packageHandle.name}`);
                    // 清除无效的句柄
                    await this.saveConfig.directoryHandleManager.removeDirectoryHandle('taskmaster-package');
                    return;
                }
            }

            // 无法恢复目录句柄，检查是否有保存的包路径
            const savedPath = this.configManager.getPackagePath();
            if (savedPath) {
                Logger.debug(`📁 检测到保存的TaskMaster包路径: ${savedPath}。需要重新选择以授权访问。`);
                this.updatePackagePathDisplay(savedPath, savedPath);
                this.updatePackageStatus('warning', '⚠️ 请重新选择以授权访问');
                return;
            }

            Logger.debug('No TaskMaster package path set, skipping auto-restore');

        } catch (error) {
            // Auto-restore failure is not critical, just log it
            Logger.debug('Auto-restore TaskMaster package handle failed (this is normal): ' + error.message);
            // Don't show error to user for auto-restore failures
        }
    }





    async isTaskMasterPackage(dirHandle) {
        try {
            // 检查package.json
            const packageFile = await dirHandle.getFileHandle('package.json');
            const packageContent = await packageFile.getFile();
            const packageText = await packageContent.text();
            const packageJson = JSON.parse(packageText);

            // 检查是否为task-master-ai包
            if (packageJson.name !== 'task-master-ai') {
                return false;
            }

            // 检查是否包含src/ai-providers目录
            const srcDir = await dirHandle.getDirectoryHandle('src');
            const providersDir = await srcDir.getDirectoryHandle('ai-providers');

            return true;
        } catch (error) {
            return false;
        }
    }

    async getPackageVersion(dirHandle) {
        try {
            const packageFile = await dirHandle.getFileHandle('package.json');
            const packageContent = await packageFile.getFile();
            const packageText = await packageContent.text();
            const packageJson = JSON.parse(packageText);
            return packageJson.version || 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    async selectPackagePath() {
        try {
            this.updateStatus('选择TaskMaster包目录...', 'loading');

            // 显示选择指导
            const savedPath = this.configManager.getPackagePath();
            if (savedPath) {
                this.updateStatus(`请选择TaskMaster包目录（上次: ${savedPath}）`, 'info');
            } else {
                this.updateStatus('请选择包含package.json和src/ai-providers目录的TaskMaster包根目录', 'info');
            }

            // 尝试获取上次的目录句柄作为startIn参数
            let startInOption = 'documents'; // 默认值

            try {
                const previousHandle = await this.saveConfig.directoryHandleManager.restoreDirectoryHandle('taskmaster-package');
                if (previousHandle && previousHandle.handle) {
                    // 尝试使用上次的目录句柄作为startIn
                    startInOption = previousHandle.handle;
                    Logger.debug('🎯 使用上次的TaskMaster包目录句柄作为startIn');
                }
            } catch (error) {
                Logger.debug('⚠️ 无法使用上次的TaskMaster包目录句柄，使用默认startIn');
            }

            // 设置文件选择器选项
            const pickerOptions = {
                mode: 'readwrite',
                startIn: startInOption
            };

            let dirHandle;
            try {
                dirHandle = await window.showDirectoryPicker(pickerOptions);
            } catch (error) {
                // 如果使用目录句柄作为startIn失败，回退到默认值
                if (startInOption !== 'documents') {
                    Logger.debug('🔄 使用TaskMaster包目录句柄作为startIn失败，回退到documents');
                    pickerOptions.startIn = 'documents';
                    dirHandle = await window.showDirectoryPicker(pickerOptions);
                } else {
                    throw error;
                }
            }

            // 验证是否为TaskMaster包
            if (await this.isTaskMasterPackage(dirHandle)) {
                const version = await this.getPackageVersion(dirHandle);

                // 获取包路径 - 只使用目录名作为标识
                const packagePath = dirHandle.name;

                // 保存路径到配置
                await this.setPackagePath(packagePath);

                // 保存包句柄
                this.saveConfig.directoryHandleCache.set('taskmaster-package', dirHandle);
                await this.saveConfig.directoryHandleManager.saveDirectoryHandle('taskmaster-package', dirHandle);

                // 更新UI显示
                this.updatePackagePathDisplay(dirHandle.name, dirHandle.name);
                this.updatePackageStatus('valid', `✅ TaskMaster包已设置 (v${version})`);

                this.updateStatus('TaskMaster包设置成功', 'success');
            } else {
                this.updatePackageStatus('invalid', '❌ 所选目录不是有效的TaskMaster包');
                this.updateStatus('无效的TaskMaster包', 'error');
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                this.updateStatus('用户取消了选择', 'warning');
            } else {
                ErrorHandler.handle(error, {
                    component: 'TaskMasterConfigApp',
                    method: 'selectPackagePath',
                    action: 'select_directory'
                });
                this.updateStatus('选择包目录失败', 'error');
            }
        }
    }

    async setPackagePath(packagePath) {
        try {
            this.updateStatus('正在验证TaskMaster包路径...', 'loading');

            await this.configManager.savePackagePath(packagePath);
            this.updatePackagePathStatus();

            this.updateStatus('TaskMaster包路径设置成功', 'success');
        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'setPackagePath',
                action: 'set_path',
                packagePath
            });
            this.updateStatus('无效的 TaskMaster 包路径', 'error');
        }
    }

    async clearPackagePath() {
        try {
            // 清除保存的路径
            await this.configManager.savePackagePath(null);

            // 清除保存的句柄
            this.saveConfig.directoryHandleCache.delete('taskmaster-package');
            this.saveConfig.directoryHandleManager.removeDirectoryHandle('taskmaster-package');

            // 更新UI显示
            this.updatePackagePathStatus();

            this.updateStatus('TaskMaster包路径已清除', 'success');

        } catch (error) {
            ErrorHandler.handle(error, {
                component: 'TaskMasterConfigApp',
                method: 'clearPackagePath',
                action: 'clear_path'
            });
            this.updateStatus('清除包路径失败', 'error');
        }
    }

    updatePackagePathDisplay(displayText, fullPath) {
        const displayElement = document.getElementById('package-path-display');
        displayElement.textContent = displayText;
        displayElement.title = fullPath || displayText;
    }

    updatePackageStatus(type, message) {
        const statusElement = document.getElementById('package-path-status');
        statusElement.className = `package-status ${type}`;
        statusElement.textContent = message;
    }

    updatePackagePathStatus() {
        const pathElement = document.getElementById('package-path-display');
        const statusElement = document.getElementById('package-path-status');

        const packagePath = this.configManager.getPackagePath();
        const isValid = this.configManager.isPackageValid();

        if (packagePath && isValid) {
            pathElement.textContent = packagePath;
            statusElement.textContent = '✅ 有效的 TaskMaster 包';
            statusElement.className = 'package-status valid';
        } else if (packagePath && !isValid) {
            pathElement.textContent = packagePath;
            statusElement.textContent = '❌ 无效的包路径';
            statusElement.className = 'package-status invalid';
        } else {
            pathElement.textContent = '未选择TaskMaster包';
            statusElement.textContent = '⚠️ 请选择 TaskMaster 包目录';
            statusElement.className = 'package-status warning';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TaskMasterConfigApp();
});
