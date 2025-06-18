/**
 * TaskMasterPackageLocator.js
 * 定位TaskMaster包的安装位置，支持npm本地安装、全局安装和npx缓存
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

export class TaskMasterPackageLocator {
    constructor() {
        this.packageCache = new Map();
    }

    /**
     * 查找TaskMaster包的安装位置
     * @returns {Promise<Object>} 包含路径和类型信息的对象
     */
    async findTaskMasterPackage() {
        // 1. 尝试通过require.resolve定位（适用于npm安装）
        const npmLocation = await this.findViaRequireResolve();
        if (npmLocation) {
            return npmLocation;
        }

        // 2. 尝试查找全局安装
        const globalLocation = await this.findGlobalInstallation();
        if (globalLocation) {
            return globalLocation;
        }

        // 3. 尝试查找npx缓存
        const npxLocation = await this.findNpxCache();
        if (npxLocation) {
            return npxLocation;
        }

        // 4. 从GitHub获取默认配置（最后的备选方案）
        return await this.getFromGitHub();
    }

    /**
     * 通过require.resolve查找包位置
     */
    async findViaRequireResolve() {
        try {
            // 尝试在当前工作目录的node_modules中查找
            const packageJsonPath = require.resolve('task-master-ai/package.json');
            const packageDir = path.dirname(packageJsonPath);
            
            if (await this.validateTaskMasterPackage(packageDir)) {
                return {
                    type: 'npm-local',
                    path: packageDir,
                    providersPath: path.join(packageDir, 'src/ai-providers'),
                    source: 'require.resolve'
                };
            }
        } catch (error) {
            // 包未安装或不在当前项目中
        }

        return null;
    }

    /**
     * 查找全局安装的TaskMaster
     */
    async findGlobalInstallation() {
        try {
            // 获取npm全局目录
            const { execSync } = await import('child_process');
            const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
            const globalPackagePath = path.join(globalRoot, 'task-master-ai');

            if (fs.existsSync(globalPackagePath) && await this.validateTaskMasterPackage(globalPackagePath)) {
                return {
                    type: 'npm-global',
                    path: globalPackagePath,
                    providersPath: path.join(globalPackagePath, 'src/ai-providers'),
                    source: 'npm-global'
                };
            }
        } catch (error) {
            // 全局安装不存在或无法访问
        }

        return null;
    }

    /**
     * 查找npx缓存中的TaskMaster
     */
    async findNpxCache() {
        try {
            const npxCacheDir = path.join(os.homedir(), '.npm/_npx');
            
            // Windows系统的npx缓存位置
            const windowsNpxCache = path.join(
                process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
                'npm-cache', '_npx'
            );

            const searchDirs = [npxCacheDir, windowsNpxCache];

            for (const cacheDir of searchDirs) {
                if (fs.existsSync(cacheDir)) {
                    const found = await this.searchNpxCacheRecursive(cacheDir);
                    if (found) {
                        return found;
                    }
                }
            }
        } catch (error) {
            // npx缓存搜索失败
        }

        return null;
    }

    /**
     * 递归搜索npx缓存目录
     */
    async searchNpxCacheRecursive(cacheDir, maxDepth = 3, currentDepth = 0) {
        if (currentDepth >= maxDepth) return null;

        try {
            const entries = fs.readdirSync(cacheDir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const entryPath = path.join(cacheDir, entry.name);
                    
                    // 检查是否包含task-master-ai
                    const taskMasterPath = path.join(entryPath, 'node_modules', 'task-master-ai');
                    if (fs.existsSync(taskMasterPath) && await this.validateTaskMasterPackage(taskMasterPath)) {
                        return {
                            type: 'npx-cache',
                            path: taskMasterPath,
                            providersPath: path.join(taskMasterPath, 'src/ai-providers'),
                            source: 'npx-cache',
                            cacheHash: entry.name
                        };
                    }

                    // 递归搜索子目录
                    const found = await this.searchNpxCacheRecursive(entryPath, maxDepth, currentDepth + 1);
                    if (found) return found;
                }
            }
        } catch (error) {
            // 忽略权限错误
        }

        return null;
    }

    /**
     * 验证TaskMaster包的完整性
     */
    async validateTaskMasterPackage(packagePath) {
        try {
            const packageJsonPath = path.join(packagePath, 'package.json');
            const providersPath = path.join(packagePath, 'src/ai-providers');
            
            if (!fs.existsSync(packageJsonPath) || !fs.existsSync(providersPath)) {
                return false;
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.name === 'task-master-ai';
        } catch (error) {
            return false;
        }
    }

    /**
     * 从GitHub获取默认供应商配置（备选方案）
     */
    async getFromGitHub() {
        try {
            // 这里可以实现从GitHub API获取默认供应商列表
            // 作为无法找到本地安装时的备选方案
            return {
                type: 'github-fallback',
                path: null,
                providersPath: null,
                source: 'github-api',
                note: 'Using default providers from GitHub API'
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取供应商文件列表
     */
    async getProviderFiles(packageInfo) {
        if (!packageInfo || !packageInfo.providersPath) {
            return [];
        }

        try {
            const files = fs.readdirSync(packageInfo.providersPath);
            return files
                .filter(file => file.endsWith('.js') && file !== 'index.js' && file !== 'base-provider.js')
                .map(file => ({
                    name: file.replace('.js', ''),
                    path: path.join(packageInfo.providersPath, file)
                }));
        } catch (error) {
            return [];
        }
    }

    /**
     * 读取供应商文件内容
     */
    async readProviderFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            return null;
        }
    }
}

// 导出单例实例
export const taskMasterLocator = new TaskMasterPackageLocator();
