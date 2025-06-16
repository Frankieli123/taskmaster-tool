# 供应商删除功能测试指南

## 功能概述
UI工具现在支持完整的供应商删除功能，可以删除供应商在TaskMaster项目中的所有相关文件和配置。

## 删除内容清单
当删除一个供应商时，系统会自动清理以下内容：

### UI配置
- ✅ localStorage中的供应商配置
- ✅ localStorage中该供应商的所有模型

### TaskMaster项目文件
- ✅ `scripts/modules/supported-models.json` - 删除供应商的模型条目
- ✅ `.cursor/mcp.json` - 删除供应商的API密钥
- ✅ `src/ai-providers/{provider}.js` - 删除供应商的JavaScript文件
- ✅ `src/ai-providers/index.js` - 删除供应商的导出语句
- ✅ `scripts/modules/ai-services-unified.js` - 删除供应商的导入和实例
- ✅ `scripts/modules/config-manager.js` - 删除keyMap和getMcpApiKeyStatus中的条目

### UI工具配置文件
- ✅ `ui-config-tool/src/utils/configManager.js` - 删除默认供应商配置
- ✅ `ui-config-tool/src/utils/ConfigTransformer.js` - 删除类型映射和端点配置

### 安全检查
- ✅ 检查`.taskmaster/config.json`中是否有配置正在使用该供应商
- ✅ 如果有使用，会显示警告信息

## 测试步骤

### 1. 准备测试环境
1. 确保UI工具正在运行 (http://localhost:8080)
2. 选择有效的TaskMaster项目路径
3. 确保项目中有测试用的供应商

### 2. 测试删除功能
1. 进入"供应商配置"页面
2. 找到要删除的供应商
3. 点击"删除"按钮
4. 查看确认对话框中的详细信息
5. 确认删除操作

### 3. 验证删除结果
1. 检查UI中供应商是否已消失
2. 检查TaskMaster项目文件是否已更新
3. 查看操作日志确认删除详情

## 预期行为

### 成功删除
- 显示详细的删除结果，包括删除的文件和更新的文件
- UI中供应商和相关模型消失
- TaskMaster项目文件正确更新

### 配置冲突警告
- 如果供应商正在被配置使用，会显示警告
- 用户可以选择继续删除或取消操作
- 删除后会提醒用户更新配置

### 错误处理
- 如果某个文件删除失败，会显示具体错误信息
- 部分成功的操作会显示详细的成功/失败状态
- 不会因为单个文件失败而阻止整个删除流程

## 注意事项
1. 删除操作不可撤销，请谨慎操作
2. 建议在删除前备份重要配置
3. 如果供应商正在被使用，建议先更改配置再删除
4. 删除后需要重启TaskMaster服务以使更改生效

## 故障排除
如果删除过程中遇到问题：
1. 检查浏览器控制台的错误信息
2. 查看UI工具的日志输出
3. 确认TaskMaster项目路径的访问权限
4. 手动检查相关文件是否已正确删除/更新
