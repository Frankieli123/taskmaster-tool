# TaskMaster 配置工具

[English](README.md) | [中文](README_CN.md)

一个现代化的基于Web的配置工具，用于管理Task Master AI项目中的API提供商和AI模型。

## 功能特性

- 🔌 **提供商管理**：添加、编辑和测试API提供商
- 🧠 **模型配置**：配置AI模型的详细参数
- ⚙️ **配置导出**：将设置导出为Task Master格式
- 📥 **导入/导出**：备份和恢复配置
- 🎨 **现代UI**：响应式设计，直观的界面
- ✅ **验证功能**：内置的配置验证

## 快速开始

### 前置要求

- Node.js 16+ 
- npm 或 yarn

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/Frankieli123/taskmaster-tool.git
cd taskmaster-tool
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

4. 在浏览器中打开 `http://localhost:8080`

## 使用说明

### 管理提供商

1. **添加提供商**：点击"添加提供商"配置新的API提供商
2. **编辑提供商**：点击提供商卡片上的编辑按钮
3. **测试连接**：使用测试按钮验证API连接
4. **删除提供商**：删除不再需要的提供商

**支持的提供商类型：**
- OpenAI兼容（OpenAI、FoApi等）
- Anthropic
- Google
- 自定义

### 配置模型

1. **添加模型**：点击"添加模型"配置新的AI模型
2. **设置参数**：配置SWE评分、成本、令牌限制
3. **分配角色**：选择模型可以承担的角色（主要、备用、研究）
4. **关联提供商**：将每个模型与配置的提供商关联

### 配置管理

#### 导出到Task Master
- 将UI配置转换为Task Master格式
- 更新 `supported-models.json` 和 `.taskmaster/config.json`
- 下载文件进行手动集成

#### 从Task Master导入
- 读取现有的Task Master配置文件
- 用当前设置填充UI
- 保留现有配置

#### 备份和恢复
- 将配置导出为JSON文件
- 导入之前保存的配置
- 设置的版本控制

## 配置格式

### 提供商配置
```json
{
  "id": "provider_unique_id",
  "name": "提供商名称",
  "endpoint": "https://api.example.com",
  "type": "openai",
  "apiKey": "your-api-key",
  "isValid": true
}
```

### 模型配置
```json
{
  "id": "model_unique_id",
  "name": "模型显示名称",
  "providerId": "provider_unique_id",
  "modelId": "actual-model-id",
  "sweScore": 70.0,
  "maxTokens": 200000,
  "costPer1MTokens": {
    "input": 0.14,
    "output": 0.28
  },
  "allowedRoles": ["main", "fallback", "research"]
}
```

## API集成

### 添加FoApi提供商

1. 点击"添加提供商"
2. 填写详细信息：
   - **名称**：FoApi
   - **端点**：`https://v2.voct.top`
   - **类型**：OpenAI兼容
   - **API密钥**：您的FoApi API密钥

3. 添加DeepSeek R1模型：
   - **名称**：DeepSeek R1
   - **模型ID**：`deepseek-ai/DeepSeek-R1`
   - **SWE评分**：70%
   - **最大令牌**：200000
   - **成本**：输入$0.14，输出$0.28

### 测试连接

使用测试按钮验证：
- 提供商API连接
- 模型可用性
- 认证状态

## 开发

### 项目结构
```
taskmaster-tool/
├── src/
│   ├── components/
│   │   ├── ProviderConfig.js    # 提供商管理
│   │   ├── ModelConfig.js       # 模型配置
│   │   └── SaveConfig.js        # 导入/导出功能
│   ├── styles/
│   │   └── main.css            # 应用样式
│   ├── utils/
│   │   ├── configManager.js    # 配置管理
│   │   └── validation.js       # 输入验证
│   └── main.js                 # 应用入口点
├── tests/                      # 测试文件
├── docs/                       # 文档
├── index.html                  # 主HTML文件
├── package.json               # 依赖和脚本
└── README.md                  # 此文件
```

### 生产构建

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 验证规则

### 提供商验证
- 名称：必需，1-50个字符，字母数字+空格/连字符/下划线
- 端点：需要有效的HTTPS URL
- 类型：必须是支持的类型之一
- API密钥：基于提供商类型的格式验证

### 模型验证
- 名称：必需，1-100个字符
- 模型ID：必需，1-200个字符
- SWE评分：如果提供，0-100
- 最大令牌：如果提供，正整数
- 成本：如果提供，非负数
- 角色：至少需要一个有效角色

## 故障排除

### 常见问题

**提供商测试失败**
- 验证API密钥是否正确
- 检查端点URL格式
- 确保网络连接

**模型未显示**
- 验证提供商已配置并测试
- 检查模型ID格式
- 确保提供商支持该模型

**导出问题**
- 检查浏览器下载权限
- 验证Task Master项目结构
- 确保目标文件的写入权限

### 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 贡献

1. Fork仓库
2. 创建功能分支
3. 进行更改
4. 彻底测试
5. 提交拉取请求

详细指南请参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT许可证 - 详见LICENSE文件

## 支持

如有问题和疑问：
- 查看故障排除部分
- 查阅Task Master AI文档
- 在 [GitHub Issues](https://github.com/Frankieli123/taskmaster-tool/issues) 提交问题
