import axios from 'axios';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

class AutoApplier {
  constructor(config = {}) {
    this.config = {
      baseUrl: 'https://www.zhipin.com',
      applyInterval: config.applyInterval || 30000,
      maxDaily: config.maxDaily || 100,
      ...config
    };
    
    this.sessionId = uuidv4();
    this.records = [];
    this.todayCount = 0;
    this.lastApplyDate = new Date().toDateString();
    
    this.onProgress = null;
    this.onLog = null;
    this.onStatsUpdate = null;
  }

  setCookies(cookies) {
    this.cookies = cookies;
  }

  buildHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Content-Type': 'application/json',
      'Origin': this.config.baseUrl,
      'Referer': `${this.config.baseUrl}/`,
      'Cookie': typeof this.cookies === 'string' ? this.cookies : ''
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  checkDailyLimit() {
    const today = new Date().toDateString();
    if (today !== this.lastApplyDate) {
      this.todayCount = 0;
      this.lastApplyDate = today;
    }
    
    if (this.todayCount >= this.config.maxDaily) {
      logger.warn(`Daily limit reached (${this.config.maxDaily})`);
      return false;
    }
    
    return true;
  }

  async applyForJob(job, resumeId = 'default') {
    if (!this.checkDailyLimit()) {
      return { success: false, error: 'Daily limit reached' };
    }
    
    const record = {
      id: uuidv4(),
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      salary: job.salary.raw,
      resumeId,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      responseTime: null,
      error: null
    };
    
    try {
      this.log('info', `正在投递: ${job.title} @ ${job.company}`);
      
      const applyUrl = `${this.config.baseUrl}/web/geep/job/apply.json`;
      
      const response = await axios.post(applyUrl, {
        jobId: job.id,
        resumeId: resumeId,
        from: 'search_result'
      }, {
        headers: this.buildHeaders(),
        timeout: 15000
      });
      
      if (response.data.code === 0 || response.data.success) {
        record.status = 'success';
        record.responseTime = new Date().toISOString();
        this.todayCount++;
        
        this.log('success', `投递成功: ${job.title} @ ${job.company}`);
        this.emitProgress('success', record);
      } else {
        record.status = 'failed';
        record.error = response.data.message || 'Unknown error';
        this.log('warn', `投递失败: ${job.title} - ${record.error}`);
        this.emitProgress('failed', record);
      }
      
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
      this.log('error', `投递异常: ${job.title} - ${error.message}`);
      this.emitProgress('failed', record);
    }
    
    this.records.push(record);
    this.emitStatsUpdate();
    
    return record;
  }

  async batchApply(jobs, options = {}) {
    const {
      limit = 50,
      resumeId = 'default',
      dryRun = false,
      filter = null
    } = options;
    
    let toApply = jobs.slice(0, limit);
    
    if (filter) {
      toApply = toApply.filter(filter);
    }
    
    toApply = toApply.filter(job => 
      !this.records.some(r => r.jobId === job.id && r.status === 'success')
    );
    
    const results = {
      total: toApply.length,
      success: 0,
      failed: 0,
      skipped: 0,
      records: []
    };
    
    this.log('info', `开始批量投递，共 ${results.total} 个职位`);
    
    for (let i = 0; i < toApply.length; i++) {
      const job = toApply[i];
      
      this.emitProgress('progress', {
        current: i + 1,
        total: results.total,
        job: job.title
      });
      
      if (dryRun) {
        results.skipped++;
        this.log('info', `[Dry Run] 跳过: ${job.title} @ ${job.company}`);
      } else {
        const record = await this.applyForJob(job, resumeId);
        results.records.push(record);
        
        if (record.status === 'success') {
          results.success++;
        } else {
          results.failed++;
        }
      }
      
      if (i < toApply.length - 1) {
        await this.delay(this.config.applyInterval);
      }
    }
    
    this.log('info', `批量投递完成: 成功 ${results.success}, 失败 ${results.failed}, 跳过 ${results.skipped}`);
    
    return results;
  }

  log(level, message) {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (this.onLog) {
      this.onLog(entry);
    }
  }

  emitProgress(type, data) {
    if (this.onProgress) {
      this.onProgress({ type, data });
    }
  }

  emitStatsUpdate() {
    if (this.onStatsUpdate) {
      this.onStatsUpdate(this.getStats());
    }
  }

  getStats() {
    const todayRecords = this.records.filter(r => 
      r.appliedAt.startsWith(new Date().toISOString().split('T')[0])
    );
    
    const successCount = this.records.filter(r => r.status === 'success').length;
    const failedCount = this.records.filter(r => r.status === 'failed').length;
    
    return {
      sessionId: this.sessionId,
      totalToday: this.todayCount,
      dailyLimit: this.config.maxDaily,
      totalApplied: this.records.length,
      successRate: this.records.length > 0 ? successCount / this.records.length : 0,
      todaySuccess: todayRecords.filter(r => r.status === 'success').length,
      todayFailed: todayRecords.filter(r => r.status === 'failed').length,
      records: this.records.slice(-50)
    };
  }

  getRecords(filter = {}) {
    let filtered = this.records;
    
    if (filter.status) {
      filtered = filtered.filter(r => r.status === filter.status);
    }
    if (filter.jobId) {
      filtered = filtered.filter(r => r.jobId === filter.jobId);
    }
    if (filter.company) {
      filtered = filtered.filter(r => r.company.includes(filter.company));
    }
    
    return filtered;
  }

  exportRecords(format = 'json') {
    if (format === 'csv') {
      const headers = ['ID', '职位ID', '职位', '公司', '薪资', '状态', '投递时间', '错误信息'];
      const rows = this.records.map(r => [
        r.id,
        r.jobId,
        r.jobTitle,
        r.company,
        r.salary,
        r.status,
        r.appliedAt,
        r.error || ''
      ]);
      return [headers, ...rows].map(r => r.join(',')).join('\n');
    }
    
    return JSON.stringify(this.records, null, 2);
  }

  clearRecords() {
    this.records = [];
    this.todayCount = 0;
    this.log('info', '投递记录已清空');
  }
}

export { AutoApplier, logger };
export default AutoApplier;
