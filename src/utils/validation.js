/**
 * validation.js
 * Validation utilities for provider and model configurations
 */

export class Validation {
    constructor() {
        this.validProviderTypes = ['openai', 'anthropic', 'google', 'custom'];
        this.validRoles = ['main', 'fallback', 'research'];
    }

    validateProvider(provider) {
        const errors = [];

        // Required fields
        if (!provider.name || typeof provider.name !== 'string' || provider.name.trim().length === 0) {
            errors.push('Provider name is required');
        }

        if (!provider.endpoint || typeof provider.endpoint !== 'string') {
            errors.push('Provider endpoint is required');
        } else if (!this.isValidUrl(provider.endpoint)) {
            errors.push('Provider endpoint must be a valid URL');
        }

        if (!provider.type || !this.validProviderTypes.includes(provider.type)) {
            errors.push(`Provider type must be one of: ${this.validProviderTypes.join(', ')}`);
        }

        // Optional but validated fields
        if (provider.apiKey && typeof provider.apiKey !== 'string') {
            errors.push('API key must be a string');
        }

        // Name length validation
        if (provider.name && provider.name.length > 50) {
            errors.push('Provider name must be 50 characters or less');
        }

        // Name format validation (alphanumeric, spaces, hyphens, underscores)
        if (provider.name && !/^[a-zA-Z0-9\s\-_]+$/.test(provider.name)) {
            errors.push('Provider name can only contain letters, numbers, spaces, hyphens, and underscores');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateModel(model) {
        const errors = [];

        // Required fields
        if (!model.name || typeof model.name !== 'string' || model.name.trim().length === 0) {
            errors.push('Model name is required');
        }

        if (!model.modelId || typeof model.modelId !== 'string' || model.modelId.trim().length === 0) {
            errors.push('Model ID is required');
        }

        if (!model.providerId || typeof model.providerId !== 'string') {
            errors.push('Provider ID is required');
        }

        // Optional but validated fields
        if (model.sweScore !== null && model.sweScore !== undefined) {
            if (typeof model.sweScore !== 'number' || model.sweScore < 0 || model.sweScore > 100) {
                errors.push('SWE Score must be a number between 0 and 100');
            }
        }

        if (model.maxTokens !== null && model.maxTokens !== undefined) {
            if (!Number.isInteger(model.maxTokens) || model.maxTokens < 1) {
                errors.push('Max tokens must be a positive integer');
            }
        }

        // Cost validation
        if (model.costPer1MTokens) {
            if (typeof model.costPer1MTokens !== 'object') {
                errors.push('Cost per 1M tokens must be an object');
            } else {
                if (model.costPer1MTokens.input !== null && model.costPer1MTokens.input !== undefined) {
                    if (typeof model.costPer1MTokens.input !== 'number' || model.costPer1MTokens.input < 0) {
                        errors.push('Input cost must be a non-negative number');
                    }
                }
                if (model.costPer1MTokens.output !== null && model.costPer1MTokens.output !== undefined) {
                    if (typeof model.costPer1MTokens.output !== 'number' || model.costPer1MTokens.output < 0) {
                        errors.push('Output cost must be a non-negative number');
                    }
                }
            }
        }

        // Allowed roles validation
        if (model.allowedRoles) {
            if (!Array.isArray(model.allowedRoles)) {
                errors.push('Allowed roles must be an array');
            } else {
                const invalidRoles = model.allowedRoles.filter(role => !this.validRoles.includes(role));
                if (invalidRoles.length > 0) {
                    errors.push(`Invalid roles: ${invalidRoles.join(', ')}. Valid roles are: ${this.validRoles.join(', ')}`);
                }
                if (model.allowedRoles.length === 0) {
                    errors.push('At least one role must be specified');
                }
            }
        }

        // Name length validation
        if (model.name && model.name.length > 100) {
            errors.push('Model name must be 100 characters or less');
        }

        // Model ID format validation
        if (model.modelId && model.modelId.length > 200) {
            errors.push('Model ID must be 200 characters or less');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateConfiguration(config) {
        const errors = [];

        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
            return { isValid: false, errors: errors };
        }

        // Validate providers
        if (!config.providers || !Array.isArray(config.providers)) {
            errors.push('Configuration must include a providers array');
        } else {
            config.providers.forEach((provider, index) => {
                const providerValidation = this.validateProvider(provider);
                if (!providerValidation.isValid) {
                    errors.push(`Provider ${index + 1}: ${providerValidation.errors.join(', ')}`);
                }
            });

            // Check for duplicate provider names
            const providerNames = config.providers.map(p => p.name.toLowerCase());
            const duplicateNames = providerNames.filter((name, index) => providerNames.indexOf(name) !== index);
            if (duplicateNames.length > 0) {
                errors.push(`Duplicate provider names: ${[...new Set(duplicateNames)].join(', ')}`);
            }
        }

        // Validate models
        if (!config.models || !Array.isArray(config.models)) {
            errors.push('Configuration must include a models array');
        } else {
            config.models.forEach((model, index) => {
                const modelValidation = this.validateModel(model);
                if (!modelValidation.isValid) {
                    errors.push(`Model ${index + 1}: ${modelValidation.errors.join(', ')}`);
                }
            });

            // Check for orphaned models (models without valid providers)
            if (config.providers && Array.isArray(config.providers)) {
                const providerIds = config.providers.map(p => p.id);
                const orphanedModels = config.models.filter(m => !providerIds.includes(m.providerId));
                if (orphanedModels.length > 0) {
                    errors.push(`Models reference non-existent providers: ${orphanedModels.map(m => m.name).join(', ')}`);
                }
            }

            // Check for duplicate model IDs within the same provider
            const modelGroups = {};
            config.models.forEach(model => {
                if (!modelGroups[model.providerId]) {
                    modelGroups[model.providerId] = [];
                }
                modelGroups[model.providerId].push(model.modelId);
            });

            Object.keys(modelGroups).forEach(providerId => {
                const modelIds = modelGroups[providerId];
                const duplicateIds = modelIds.filter((id, index) => modelIds.indexOf(id) !== index);
                if (duplicateIds.length > 0) {
                    errors.push(`Duplicate model IDs in provider ${providerId}: ${[...new Set(duplicateIds)].join(', ')}`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateApiKey(apiKey, providerType) {
        const errors = [];

        if (!apiKey || typeof apiKey !== 'string') {
            errors.push('API key is required');
            return { isValid: false, errors: errors };
        }

        // Basic format validation based on provider type
        switch (providerType) {
            case 'openai':
                if (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-')) {
                    errors.push('OpenAI API key should start with "sk-" or "sk-proj-"');
                }
                if (apiKey.length < 20) {
                    errors.push('OpenAI API key appears to be too short');
                }
                break;

            case 'anthropic':
                if (!apiKey.startsWith('sk-ant-')) {
                    errors.push('Anthropic API key should start with "sk-ant-"');
                }
                break;

            case 'google':
                if (apiKey.length < 20) {
                    errors.push('Google API key appears to be too short');
                }
                break;

            case 'custom':
                // No specific validation for custom providers
                break;

            default:
                // Generic validation
                if (apiKey.length < 10) {
                    errors.push('API key appears to be too short');
                }
                break;
        }

        // Check for common issues
        if (apiKey.includes(' ')) {
            errors.push('API key should not contain spaces');
        }

        if (apiKey.toLowerCase().includes('your_api_key') || apiKey.toLowerCase().includes('placeholder')) {
            errors.push('API key appears to be a placeholder value');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateEndpoint(endpoint) {
        const errors = [];

        if (!endpoint || typeof endpoint !== 'string') {
            errors.push('Endpoint is required');
            return { isValid: false, errors: errors };
        }

        if (!this.isValidUrl(endpoint)) {
            errors.push('Endpoint must be a valid URL');
        }

        if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://')) {
            errors.push('Endpoint must use HTTP or HTTPS protocol');
        }

        // Warn about HTTP (not HTTPS) for security
        if (endpoint.startsWith('http://') && !endpoint.includes('localhost') && !endpoint.includes('127.0.0.1')) {
            errors.push('Consider using HTTPS for security (HTTP detected)');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Remove potentially dangerous characters
        return input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }

    formatValidationErrors(validationResult) {
        if (validationResult.isValid) {
            return 'Valid';
        }

        return validationResult.errors.map(error => `• ${error}`).join('\n');
    }
}
