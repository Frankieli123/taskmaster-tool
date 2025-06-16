# TaskMaster Tool

A modern, web-based configuration tool for managing API providers and AI models in Task Master AI projects.

## Features

- 🔌 **Provider Management**: Add, edit, and test API providers
- 🧠 **Model Configuration**: Configure AI models with detailed parameters
- ⚙️ **Configuration Export**: Export settings to Task Master format
- 📥 **Import/Export**: Backup and restore configurations
- 🎨 **Modern UI**: Responsive design with intuitive interface
- ✅ **Validation**: Built-in validation for all configurations

## Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Frankieli123/taskmaster-tool.git
cd taskmaster-tool
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## Usage

### Managing Providers

1. **Add Provider**: Click "Add Provider" to configure a new API provider
2. **Edit Provider**: Click the edit button on any provider card
3. **Test Connection**: Use the test button to verify API connectivity
4. **Delete Provider**: Remove providers you no longer need

**Supported Provider Types:**
- OpenAI Compatible (OpenAI, FoApi, etc.)
- Anthropic
- Google
- Custom

### Configuring Models

1. **Add Model**: Click "Add Model" to configure a new AI model
2. **Set Parameters**: Configure SWE score, costs, token limits
3. **Assign Roles**: Choose which roles the model can fulfill (main, fallback, research)
4. **Link to Provider**: Associate each model with a configured provider

### Configuration Management

#### Export to Task Master
- Converts your UI configuration to Task Master format
- Updates `supported-models.json` and `.taskmaster/config.json`
- Downloads files for manual integration

#### Import from Task Master
- Reads existing Task Master configuration files
- Populates the UI with current settings
- Preserves existing configurations

#### Backup & Restore
- Export configurations as JSON files
- Import previously saved configurations
- Version control for your settings

## Configuration Format

### Provider Configuration
```json
{
  "id": "provider_unique_id",
  "name": "Provider Name",
  "endpoint": "https://api.example.com",
  "type": "openai",
  "apiKey": "your-api-key",
  "isValid": true
}
```

### Model Configuration
```json
{
  "id": "model_unique_id",
  "name": "Model Display Name",
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

## API Integration

### Adding FoApi Provider

1. Click "Add Provider"
2. Fill in the details:
   - **Name**: FoApi
   - **Endpoint**: `https://v2.voct.top`
   - **Type**: OpenAI Compatible
   - **API Key**: Your FoApi API key

3. Add DeepSeek R1 model:
   - **Name**: DeepSeek R1
   - **Model ID**: `deepseek-ai/DeepSeek-R1`
   - **SWE Score**: 70%
   - **Max Tokens**: 200000
   - **Cost**: $0.14 input, $0.28 output

### Testing Connections

Use the test buttons to verify:
- Provider API connectivity
- Model availability
- Authentication status

## Development

### Project Structure
```
taskmaster-tool/
├── src/
│   ├── components/
│   │   ├── ProviderConfig.js    # Provider management
│   │   ├── ModelConfig.js       # Model configuration
│   │   └── SaveConfig.js        # Import/export functionality
│   ├── styles/
│   │   └── main.css            # Application styles
│   ├── utils/
│   │   ├── configManager.js    # Configuration management
│   │   └── validation.js       # Input validation
│   └── main.js                 # Application entry point
├── tests/                      # Test files
├── docs/                       # Documentation
├── index.html                  # Main HTML file
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Validation Rules

### Provider Validation
- Name: Required, 1-50 characters, alphanumeric + spaces/hyphens/underscores
- Endpoint: Valid HTTPS URL required
- Type: Must be one of supported types
- API Key: Format validation based on provider type

### Model Validation
- Name: Required, 1-100 characters
- Model ID: Required, 1-200 characters
- SWE Score: 0-100 if provided
- Max Tokens: Positive integer if provided
- Costs: Non-negative numbers if provided
- Roles: At least one valid role required

## Troubleshooting

### Common Issues

**Provider Test Fails**
- Verify API key is correct
- Check endpoint URL format
- Ensure network connectivity

**Models Not Appearing**
- Verify provider is configured and tested
- Check model ID format
- Ensure provider supports the model

**Export Issues**
- Check browser download permissions
- Verify Task Master project structure
- Ensure write permissions for target files

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review Task Master AI documentation
- Submit issues on [GitHub Issues](https://github.com/Frankieli123/taskmaster-tool/issues)
