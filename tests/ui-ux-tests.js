/**
 * UI/UX测试脚本
 * 在浏览器控制台中运行此脚本来执行UI/UX测试
 */

class UIUXTester {
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

  // 测试颜色对比度
  testColorContrast() {
    this.startTest('TC_COLOR_CONTRAST', '颜色对比度测试');
    
    try {
      const successButtons = document.querySelectorAll('.btn-success');
      let contrastIssues = 0;
      
      successButtons.forEach((button, index) => {
        const styles = window.getComputedStyle(button);
        const backgroundColor = styles.backgroundColor;
        const color = styles.color;
        
        this.log(`按钮${index + 1}: 背景色=${backgroundColor}, 文字色=${color}`);
        
        // 检查是否是已知的对比度问题
        if (backgroundColor.includes('rgb(5, 150, 105)') || backgroundColor.includes('#059669')) {
          contrastIssues++;
          this.log(`发现对比度问题: 按钮${index + 1}`, 'warning');
        }
      });
      
      if (contrastIssues > 0) {
        this.endTest('fail', `发现${contrastIssues}个颜色对比度问题`);
      } else {
        this.endTest('pass', '颜色对比度检查通过');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试响应式设计
  async testResponsiveDesign() {
    this.startTest('TC_RESPONSIVE', '响应式设计测试');
    
    try {
      const originalWidth = window.innerWidth;
      const originalHeight = window.innerHeight;
      
      // 测试移动端视口
      this.log('测试移动端视口 (375x667)');
      window.resizeTo(375, 667);
      await this.sleep(500);
      
      // 检查导航是否变为垂直布局
      const tabNav = document.querySelector('.tab-nav');
      const tabNavStyles = window.getComputedStyle(tabNav);
      const isMobileLayout = tabNavStyles.flexDirection === 'column';
      
      this.log(`移动端导航布局: ${isMobileLayout ? '垂直' : '水平'}`);
      
      // 测试平板端视口
      this.log('测试平板端视口 (768x1024)');
      window.resizeTo(768, 1024);
      await this.sleep(500);
      
      // 恢复原始尺寸
      window.resizeTo(originalWidth, originalHeight);
      await this.sleep(500);
      
      if (isMobileLayout) {
        this.endTest('pass', '响应式设计工作正常');
      } else {
        this.endTest('fail', '移动端布局未正确切换');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试键盘导航
  async testKeyboardNavigation() {
    this.startTest('TC_KEYBOARD_NAV', '键盘导航测试');
    
    try {
      // 获取所有可聚焦元素
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      this.log(`找到${focusableElements.length}个可聚焦元素`);
      
      let focusableCount = 0;
      let tabIndexIssues = 0;
      
      focusableElements.forEach((element, index) => {
        if (element.offsetParent !== null) { // 元素可见
          focusableCount++;
          
          // 检查tabindex
          const tabIndex = element.getAttribute('tabindex');
          if (tabIndex && parseInt(tabIndex) > 0) {
            tabIndexIssues++;
            this.log(`发现正数tabindex: ${element.tagName} tabindex="${tabIndex}"`, 'warning');
          }
        }
      });
      
      this.log(`可见的可聚焦元素: ${focusableCount}个`);
      
      if (tabIndexIssues === 0) {
        this.endTest('pass', `键盘导航基础检查通过 (${focusableCount}个可聚焦元素)`);
      } else {
        this.endTest('warning', `发现${tabIndexIssues}个tabindex问题`);
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试加载状态
  async testLoadingStates() {
    this.startTest('TC_LOADING_STATES', '加载状态测试');
    
    try {
      // 查找测试按钮
      const testButtons = document.querySelectorAll('.test-btn, [data-action="test"]');
      
      if (testButtons.length === 0) {
        this.endTest('skip', '未找到测试按钮');
        return;
      }
      
      const firstButton = testButtons[0];
      const originalText = firstButton.textContent;
      
      this.log(`点击测试按钮: ${originalText}`);
      
      // 监控按钮文本变化
      let textChanged = false;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const newText = firstButton.textContent;
            if (newText !== originalText && (newText.includes('测试中') || newText.includes('loading'))) {
              textChanged = true;
              this.log(`检测到加载状态: ${newText}`);
            }
          }
        });
      });
      
      observer.observe(firstButton, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // 点击按钮
      firstButton.click();
      
      // 等待观察
      await this.sleep(3000);
      observer.disconnect();
      
      if (textChanged) {
        this.endTest('pass', '检测到加载状态反馈');
      } else {
        this.endTest('fail', '未检测到加载状态反馈');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试表单验证
  async testFormValidation() {
    this.startTest('TC_FORM_VALIDATION', '表单验证测试');
    
    try {
      // 尝试打开添加服务商模态框
      const addProviderBtn = document.getElementById('add-provider-btn');
      if (!addProviderBtn) {
        this.endTest('skip', '未找到添加服务商按钮');
        return;
      }
      
      addProviderBtn.click();
      await this.sleep(500);
      
      // 查找表单元素
      const nameInput = document.getElementById('provider-name');
      const saveBtn = document.getElementById('save-provider-btn');
      
      if (!nameInput || !saveBtn) {
        this.endTest('skip', '未找到表单元素');
        return;
      }
      
      // 测试空表单提交
      this.log('测试空表单提交');
      saveBtn.click();
      await this.sleep(1000);
      
      // 检查验证错误
      const errorMessages = document.querySelectorAll('.error-message, .invalid-feedback, .text-danger');
      
      if (errorMessages.length > 0) {
        this.log(`发现${errorMessages.length}个验证错误消息`);
        this.endTest('pass', '表单验证正常工作');
      } else {
        this.endTest('fail', '表单验证未生效');
      }
      
      // 关闭模态框
      const closeBtn = document.querySelector('#provider-modal .btn-secondary, #provider-modal .close');
      if (closeBtn) {
        closeBtn.click();
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试导航体验
  async testNavigationExperience() {
    this.startTest('TC_NAVIGATION', '导航体验测试');
    
    try {
      const tabButtons = document.querySelectorAll('.tab-button');
      
      if (tabButtons.length === 0) {
        this.endTest('skip', '未找到导航标签');
        return;
      }
      
      let activeTabCount = 0;
      let transitionEffects = 0;
      
      // 检查当前活动标签
      tabButtons.forEach((tab, index) => {
        if (tab.classList.contains('active')) {
          activeTabCount++;
          this.log(`活动标签: ${tab.textContent.trim()}`);
        }
        
        // 检查是否有过渡效果
        const styles = window.getComputedStyle(tab);
        if (styles.transition && styles.transition !== 'none') {
          transitionEffects++;
        }
      });
      
      // 测试标签切换
      if (tabButtons.length > 1) {
        const secondTab = tabButtons[1];
        this.log(`切换到: ${secondTab.textContent.trim()}`);
        secondTab.click();
        await this.sleep(500);
        
        // 检查切换后的状态
        const newActiveCount = document.querySelectorAll('.tab-button.active').length;
        
        if (newActiveCount === 1) {
          this.log('标签切换成功');
        }
      }
      
      this.log(`过渡效果: ${transitionEffects}/${tabButtons.length}个标签`);
      
      if (activeTabCount === 1) {
        this.endTest('pass', `导航状态正常 (${transitionEffects}个有过渡效果)`);
      } else {
        this.endTest('fail', `活动标签数量异常: ${activeTabCount}`);
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 测试错误处理UI
  async testErrorHandlingUI() {
    this.startTest('TC_ERROR_UI', '错误处理UI测试');
    
    try {
      // 检查是否使用原生弹窗
      let alertCalled = false;
      let confirmCalled = false;
      
      const originalAlert = window.alert;
      const originalConfirm = window.confirm;
      
      window.alert = function(message) {
        alertCalled = true;
        console.log('检测到alert调用:', message);
        return originalAlert.call(this, message);
      };
      
      window.confirm = function(message) {
        confirmCalled = true;
        console.log('检测到confirm调用:', message);
        return originalConfirm.call(this, message);
      };
      
      // 尝试触发一些操作来检测弹窗使用
      const deleteButtons = document.querySelectorAll('.delete-btn, .btn-danger');
      if (deleteButtons.length > 0) {
        this.log('尝试触发删除操作');
        deleteButtons[0].click();
        await this.sleep(1000);
      }
      
      // 恢复原始方法
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      
      if (alertCalled || confirmCalled) {
        this.endTest('fail', `检测到原生弹窗使用 (alert: ${alertCalled}, confirm: ${confirmCalled})`);
      } else {
        this.endTest('pass', '未检测到原生弹窗使用');
      }
      
    } catch (error) {
      this.endTest('fail', `测试失败: ${error.message}`);
    }
  }

  // 执行所有测试
  async runAllTests() {
    this.log('开始执行UI/UX测试套件', 'test');
    
    const tests = [
      () => this.testColorContrast(),
      () => this.testKeyboardNavigation(),
      () => this.testLoadingStates(),
      () => this.testFormValidation(),
      () => this.testNavigationExperience(),
      () => this.testErrorHandlingUI(),
      () => this.testResponsiveDesign()
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
    this.log('生成UI/UX测试报告', 'test');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'pass').length;
    const failedTests = this.testResults.filter(t => t.status === 'fail').length;
    const warningTests = this.testResults.filter(t => t.status === 'warning').length;
    const skippedTests = this.testResults.filter(t => t.status === 'skip').length;
    
    console.log('\n=== UI/UX测试报告 ===');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`警告: ${warningTests}`);
    console.log(`跳过: ${skippedTests}`);
    
    const effectiveTests = totalTests - skippedTests;
    if (effectiveTests > 0) {
      console.log(`通过率: ${((passedTests / effectiveTests) * 100).toFixed(1)}%`);
    }
    
    console.log('\n详细结果:');
    this.testResults.forEach(test => {
      const status = test.status === 'pass' ? '✅' : 
                    test.status === 'fail' ? '❌' : 
                    test.status === 'warning' ? '⚠️' : '⏭️';
      console.log(`${status} ${test.id}: ${test.description} (${test.duration}ms)`);
      if (test.message) console.log(`   ${test.message}`);
    });
    
    // UI/UX改进建议
    console.log('\n=== 改进建议 ===');
    const failedTestIds = this.testResults.filter(t => t.status === 'fail').map(t => t.id);
    
    if (failedTestIds.includes('TC_COLOR_CONTRAST')) {
      console.log('🎨 修复颜色对比度问题，提升可访问性');
    }
    if (failedTestIds.includes('TC_LOADING_STATES')) {
      console.log('⏳ 添加加载状态指示，改善用户体验');
    }
    if (failedTestIds.includes('TC_ERROR_UI')) {
      console.log('🚫 替换原生弹窗，保持UI一致性');
    }
    if (failedTestIds.includes('TC_FORM_VALIDATION')) {
      console.log('📝 改进表单验证反馈机制');
    }
    
    return this.testResults;
  }
}

// 导出测试器实例
window.uiuxTester = new UIUXTester();

// 使用说明
console.log('UI/UX测试器已加载');
console.log('使用方法:');
console.log('1. 运行所有测试: uiuxTester.runAllTests()');
console.log('2. 测试颜色对比度: uiuxTester.testColorContrast()');
console.log('3. 测试响应式设计: uiuxTester.testResponsiveDesign()');
console.log('4. 查看结果: uiuxTester.testResults');
