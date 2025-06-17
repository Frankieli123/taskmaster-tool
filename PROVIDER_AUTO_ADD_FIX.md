# UI工具供应商自动添加功能修复

## 修复内容

### 问题描述
UI工具在保存供应商时，没有自动更新所有必要的配置文件，导致需要手动添加配置。

### 遗漏的配置位置
1. **`scripts/modules/config-manager.js`**
   - keyMap中的API密钥映射
   - getMcpApiKeyStatus函数中的case语句

2. **UI工具配置文件**
   - `ui-config-tool/src/utils/configManager.js` - 默认供应商配置
   - `ui-config-tool/src/utils/ConfigTransformer.js` - 类型映射和端点配置

### 修复方案

#### 新增方法
1. **`updateConfigManagerFile(providerName)`**
   - 自动添加keyMap条目
   - 自动添加getMcpApiKeyStatus中的case语句

2. **`updateUIToolConfigs(providerName, providerConfig)`**
   - 更新UI工具的默认供应商配置
   - 更新类型映射和端点配置
   - 更新显示名称映射

#### 集成到保存流程
在`createProviderFileOnly`方法中添加了对新方法的调用，确保保存供应商时自动更新所有配置文件。

### 修复后的完整更新流程

现在保存供应商时会自动更新以下**12个位置**：

1. ✅ 创建 `src/ai-providers/{provider}.js` 文件
2. ✅ 更新 `src/ai-providers/index.js` 导出
3. ✅ 更新 `scripts/modules/ai-services-unified.js` 导入和实例
4. ✅ 更新 `scripts/modules/supported-models.json` 供应商条目
5. ✅ 更新 `.cursor/mcp.json` API密钥
6. ✅ **更新 `scripts/modules/config-manager.js` keyMap** *(新增)*
7. ✅ **更新 `scripts/modules/config-manager.js` getMcpApiKeyStatus** *(新增)*
8. ✅ **更新 `scripts/init.js` MCP配置模板** *(新增)*
9. ✅ **更新 `ui-config-tool/src/utils/configManager.js` 默认配置** *(新增)*
10. ✅ **更新 `ui-config-tool/src/utils/ConfigTransformer.js` 类型映射** *(新增)*
11. ✅ **更新 `ui-config-tool/src/utils/ConfigTransformer.js` 端点配置** *(新增)*
12. ✅ **更新 `ui-config-tool/src/utils/ConfigTransformer.js` 名称映射** *(新增)*

### 技术实现细节

#### updateConfigManagerFile方法
- 使用正则表达式精确匹配keyMap和switch语句
- 在适当位置插入新的配置条目
- 保持原有代码格式和注释

#### updateUIToolConfigs方法
- 检查是否已存在配置，避免重复添加
- 使用供应商配置信息生成准确的端点和类型映射
- 自动生成标准化的配置格式

### 测试建议

1. **删除现有供应商**
   - 使用UI工具删除Whi供应商
   - 验证所有配置都被清理

2. **重新添加供应商**
   - 通过UI工具重新添加Whi供应商
   - 验证所有12个位置都被自动更新

3. **验证功能完整性**
   - 检查TaskMaster项目是否能正常识别新供应商
   - 验证API密钥检查功能是否正常
   - 确认UI工具能正确显示供应商信息

### 预期效果

修复后，用户只需要通过UI工具添加供应商，所有相关的配置文件都会自动更新，无需手动编辑任何文件。这大大简化了供应商集成流程，提高了用户体验。

### 兼容性

- 修复不会影响现有供应商的配置
- 新方法会检查是否已存在配置，避免重复添加
- 保持所有文件的原有格式和结构
