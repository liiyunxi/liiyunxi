import { EventEmitter } from 'events';
import { JobScraper } from './scraper.js';
import { AutoApplier } from './applier.js';
import { DataAnalytics } from './analytics.js';
import { BrowserManager } from './browser.js';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

class JobHunterEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      throttle: config.throttle || 2000,
      applyInterval: config.applyInterval || 30000,
      maxDaily: config.maxDaily || 100,
      autoLogin: config.autoLogin || false,
      headless: config.headless !== undefined ? config.headless : true,
      eventThrottle: config.eventThrottle || 500,
      batchSize: config.batchSize || 10,
      ...config
    };
    
    this.sessionId = uuidv4();
    this.scraper = new JobScraper({
      throttle: this.config.throttle
    });
    this.applier = new AutoApplier({
      applyInterval: this.config.applyInterval,
      maxDaily: this.config.maxDaily
    });
    this.analytics = new DataAnalytics();
    this.browser = null;
    
    this.isRunning = false;
    this.currentJob = null;
    
    this.eventQueue = [];
    this.lastEventTime = 0;
    this.eventThrottleTimer = null;
    this.isProcessingEvents = false;
    
    this.setupEventHandlers();
  }

  async launchBrowser(options = {}) {
    if (!this.browser) {
      this.browser = new BrowserManager({
        headless: options.headless !== undefined ? options.headless : this.config.headless,
        ...options
      });
    }
    
    await this.browser.launch();
    return this.browser;
  }

  async login(options = {}) {
    if (!this.browser) {
      await this.launchBrowser(options);
    }
    
    const credentials = {
      phone: options.phone || process.env.BOSS_PHONE,
      password: options.password || process.env.BOSS_PASSWORD,
      useCookies: options.useCookies !== false
    };
    
    const result = await this.browser.login(credentials);
    
    if (result.success) {
      const cookies = await this.browser.getCookies();
      this.setCookies(cookies);
    }
    
    return result;
  }

  async saveSession() {
    if (this.browser) {
      await this.browser.saveCookies();
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  setupEventHandlers() {
    this.applier.onProgress = (data) => this.queueEvent('progress', data);
    this.applier.onLog = (data) => this.queueEvent('log', data);
    this.applier.onStatsUpdate = (data) => this.queueEvent('stats', data);
    
    this.on('jobScraped', (job) => this.analytics.recordJobScraped(job));
    this.on('application', (app) => this.analytics.recordApplication(app));
  }

  queueEvent(type, data) {
    this.eventQueue.push({ type, data, timestamp: Date.now() });
    
    if (!this.isProcessingEvents) {
      this.processEventQueue();
    }
  }

  processEventQueue() {
    const now = Date.now();
    const timeSinceLastEvent = now - this.lastEventTime;
    
    if (timeSinceLastEvent >= this.config.eventThrottle && this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      this.emit(event.type, event.data);
      this.lastEventTime = Date.now();
    }
    
    if (this.eventQueue.length > 0) {
      setImmediate(() => this.processEventQueue());
    } else {
      this.isProcessingEvents = false;
    }
  }

  flushEvents() {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      this.emit(event.type, event.data);
    }
    this.isProcessingEvents = false;
  }

  setCookies(cookies) {
    this.scraper.setCookies(cookies);
    this.applier.setCookies(cookies);
  }

  async initialize() {
    this.analytics.createSession(this.sessionId);
    logger.info('Engine initialized');
    return { success: true, sessionId: this.sessionId };
  }

  async searchAndApply(options = {}) {
    const {
      keyword,
      city = '北京',
      limit = 20,
      resumeId = 'default',
      dryRun = false
    } = options;
    
    if (this.isRunning) {
      return { success: false, error: 'Another job is running' };
    }
    
    this.isRunning = true;
    this.emit('start', { sessionId: this.sessionId });
    
    try {
      await this.initialize();
      
      logger.info(`Searching jobs: ${keyword} in ${city}`);
      this.queueEvent('log', { level: 'info', message: `开始搜索: ${keyword} @ ${city}` });
      
      const searchResult = await this.scraper.searchJobs(keyword, {
        city,
        limit
      });
      
      if (!searchResult.success) {
        throw new Error(searchResult.error);
      }
      
      for (let i = 0; i < searchResult.jobs.length; i += this.config.batchSize) {
        const batch = searchResult.jobs.slice(i, i + this.config.batchSize);
        batch.forEach(job => this.emit('jobScraped', job));
        
        if (i + this.config.batchSize < searchResult.jobs.length) {
          this.queueEvent('log', { 
            level: 'info', 
            message: `已加载 ${Math.min(i + this.config.batchSize, searchResult.jobs.length)}/${searchResult.jobs.length} 个职位` 
          });
        }
      }
      
      this.queueEvent('log', { 
        level: 'info', 
        message: `找到 ${searchResult.count} 个职位，开始投递...` 
      });
      
      const applyResult = await this.applier.batchApply(searchResult.jobs, {
        limit,
        resumeId,
        dryRun
      });
      
      applyResult.records.forEach(record => this.emit('application', record));
      
      this.flushEvents();
      
      this.emit('complete', {
        sessionId: this.sessionId,
        stats: this.getStats()
      });
      
      return {
        success: true,
        searchResult,
        applyResult,
        stats: this.getStats()
      };
      
    } catch (error) {
      logger.error(`Error: ${error.message}`);
      this.emit('error', { error: error.message });
      
      return {
        success: false,
        error: error.message
      };
      
    } finally {
      this.isRunning = false;
      this.analytics.endSession();
    }
  }

  async searchJobs(keyword, options = {}) {
    const result = await this.scraper.searchJobs(keyword, options);
    result.jobs.forEach(job => this.emit('jobScraped', job));
    return result;
  }

  async applyForJob(jobId, resumeId = 'default') {
    const job = this.scraper.jobQueue.find(j => j.id === jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }
    
    const record = await this.applier.applyForJob(job, resumeId);
    this.emit('application', record);
    
    return record;
  }

  async batchApply(jobs, options = {}) {
    const result = await this.applier.batchApply(jobs, options);
    result.records.forEach(record => this.emit('application', record));
    return result;
  }

  getJobs(filter = {}) {
    return this.scraper.filterJobs(filter);
  }

  getJobsQueue() {
    return this.scraper.jobQueue;
  }

  getRecords(filter = {}) {
    return this.applier.getRecords(filter);
  }

  getStats() {
    return {
      session: this.analytics.getDashboardData(),
      applier: this.applier.getStats(),
      scraper: this.scraper.getSessionStats()
    };
  }

  getDashboard() {
    return this.analytics.getDashboardData();
  }

  exportData(format = 'json') {
    return {
      jobs: this.scraper.exportJobs(format),
      records: this.applier.exportRecords(format),
      report: this.analytics.exportCSV(this.getDashboard())
    };
  }

  async reset() {
    await this.closeBrowser();
    this.scraper.jobQueue = [];
    this.scraper.appliedJobs.clear();
    this.scraper.failedJobs = [];
    this.applier.clearRecords();
    this.analytics.sessions.clear();
    this.sessionId = uuidv4();
    
    logger.info('Engine reset');
    this.emit('reset');
  }
}

export { JobHunterEngine, logger };
export default JobHunterEngine;
