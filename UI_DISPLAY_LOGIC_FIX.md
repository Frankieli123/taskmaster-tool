# UI工具显示逻辑修复

## 问题描述

之前的实现中，UI工具会显示预设的默认供应商配置，这不符合预期。UI工具应该只显示实际导入/加载的供应商，而不是显示代码中的默认配置。

## 修复原则

### ✅ 正确的显示逻辑
- **只显示实际导入的供应商** - 从TaskMaster项目导入或用户手动添加的供应商
- **空状态显示空列表** - 没有导入配置时应该显示空的供应商列表
- **默认配置不影响显示** - 代码中的默认配置只作为模板，不应该显示给用户

### ❌ 错误的显示逻辑
- 显示预设的默认供应商列表
- 自动加载代码中的默认配置到UI
- 混合显示默认配置和实际配置

## 修复内容

### 1. 移除不必要的默认配置更新

**修改前：**
```javascript
// updateUIToolConfigs 方法会更新 configManager.js 的默认配置
async updateUIToolConfigs(providerName, providerConfig) {
    // 1. 更新UI工具的configManager.js - ❌ 不应该这样做
    // 2. 更新UI工具的ConfigTransformer.js - ✅ 这是必要的
}
```

**修改后：**
```javascript
// 只更新必要的映射配置，不更新默认配置
async updateUIToolConfigs(providerName, providerConfig) {
    // 只更新ConfigTransformer.js的映射配置（用于数据转换）
    // 不更新默认供应商配置，因为UI应该只显示实际导入的供应商
}
```

### 2. 清理已添加的默认配置

从 `configManager.js` 中移除了之前错误添加的 whi 默认配置：

```javascript
// 移除了这个配置
{
    id: 'provider_whi_default',
    name: 'Whi',
    endpoint: 'https://doi9.top',
    type: 'openai',
    apiKey: '',
    isValid: false
}
```

### 3. 保留必要的功能

**保留的更新：**
- ✅ `ConfigTransformer.js` 的类型映射 - 用于数据转换
- ✅ `ConfigTransformer.js` 的端点映射 - 用于自动填充
- ✅ `ConfigTransformer.js` 的名称映射 - 用于显示转换

**移除的更新：**
- ❌ `configManager.js` 的默认供应商配置 - 不应该影响显示

## 配置文件的正确用途

### configManager.js
- **默认配置的作用**: 仅作为代码模板和参考，不影响UI显示
- **loadDefaultProviders()**: 仅在特殊情况下使用，正常情况下不调用
- **显示数据来源**: localStorage中的实际配置数据

### ConfigTransformer.js
- **类型映射**: 将供应商名称映射到API类型（openai、anthropic等）
- **端点映射**: 提供默认的API端点地址
- **名称映射**: 将内部标识符转换为显示名称
- **用途**: 数据转换和自动填充，不影响显示逻辑

## 修复后的工作流程

### 添加供应商时
1. ✅ 创建TaskMaster项目文件
2. ✅ 更新TaskMaster配置文件
3. ✅ 更新ConfigTransformer.js映射（用于数据转换）
4. ❌ ~~更新configManager.js默认配置~~（已移除）

### 删除供应商时
1. ✅ 删除TaskMaster项目文件
2. ✅ 清理TaskMaster配置文件
3. ✅ 清理ConfigTransformer.js映射
4. ❌ ~~清理configManager.js默认配置~~（已移除）

### UI显示逻辑
1. ✅ 只显示localStorage中的实际配置
2. ✅ 空状态时显示空列表
3. ✅ 导入TaskMaster配置时显示导入的供应商
4. ❌ ~~显示代码中的默认配置~~（已修复）

## 验证方法

1. **清空配置测试**
   - 清空localStorage
   - 刷新UI工具
   - 应该显示空的供应商列表

2. **导入配置测试**
   - 从TaskMaster项目导入配置
   - 应该只显示实际存在的供应商

3. **添加供应商测试**
   - 手动添加新供应商
   - 应该在列表中显示新添加的供应商
   - 不应该显示其他预设的供应商

## 总结

修复后的UI工具现在遵循正确的显示逻辑：
- **实际性**: 只显示实际存在的配置
- **一致性**: UI显示与实际配置保持一致
- **简洁性**: 不显示无关的默认配置
- **功能性**: 保留必要的数据转换功能

这确保了用户看到的就是实际配置的内容，避免了混淆和误解。
