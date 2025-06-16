/**
 * Vitest setup file
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock browser APIs that might not be available in test environment
global.fetch = vi.fn();
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

global.sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

// Mock File System Access API
global.showDirectoryPicker = vi.fn();
global.showOpenFilePicker = vi.fn();
global.showSaveFilePicker = vi.fn();

// Mock URL and URLSearchParams
global.URL = {
  createObjectURL: vi.fn(() => 'mock-url'),
  revokeObjectURL: vi.fn()
};

// Mock crypto for ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-1234'),
    getRandomValues: vi.fn(arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  },
  writable: true
});

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now())
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Enhanced DOM mocking
Object.defineProperty(global.document, 'getElementById', {
  value: vi.fn(() => ({
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn()
    },
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    innerHTML: '',
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })),
  writable: true
});

Object.defineProperty(global.document, 'body', {
  value: {
    innerHTML: '',
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  },
  writable: true
});

Object.defineProperty(global.document, 'head', {
  value: {
    innerHTML: '',
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  writable: true
});

// Setup DOM environment
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Reset DOM safely
  if (document.body) {
    document.body.innerHTML = '';
  }
  if (document.head) {
    document.head.innerHTML = '';
  }

  // Reset localStorage and sessionStorage
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});
