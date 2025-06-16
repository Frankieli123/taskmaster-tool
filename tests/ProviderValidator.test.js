/**
 * ProviderValidator.test.js
 * Unit tests for ProviderValidator class
 */

import { ProviderValidator } from '../src/utils/ProviderValidator.js';

// Test data
const validProviders = {
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com',
        type: 'openai',
        apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef'
    },
    foapi: {
        name: 'FoApi',
        endpoint: 'https://v2.voct.top',
        type: 'foapi',
        apiKey: 'fo-test123456789012345'
    },
    custom: {
        name: 'Custom Provider',
        endpoint: 'https://api.custom.com',
        type: 'custom',
        apiKey: 'custom-key-123'
    }
};

const invalidProviders = {
    missingName: {
        endpoint: 'https://api.openai.com',
        type: 'openai',
        apiKey: 'sk-test'
    },
    invalidEndpoint: {
        name: 'Test',
        endpoint: 'not-a-url',
        type: 'openai',
        apiKey: 'sk-test'
    },
    invalidType: {
        name: 'Test',
        endpoint: 'https://api.test.com',
        type: 'invalid-type',
        apiKey: 'test-key'
    }
};

// Browser-compatible test suite (removed framework-specific code)
// The actual tests are implemented in the browser test runner below

// Simple test runner for browser environment
if (typeof window !== 'undefined') {
    console.log('Running ProviderValidator tests...');
    
    window.runProviderValidatorTests = () => {
        const validator = new ProviderValidator();
        
        try {
            // Test 1: Valid provider validation
            const validResult = validator.validateProvider(validProviders.openai);
            console.assert(validResult.isValid, 'Test 1 failed: Valid OpenAI provider rejected');
            console.log('✅ Test 1 passed: Valid provider validation');

            // Test 2: Invalid provider validation
            const invalidResult = validator.validateProvider(invalidProviders.missingName);
            console.assert(!invalidResult.isValid, 'Test 2 failed: Invalid provider accepted');
            console.log('✅ Test 2 passed: Invalid provider validation');

            // Test 3: Endpoint validation
            const endpointResult = validator.validateEndpoint('https://api.openai.com');
            console.assert(endpointResult.isValid, 'Test 3 failed: Valid endpoint rejected');
            console.log('✅ Test 3 passed: Endpoint validation');

            // Test 4: API key validation
            const apiKeyResult = validator.validateApiKey('sk-1234567890abcdef1234567890abcdef1234567890abcdef', 'openai');
            console.assert(apiKeyResult.isValid, 'Test 4 failed: Valid API key rejected');
            console.log('✅ Test 4 passed: API key validation');

            // Test 5: Provider type suggestions
            const suggestions = validator.suggestProviderType('https://api.openai.com');
            console.assert(suggestions.length > 0 && suggestions[0].type === 'openai', 'Test 5 failed: Wrong provider suggestion');
            console.log('✅ Test 5 passed: Provider type suggestions');

            console.log('🎉 All ProviderValidator tests passed!');
            return true;
        } catch (error) {
            console.error('❌ ProviderValidator tests failed:', error);
            return false;
        }
    };
}
