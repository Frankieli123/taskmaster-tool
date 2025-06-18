/* eslint-env browser */
/* global indexedDB */
/* eslint-disable no-console */

/**
 * 目录句柄管理器 - 处理FileSystemDirectoryHandle的持久化存储和权限管理
 */
export class DirectoryHandleManager {
    constructor() {
        this.dbName = 'TaskMasterDirectoryHandles';
        this.dbVersion = 1;
        this.storeName = 'directoryHandles';
        this.db = null;
    }

    /**
     * 初始化IndexedDB
     */
    async initDB() {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建对象存储
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * 保存目录句柄到IndexedDB
     * @param {string} key - 存储键名
     * @param {FileSystemDirectoryHandle} directoryHandle - 目录句柄
     * @param {object} metadata - 额外的元数据
     */
    async saveDirectoryHandle(key, directoryHandle, metadata = {}) {
        try {
            await this.initDB();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const data = {
                key,
                handle: directoryHandle,
                metadata: {
                    ...metadata,
                    name: directoryHandle.name,
                    timestamp: Date.now()
                }
            };

            await new Promise((resolve, reject) => {
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`✅ 目录句柄已保存到IndexedDB: ${key} (${directoryHandle.name})`);
            return true;
        } catch (error) {
            console.error('❌ 保存目录句柄失败:', error);
            return false;
        }
    }

    /**
     * 从IndexedDB恢复目录句柄
     * @param {string} key - 存储键名
     * @returns {Promise<{handle: FileSystemDirectoryHandle, metadata: object}|null>}
     */
    async restoreDirectoryHandle(key) {
        try {
            await this.initDB();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const data = await new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (!data) {
                console.log(`📁 未找到保存的目录句柄: ${key}`);
                return null;
            }

            console.log(`📁 从IndexedDB恢复目录句柄: ${key} (${data.metadata.name})`);
            return {
                handle: data.handle,
                metadata: data.metadata
            };
        } catch (error) {
            console.error('❌ 恢复目录句柄失败:', error);
            return null;
        }
    }

    /**
     * 检查并请求目录句柄权限
     * @param {FileSystemDirectoryHandle} directoryHandle - 目录句柄
     * @param {string} mode - 权限模式 ('read' | 'readwrite')
     * @returns {Promise<boolean>} 是否获得权限
     */
    async requestPermission(directoryHandle, mode = 'readwrite') {
        try {
            // 检查当前权限状态
            const permission = await directoryHandle.queryPermission({ mode });
            
            if (permission === 'granted') {
                console.log(`✅ 目录权限已授予: ${directoryHandle.name} (${mode})`);
                return true;
            }

            // 请求权限
            console.log(`🔐 请求目录权限: ${directoryHandle.name} (${mode})`);
            const requestPermission = await directoryHandle.requestPermission({ mode });
            
            if (requestPermission === 'granted') {
                console.log(`✅ 目录权限请求成功: ${directoryHandle.name} (${mode})`);
                return true;
            } else {
                console.log(`❌ 目录权限请求被拒绝: ${directoryHandle.name} (${mode})`);
                return false;
            }
        } catch (error) {
            console.error('❌ 权限检查失败:', error);
            return false;
        }
    }

    /**
     * 尝试恢复目录句柄并检查权限
     * @param {string} key - 存储键名
     * @param {string} mode - 权限模式
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    async restoreWithPermission(key, mode = 'readwrite') {
        try {
            const restored = await this.restoreDirectoryHandle(key);
            if (!restored) {
                return null;
            }

            const hasPermission = await this.requestPermission(restored.handle, mode);
            if (hasPermission) {
                console.log(`🎉 目录句柄恢复成功: ${restored.metadata.name}`);
                return restored.handle;
            } else {
                console.log(`⚠️ 目录权限恢复失败，需要重新选择: ${restored.metadata.name}`);
                // 权限失败时清除无效的句柄
                await this.removeDirectoryHandle(key);
                return null;
            }
        } catch (error) {
            console.error('❌ 目录句柄恢复失败:', error);
            return null;
        }
    }

    /**
     * 删除保存的目录句柄
     * @param {string} key - 存储键名
     */
    async removeDirectoryHandle(key) {
        try {
            await this.initDB();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            await new Promise((resolve, reject) => {
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log(`🗑️ 已删除目录句柄: ${key}`);
        } catch (error) {
            console.error('❌ 删除目录句柄失败:', error);
        }
    }

    /**
     * 列出所有保存的目录句柄
     */
    async listDirectoryHandles() {
        try {
            await this.initDB();

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const handles = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            return handles.map(item => ({
                key: item.key,
                metadata: item.metadata
            }));
        } catch (error) {
            console.error('❌ 列出目录句柄失败:', error);
            return [];
        }
    }

    /**
     * 清理所有保存的目录句柄
     */
    async clearAll() {
        try {
            await this.initDB();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            console.log('🧹 已清理所有目录句柄');
        } catch (error) {
            console.error('❌ 清理目录句柄失败:', error);
        }
    }
}
