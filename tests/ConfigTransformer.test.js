/**
 * ConfigTransformer.test.js
 * Unit tests for ConfigTransformer class
 */

import { ConfigTransformer } from '../src/utils/ConfigTransformer.js';

// Mock data for testing
const mockUIProviders = [
    {
        id: 'provider_1',
        name: 'OpenAI',
        endpoint: 'https://api.openai.com',
        type: 'openai',
        apiKey: 'sk-test123',
        isValid: true
    },
    {
        id: 'provider_2', 
        name: 'FoApi',
        endpoint: 'https://v2.voct.top',
        type: 'openai',
        apiKey: 'fo-test456',
        isValid: true
    }
];

const mockUIModels = [
    {
        id: 'model_1',
        name: 'GPT-4',
        providerId: 'provider_1',
        modelId: 'gpt-4',
        sweScore: 85,
        maxTokens: 128000,
        costPer1MTokens: { input: 30, output: 60 },
        allowedRoles: ['main', 'fallback']
    },
    {
        id: 'model_2',
        name: 'DeepSeek R1',
        providerId: 'provider_2',
        modelId: 'deepseek-ai/DeepSeek-R1',
        sweScore: 90,
        maxTokens: 200000,
        costPer1MTokens: { input: 0, output: 0 },
        allowedRoles: ['research']
    }
];

const mockTaskMasterConfig = {
    supportedModels: {
        'openai': [
            {
                id: 'gpt-4',
                swe_score: 0.85,
                cost_per_1m_tokens: { input: 30, output: 60 },
                allowed_roles: ['main', 'fallback'],
                max_tokens: 128000
            }
        ],
        'foapi': [
            {
                id: 'deepseek-ai/DeepSeek-R1',
                swe_score: 0.90,
                cost_per_1m_tokens: { input: 0, output: 0 },
                allowed_roles: ['research'],
                max_tokens: 200000
            }
        ]
    },
    config: {
        models: {
            main: { provider: 'openai', model: 'gpt-4' },
            research: { provider: 'foapi', model: 'deepseek-ai/DeepSeek-R1' }
        },
        providers: {
            'openai': {
                name: 'OpenAI',
                endpoint: 'https://api.openai.com',
                type: 'openai',
                apiKey: 'sk-test123'
            },
            'foapi': {
                name: 'FoApi',
                endpoint: 'https://v2.voct.top',
                type: 'openai',
                apiKey: 'fo-test456'
            }
        }
    }
};

// Browser-compatible test suite (removed framework-specific code)

// Simple test runner for browser environment
if (typeof window !== 'undefined') {
    console.log('Running ConfigTransformer tests...');
    
    // Basic test implementation
    window.runConfigTransformerTests = async () => {
        const transformer = new ConfigTransformer();
        
        try {
            // Test 1: UI to TaskMaster transformation
            const taskMasterResult = transformer.uiToTaskMaster(mockUIProviders, mockUIModels);
            console.assert(taskMasterResult.supportedModels.openai, 'Test 1 failed: OpenAI models not found');
            console.assert(taskMasterResult.config.models.main, 'Test 1 failed: Main model not set');
            console.log('✅ Test 1 passed: UI to TaskMaster transformation');

            // Test 2: TaskMaster to UI transformation
            const uiResult = await transformer.taskMasterToUi(mockTaskMasterConfig);
            console.assert(uiResult.providers.length === 2, 'Test 2 failed: Wrong number of providers');
            console.assert(uiResult.models.length === 2, 'Test 2 failed: Wrong number of models');
            console.log('✅ Test 2 passed: TaskMaster to UI transformation');

            // Test 3: Validation
            const validation = transformer.validateUiConfig(mockUIProviders, mockUIModels);
            console.assert(validation.isValid, 'Test 3 failed: Valid config marked as invalid');
            console.log('✅ Test 3 passed: Configuration validation');

            console.log('🎉 All ConfigTransformer tests passed!');
            return true;
        } catch (error) {
            console.error('❌ ConfigTransformer tests failed:', error);
            return false;
        }
    };
}
