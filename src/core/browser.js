import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

let puppeteer = null;

async function loadPuppeteer() {
  if (puppeteer === null) {
    try {
      puppeteer = (await import('puppeteer')).default;
    } catch (error) {
      logger.warn('Puppeteer 未安装，浏览器自动化功能不可用');
      logger.info('请运行: npm install puppeteer 安装 Puppeteer');
      puppeteer = null;
    }
  }
  return puppeteer;
}

class BrowserManager {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      userDataDir: config.userDataDir || path.join(process.cwd(), '.browser-data'),
      timeout: config.timeout || 30000,
      ...config
    };

    this.browser = null;
    this.page = null;
    this.cookies = [];
    this.puppeteerAvailable = false;
  }

  async launch() {
    const puppeteerLib = await loadPuppeteer();
    
    if (!puppeteerLib) {
      throw new Error('Puppeteer 未安装，无法启动浏览器。请运行 "npm install puppeteer" 安装。');
    }

    if (this.browser) {
      return this.browser;
    }

    logger.info('正在启动浏览器...');

    const options = {
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    };

    if (!this.config.headless) {
      options.userDataDir = this.config.userDataDir;
    }

    this.browser = await puppeteerLib.launch(options);
    this.puppeteerAvailable = true;
    logger.info('浏览器启动成功');

    return this.browser;
  }

  async newPage() {
    if (!this.browser) {
      await this.launch();
    }

    this.page = await this.browser.newPage();
    
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    });

    await this.page.setViewport({
      width: 1920,
      height: 1080
    });

    return this.page;
  }

  async login(credentials = {}) {
    const { phone, password, useCookies = false } = credentials;

    if (!this.browser) {
      await this.launch();
    }

    if (!this.page) {
      await this.newPage();
    }

    if (useCookies && this.cookies.length > 0) {
      logger.info('正在使用已保存的 Cookie 登录...');
      await this.page.setCookie(...this.cookies);
      await this.page.goto('https://www.zhipin.com', { waitUntil: 'networkidle2' });
      
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        logger.info('Cookie 登录成功');
        return { success: true, method: 'cookies' };
      }
      logger.warn('Cookie 已失效，需要重新登录');
    }

    logger.info('正在打开登录页面...');
    await this.page.goto('https://www.zhipin.com', { waitUntil: 'networkidle2' });

    const loginButton = await this.page.$('.login-btn');
    if (loginButton) {
      await loginButton.click();
      await this.page.waitForSelector('.login-popup', { timeout: 5000 }).catch(() => {});
    }

    const needLogin = await this.checkLoginStatus();
    if (needLogin && phone && password) {
      return await this.performLogin(phone, password);
    }

    if (needLogin) {
      logger.info('请在浏览器中完成登录...');
      await this.waitForLogin();
    }

    return { success: true, method: 'manual' };
  }

  async performLogin(phone, password) {
    logger.info('正在输入登录信息...');

    await this.page.waitForSelector('.login-pwd', { timeout: 5000 }).catch(() => {});
    
    const phoneInput = await this.page.$('input[name="phone"]');
    const pwdInput = await this.page.$('input[name="password"]');
    const submitBtn = await this.page.$('.btn-wrapper .btn');

    if (phoneInput) {
      await phoneInput.type(phone, { delay: 50 });
    }

    if (pwdInput) {
      await pwdInput.type(password, { delay: 50 });
    }

    if (submitBtn) {
      await submitBtn.click();
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    }

    const isLoggedIn = await this.checkLoginStatus();
    if (isLoggedIn) {
      await this.saveCookies();
      logger.info('登录成功并保存 Cookie');
      return { success: true, method: 'auto' };
    }

    return { success: false, error: '登录失败，请检查账号密码' };
  }

  async waitForLogin(timeout = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        await this.saveCookies();
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('登录超时');
  }

  async checkLoginStatus() {
    try {
      await this.page.goto('https://www.zhipin.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const userAvatar = await this.page.$('.user-avatar');
      const loginBtn = await this.page.$('.login-btn');
      
      return !!userAvatar || !loginBtn;
    } catch (error) {
      return false;
    }
  }

  async getCookies() {
    if (!this.page) {
      return [];
    }

    this.cookies = await this.page.cookies();
    return this.cookies;
  }

  async saveCookies(filepath = null) {
    if (!filepath) {
      filepath = path.join(process.cwd(), 'data', 'cookies.json');
    }

    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.cookies = await this.page.cookies();
    
    const cookieObj = {};
    this.cookies.forEach(cookie => {
      cookieObj[cookie.name] = cookie.value;
    });

    fs.writeFileSync(filepath, JSON.stringify({
      cookies: this.cookies,
      cookieString: Object.entries(cookieObj).map(([k, v]) => `${k}=${v}`).join('; '),
      savedAt: new Date().toISOString()
    }, null, 2));

    logger.info(`Cookie 已保存到 ${filepath}`);
  }

  async loadCookies(filepath = null) {
    if (!filepath) {
      filepath = path.join(process.cwd(), 'data', 'cookies.json');
    }

    if (!fs.existsSync(filepath)) {
      logger.warn('Cookie 文件不存在');
      return null;
    }

    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    
    const savedDate = new Date(data.savedAt);
    const now = new Date();
    const hoursDiff = (now - savedDate) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      logger.warn(`Cookie 已过期（保存于 ${hoursDiff.toFixed(1)} 小时前）`);
      return null;
    }

    this.cookies = data.cookies;
    return data;
  }

  async navigate(url, options = {}) {
    if (!this.page) {
      await this.newPage();
    }

    const defaultOptions = {
      waitUntil: 'networkidle2',
      timeout: this.config.timeout
    };

    return await this.page.goto(url, { ...defaultOptions, ...options });
  }

  async evaluate(script) {
    if (!this.page) {
      throw new Error('页面未初始化');
    }
    return await this.page.evaluate(script);
  }

  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('浏览器已关闭');
  }

  isConnected() {
    return this.browser !== null && this.browser.connected;
  }

  isAvailable() {
    return this.puppeteerAvailable;
  }
}

export { BrowserManager, logger };
export default BrowserManager;
