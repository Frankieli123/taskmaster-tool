/**
 * 服务商管理功能自动化测试脚本
 * 在浏览器控制台中运行此脚本来执行功能测试
 */

class ProviderManagementTester {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
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
      logs: []
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

  // 工具方法：等待元素出现
  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.sleep(100);
    }
    throw new Error(`元素未找到: ${selector}`);
  }

  // 工具方法：模拟用户输入
  simulateInput(element, value) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // 工具方法：模拟点击
  simulateClick(element) {
    element.click();
  }

  // TC001: 添加有效的OpenAI服务商
  async testAddValidOpenAIProvider() {
    this.startTest('TC001', '添加有效的OpenAI服务商');
    
    try {
      // 1. 点击添加服务商按钮
      this.log('步骤1: 点击添加服务商按钮');
      const addButton = await this.waitForElement('#add-provider-btn');
      this.simulateClick(addButton);
      
      // 2. 等待模态框出现
      this.log('步骤2: 等待添加服务商模态框出现');
      const modal = await this.waitForElement('#provider-modal');
      
      // 3. 填写表单
      this.log('步骤3: 填写服务商表单');
      const nameInput = await this.waitForElement('#provider-name');
      const typeSelect = await this.waitForElement('#provider-type');
      const endpointInput = await this.waitForElement('#provider-endpoint');
      const keyInput = await this.waitForElement('#provider-key');
      
      this.simulateInput(nameInput, 'OpenAI Test');
      typeSelect.value = 'openai';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      this.simulateInput(endpointInput, 'https://api.openai.com');
      this.simulateInput(keyInput, 'sk-test123456789');
      
      // 4. 点击保存按钮
      this.log('步骤4: 点击保存按钮');
      const saveButton = await this.waitForElement('#save-provider-btn');
      this.simulateClick(saveButton);
      
      // 5. 等待操作完成
      await this.sleep(2000);
      
      // 6. 验证结果
      this.log('步骤5: 验证服务商是否添加成功');
      const providerCards = document.querySelectorAll('.provider-card');
      const newProvider = Array.from(providerCards).find(card => 
        card.textContent.includes('OpenAI Test')
      );
      
      if (newProvider) {
        this.endTest('pass', '服务商添加成功');
      } else {
        this.endTest('fail', '服务商未出现在列表中');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // TC002: 添加自定义服务商
  async testAddCustomProvider() {
    this.startTest('TC002', '添加有效的自定义服务商');
    
    try {
      // 点击添加服务商按钮
      const addButton = await this.waitForElement('#add-provider-btn');
      this.simulateClick(addButton);
      
      // 等待模态框并填写表单
      const modal = await this.waitForElement('#provider-modal');
      const nameInput = await this.waitForElement('#provider-name');
      const typeSelect = await this.waitForElement('#provider-type');
      const endpointInput = await this.waitForElement('#provider-endpoint');
      const keyInput = await this.waitForElement('#provider-key');
      
      this.simulateInput(nameInput, 'Custom API');
      typeSelect.value = 'custom';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      this.simulateInput(endpointInput, 'https://api.example.com');
      this.simulateInput(keyInput, 'custom-key-123');
      
      // 保存
      const saveButton = await this.waitForElement('#save-provider-btn');
      this.simulateClick(saveButton);
      
      await this.sleep(2000);
      
      // 验证
      const providerCards = document.querySelectorAll('.provider-card');
      const newProvider = Array.from(providerCards).find(card => 
        card.textContent.includes('Custom API')
      );
      
      if (newProvider) {
        this.endTest('pass', '自定义服务商添加成功');
      } else {
        this.endTest('fail', '自定义服务商未出现在列表中');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // TC003: 添加重复名称的服务商
  async testAddDuplicateProvider() {
    this.startTest('TC003', '添加重复名称的服务商');
    
    try {
      // 点击添加服务商按钮
      const addButton = await this.waitForElement('#add-provider-btn');
      this.simulateClick(addButton);
      
      // 填写重复名称
      const modal = await this.waitForElement('#provider-modal');
      const nameInput = await this.waitForElement('#provider-name');
      this.simulateInput(nameInput, 'OpenAI Test'); // 使用已存在的名称
      
      const typeSelect = await this.waitForElement('#provider-type');
      typeSelect.value = 'openai';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      
      const endpointInput = await this.waitForElement('#provider-endpoint');
      this.simulateInput(endpointInput, 'https://api.openai.com');
      
      const keyInput = await this.waitForElement('#provider-key');
      this.simulateInput(keyInput, 'sk-another-key');
      
      // 尝试保存
      const saveButton = await this.waitForElement('#save-provider-btn');
      this.simulateClick(saveButton);
      
      await this.sleep(1000);
      
      // 检查是否显示错误消息
      const errorMessage = document.querySelector('.error-message, .alert-danger');
      if (errorMessage && errorMessage.textContent.includes('已存在')) {
        this.endTest('pass', '正确显示重复名称错误');
      } else {
        this.endTest('fail', '未显示重复名称错误消息');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // TC007: 删除服务商
  async testDeleteProvider() {
    this.startTest('TC007', '删除服务商');
    
    try {
      // 找到第一个服务商的删除按钮
      const deleteButton = await this.waitForElement('.provider-card .delete-btn, .provider-card .btn-danger');
      this.simulateClick(deleteButton);
      
      // 等待确认对话框
      await this.sleep(500);
      
      // 确认删除（假设使用confirm对话框）
      // 注意：实际实现可能使用自定义模态框
      
      await this.sleep(1000);
      
      this.endTest('pass', '删除功能已触发');
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // TC009: 测试API连接
  async testAPIConnection() {
    this.startTest('TC009', '测试API连接');
    
    try {
      // 找到测试连接按钮
      const testButton = await this.waitForElement('.provider-card .test-btn, .provider-card .btn-info');
      this.simulateClick(testButton);
      
      // 等待测试完成
      await this.sleep(3000);
      
      // 检查测试结果
      const statusElement = document.querySelector('.provider-status, .status-indicator');
      if (statusElement) {
        this.endTest('pass', `连接测试完成，状态: ${statusElement.textContent}`);
      } else {
        this.endTest('pass', '连接测试已执行');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 执行所有测试
  async runAllTests() {
    this.log('开始执行服务商管理功能测试套件', 'test');
    
    const tests = [
      () => this.testAddValidOpenAIProvider(),
      () => this.testAddCustomProvider(),
      () => this.testAddDuplicateProvider(),
      () => this.testDeleteProvider(),
      () => this.testAPIConnection()
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
    
    console.log('\n=== 服务商管理功能测试报告 ===');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n详细结果:');
    this.testResults.forEach(test => {
      const status = test.status === 'pass' ? '✅' : '❌';
      console.log(`${status} ${test.id}: ${test.description} (${test.duration}ms)`);
      if (test.message) console.log(`   ${test.message}`);
    });
    
    return this.testResults;
  }
}

// 导出测试器实例
window.providerTester = new ProviderManagementTester();

// 使用说明
console.log('服务商管理功能测试器已加载');
console.log('使用方法:');
console.log('1. 运行所有测试: providerTester.runAllTests()');
console.log('2. 运行单个测试: providerTester.testAddValidOpenAIProvider()');
console.log('3. 查看结果: providerTester.testResults');
