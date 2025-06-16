/**
 * API集成和兼容性自动化测试脚本
 * 在浏览器控制台中运行此脚本来执行API集成测试
 */

class APIIntegrationTester {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
    this.networkRequests = [];
    this.originalFetch = window.fetch;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    if (this.currentTest) {
      this.currentTest.logs = this.currentTest.logs || [];
      this.currentTest.logs.push(logMessage);
    }
  }

  startTest(testId, description) {
    this.currentTest = {
      id: testId,
      description,
      startTime: Date.now(),
      status: 'running',
      logs: [],
      networkRequests: []
    };
    this.log(`开始测试: ${testId} - ${description}`, 'test');
  }

  endTest(status, message = '') {
    if (!this.currentTest) return;
    
    this.currentTest.endTime = Date.now();
    this.currentTest.duration = this.currentTest.endTime - this.currentTest.startTime;
    this.currentTest.status = status;
    this.currentTest.message = message;
    
    this.log(`测试结束: ${this.currentTest.id} - ${status} (${this.currentTest.duration}ms)`, 'test');
    if (message) this.log(message, status === 'pass' ? 'success' : 'error');
    
    this.testResults.push({ ...this.currentTest });
    this.currentTest = null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 设置网络请求监控
  setupNetworkMonitoring() {
    const self = this;
    window.fetch = async function(...args) {
      const startTime = Date.now();
      const [url, options] = args;
      
      self.log(`网络请求: ${options?.method || 'GET'} ${url}`);
      
      try {
        const response = await self.originalFetch.apply(this, args);
        const duration = Date.now() - startTime;
        
        const requestInfo = {
          url,
          method: options?.method || 'GET',
          status: response.status,
          duration,
          success: response.ok,
          timestamp: new Date().toISOString()
        };
        
        self.networkRequests.push(requestInfo);
        if (self.currentTest) {
          self.currentTest.networkRequests.push(requestInfo);
        }
        
        self.log(`网络响应: ${response.status} (${duration}ms)`);
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        const requestInfo = {
          url,
          method: options?.method || 'GET',
          error: error.message,
          duration,
          success: false,
          timestamp: new Date().toISOString()
        };
        
        self.networkRequests.push(requestInfo);
        if (self.currentTest) {
          self.currentTest.networkRequests.push(requestInfo);
        }
        
        self.log(`网络错误: ${error.message} (${duration}ms)`, 'error');
        throw error;
      }
    };
  }

  // 恢复原始fetch
  restoreNetworkMonitoring() {
    window.fetch = this.originalFetch;
  }

  // 检测浏览器兼容性
  async testBrowserCompatibility() {
    this.startTest('TC_BROWSER', '浏览器兼容性检测');
    
    try {
      const userAgent = navigator.userAgent;
      const isChrome = userAgent.includes('Chrome');
      const isEdge = userAgent.includes('Edg');
      const isFirefox = userAgent.includes('Firefox');
      const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
      
      this.log(`浏览器: ${isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : '未知'}`);
      
      // 检测Fetch API支持
      const hasFetch = typeof fetch !== 'undefined';
      this.log(`Fetch API支持: ${hasFetch ? '是' : '否'}`);
      
      // 检测Promise支持
      const hasPromise = typeof Promise !== 'undefined';
      this.log(`Promise支持: ${hasPromise ? '是' : '否'}`);
      
      // 检测async/await支持
      let hasAsyncAwait = false;
      try {
        eval('(async function() {})');
        hasAsyncAwait = true;
      } catch (e) {
        hasAsyncAwait = false;
      }
      this.log(`Async/Await支持: ${hasAsyncAwait ? '是' : '否'}`);
      
      if (hasFetch && hasPromise && hasAsyncAwait) {
        this.endTest('pass', '浏览器兼容性良好');
      } else {
        this.endTest('fail', '浏览器兼容性不足');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试ProviderValidator可用性
  async testProviderValidatorAvailability() {
    this.startTest('TC_VALIDATOR', 'ProviderValidator可用性测试');
    
    try {
      // 检查ProviderValidator是否可用
      if (window.app && window.app.providerConfig && window.app.providerConfig.validator) {
        const validator = window.app.providerConfig.validator;
        this.log('找到ProviderValidator实例');
        
        // 检查关键方法
        const hasTestMethod = typeof validator.testProviderConnection === 'function';
        const hasValidateMethod = typeof validator.validateProvider === 'function';
        
        this.log(`testProviderConnection方法: ${hasTestMethod ? '存在' : '缺失'}`);
        this.log(`validateProvider方法: ${hasValidateMethod ? '存在' : '缺失'}`);
        
        if (hasTestMethod && hasValidateMethod) {
          this.endTest('pass', 'ProviderValidator功能完整');
        } else {
          this.endTest('fail', 'ProviderValidator方法缺失');
        }
      } else {
        this.endTest('fail', '无法访问ProviderValidator');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试API连接功能
  async testAPIConnectionFeature() {
    this.startTest('TC_API_CONN', 'API连接功能测试');
    
    try {
      // 查找测试连接按钮
      const testButtons = document.querySelectorAll('.test-btn, .test-connection-btn, [data-action="test"]');
      this.log(`找到${testButtons.length}个测试连接按钮`);
      
      if (testButtons.length > 0) {
        // 点击第一个测试按钮
        const firstButton = testButtons[0];
        this.log('点击测试连接按钮');
        
        // 监控网络请求
        this.setupNetworkMonitoring();
        
        firstButton.click();
        
        // 等待API调用完成
        await this.sleep(5000);
        
        this.restoreNetworkMonitoring();
        
        // 检查是否有网络请求
        const apiRequests = this.currentTest.networkRequests.filter(req => 
          req.url.includes('/v1/') || 
          req.url.includes('api.') ||
          req.url.includes('openai') ||
          req.url.includes('anthropic') ||
          req.url.includes('google')
        );
        
        this.log(`检测到${apiRequests.length}个API请求`);
        
        if (apiRequests.length > 0) {
          const successfulRequests = apiRequests.filter(req => req.success);
          this.log(`成功的API请求: ${successfulRequests.length}/${apiRequests.length}`);
          this.endTest('pass', `API连接功能正常 (${successfulRequests.length}个成功请求)`);
        } else {
          this.endTest('fail', '未检测到API请求');
        }
      } else {
        this.endTest('fail', '未找到测试连接按钮');
      }
      
    } catch (error) {
      this.restoreNetworkMonitoring();
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试错误处理机制
  async testErrorHandling() {
    this.startTest('TC_ERROR_HANDLING', '错误处理机制测试');
    
    try {
      // 模拟网络错误
      const originalFetch = window.fetch;
      let errorCount = 0;
      
      window.fetch = async function(...args) {
        errorCount++;
        if (errorCount === 1) {
          throw new Error('模拟网络错误');
        }
        return originalFetch.apply(this, args);
      };
      
      // 尝试执行API测试
      if (window.app && window.app.providerConfig && window.app.providerConfig.validator) {
        try {
          const testProvider = {
            name: 'Test Provider',
            type: 'openai',
            endpoint: 'https://api.openai.com',
            apiKey: 'test-key'
          };
          
          const result = await window.app.providerConfig.validator.testProviderConnection(testProvider);
          this.log(`错误处理结果: ${result.isValid ? '成功' : '失败'}`);
          
          if (!result.isValid && result.errors && result.errors.length > 0) {
            this.log(`错误消息: ${result.errors[0]}`);
            this.endTest('pass', '错误处理机制正常');
          } else {
            this.endTest('fail', '错误处理机制异常');
          }
        } catch (error) {
          this.log(`捕获到错误: ${error.message}`);
          this.endTest('pass', '错误处理机制正常');
        }
      } else {
        this.endTest('skip', '无法访问ProviderValidator，跳过测试');
      }
      
      // 恢复原始fetch
      window.fetch = originalFetch;
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试超时处理
  async testTimeoutHandling() {
    this.startTest('TC_TIMEOUT', '超时处理测试');
    
    try {
      // 检查fetch请求是否有超时设置
      const originalFetch = window.fetch;
      let hasTimeoutConfig = false;
      
      window.fetch = async function(url, options) {
        if (options && (options.timeout || options.signal)) {
          hasTimeoutConfig = true;
        }
        return originalFetch.apply(this, arguments);
      };
      
      // 触发一个API测试
      const testButtons = document.querySelectorAll('.test-btn, .test-connection-btn');
      if (testButtons.length > 0) {
        testButtons[0].click();
        await this.sleep(2000);
      }
      
      window.fetch = originalFetch;
      
      if (hasTimeoutConfig) {
        this.endTest('pass', '检测到超时配置');
      } else {
        this.endTest('fail', '未检测到超时配置');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试CORS处理
  async testCORSHandling() {
    this.startTest('TC_CORS', 'CORS处理测试');
    
    try {
      // 尝试跨域请求
      try {
        const response = await fetch('https://httpbin.org/get', {
          method: 'GET',
          mode: 'cors'
        });
        
        if (response.ok) {
          this.log('跨域请求成功');
          this.endTest('pass', 'CORS处理正常');
        } else {
          this.log(`跨域请求失败: ${response.status}`);
          this.endTest('fail', 'CORS处理异常');
        }
      } catch (error) {
        if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
          this.log('检测到CORS错误，这是预期的');
          this.endTest('pass', 'CORS错误处理正常');
        } else {
          this.log(`其他错误: ${error.message}`);
          this.endTest('fail', `CORS测试失败: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 执行所有测试
  async runAllTests() {
    this.log('开始执行API集成和兼容性测试套件', 'test');
    
    const tests = [
      () => this.testBrowserCompatibility(),
      () => this.testProviderValidatorAvailability(),
      () => this.testAPIConnectionFeature(),
      () => this.testErrorHandling(),
      () => this.testTimeoutHandling(),
      () => this.testCORSHandling()
    ];
    
    for (const test of tests) {
      try {
        await test();
        await this.sleep(1000); // 测试间隔
      } catch (error) {
        this.log(`测试执行错误: ${error.message}`, 'error');
      }
    }
    
    this.generateReport();
  }

  // 生成测试报告
  generateReport() {
    this.log('生成测试报告', 'test');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'pass').length;
    const failedTests = this.testResults.filter(t => t.status === 'fail').length;
    const skippedTests = this.testResults.filter(t => t.status === 'skip').length;
    
    console.log('\n=== API集成和兼容性测试报告 ===');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`跳过: ${skippedTests}`);
    console.log(`通过率: ${((passedTests / (totalTests - skippedTests)) * 100).toFixed(1)}%`);
    
    console.log('\n详细结果:');
    this.testResults.forEach(test => {
      const status = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏭️';
      console.log(`${status} ${test.id}: ${test.description} (${test.duration}ms)`);
      if (test.message) console.log(`   ${test.message}`);
      if (test.networkRequests && test.networkRequests.length > 0) {
        console.log(`   网络请求: ${test.networkRequests.length}个`);
      }
    });
    
    // 网络请求统计
    console.log('\n=== 网络请求统计 ===');
    const totalRequests = this.networkRequests.length;
    const successfulRequests = this.networkRequests.filter(req => req.success).length;
    const averageResponseTime = totalRequests > 0 ? 
      this.networkRequests.reduce((sum, req) => sum + req.duration, 0) / totalRequests : 0;
    
    console.log(`总请求数: ${totalRequests}`);
    console.log(`成功请求: ${successfulRequests}`);
    console.log(`平均响应时间: ${averageResponseTime.toFixed(0)}ms`);
    
    return this.testResults;
  }

  // 测试特定API类型
  async testSpecificAPIType(apiType) {
    this.startTest(`TC_${apiType.toUpperCase()}`, `${apiType} API类型测试`);
    
    try {
      // 查找特定类型的服务商
      if (window.app && window.app.configManager) {
        const providers = await window.app.configManager.getProviders();
        const targetProvider = providers.find(p => p.type === apiType);
        
        if (targetProvider) {
          this.log(`找到${apiType}类型的服务商: ${targetProvider.name}`);
          
          if (window.app.providerConfig && window.app.providerConfig.validator) {
            const result = await window.app.providerConfig.validator.testProviderConnection(targetProvider);
            
            if (result.isValid) {
              this.endTest('pass', `${apiType} API测试成功`);
            } else {
              this.endTest('fail', `${apiType} API测试失败: ${result.errors?.join(', ')}`);
            }
          } else {
            this.endTest('fail', '无法访问验证器');
          }
        } else {
          this.endTest('skip', `未找到${apiType}类型的服务商`);
        }
      } else {
        this.endTest('fail', '无法访问配置管理器');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }
}

// 导出测试器实例
window.apiIntegrationTester = new APIIntegrationTester();

// 使用说明
console.log('API集成和兼容性测试器已加载');
console.log('使用方法:');
console.log('1. 运行所有测试: apiIntegrationTester.runAllTests()');
console.log('2. 测试浏览器兼容性: apiIntegrationTester.testBrowserCompatibility()');
console.log('3. 测试特定API: apiIntegrationTester.testSpecificAPIType("openai")');
console.log('4. 查看结果: apiIntegrationTester.testResults');
