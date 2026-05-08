import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

class JobScraper {
  constructor(config = {}) {
    this.config = {
      baseUrl: 'https://www.zhipin.com',
      searchUrl: '/web/geep/job',
      throttle: config.throttle || 2000,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      ...config
    };
    
    this.cookieManager = null;
    this.requestCount = 0;
    this.sessionId = uuidv4();
    
    this.jobQueue = [];
    this.appliedJobs = new Set();
    this.failedJobs = [];
  }

  setCookies(cookies) {
    this.cookieManager = cookies;
  }

  buildHeaders(additionalHeaders = {}) {
    const headers = { ...DEFAULT_HEADERS };
    
    if (this.cookieManager) {
      headers['Cookie'] = typeof this.cookieManager === 'string' 
        ? this.cookieManager 
        : Object.entries(this.cookieManager).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    
    return { ...headers, ...additionalHeaders };
  }

  async delay(ms) {
    const randomDelay = ms + Math.random() * 1000;
    return new Promise(resolve => setTimeout(resolve, randomDelay));
  }

  async request(url, options = {}) {
    const maxRetries = options.retries || this.config.maxRetries;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.requestCount++;
        await this.delay(this.config.throttle);
        
        const response = await axios.get(url, {
          headers: this.buildHeaders(options.headers),
          timeout: this.config.timeout,
          params: options.params
        });
        
        return response;
      } catch (error) {
        lastError = error;
        logger.warn(`Request failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
        
        if (attempt < maxRetries) {
          await this.delay(this.config.throttle * 2 * attempt);
        }
      }
    }
    
    throw lastError;
  }

  parseJobCard(html, source = 'zhipin') {
    const $ = cheerio.load(html);
    const jobs = [];
    
    if (source === 'zhipin') {
      $('.job-card-box').each((i, el) => {
        const $el = $(el);
        
        const title = $el.find('.job-title').text().trim();
        const salary = $el.find('.salary').text().trim();
        const company = $el.find('.company-name').text().trim();
        const location = $el.find('.job-area').text().trim();
        const experience = $el.find('.experience').text().trim();
        const education = $el.find('.education').text().trim();
        
        const tags = [];
        $el.find('.tag-list .tag').each((i, tag) => {
          tags.push($(tag).text().trim());
        });
        
        const welfare = [];
        $el.find('.welfare-tag-list .welfare-tag').each((i, tag) => {
          welfare.push($(tag).text().trim());
        });
        
        const hrInfo = $el.find('.hr-info');
        const hrName = hrInfo.find('.name').text().trim();
        const hrAvatar = hrInfo.find('.avatar').attr('src');
        
        const postedTime = $el.find('.job-time .time').text().trim();
        
        const jobId = $el.attr('data-jobid') || uuidv4();
        
        const salaryMatch = salary.match(/(\d+)[Kk]-(\d+)[Kk]/);
        
        jobs.push({
          id: jobId,
          title,
          company,
          location,
          experience,
          education,
          salary: salaryMatch ? {
            min: parseInt(salaryMatch[1]) * 1000,
            max: parseInt(salaryMatch[2]) * 1000,
            raw: salary
          } : { min: 0, max: 0, raw: salary },
          tags,
          welfare,
          hrName,
          hrAvatar,
          postedTime,
          source: 'zhipin',
          url: `${this.config.baseUrl}/job_detail/${jobId}.html`
        });
      });
    }
    
    return jobs;
  }

  parseJobDetail(html) {
    const $ = cheerio.load(html);
    const detail = {};
    
    detail.description = $('.job-detail .detail-bottom .text').html() || '';
    detail.requirements = [];
    $('.job-detail .require .item').each((i, el) => {
      detail.requirements.push($(el).text().trim());
    });
    
    detail.bossActiveStatus = $('.boss-active-status').text().trim();
    detail.bossOnlineTime = $('.boss-online-time').text().trim();
    
    return detail;
  }

  async searchJobs(keyword, options = {}) {
    const {
      city = '北京',
      experience = '',
      salary = '',
      degree = '',
      page = 1,
      limit = 30
    } = options;
    
    logger.info(`Searching jobs: ${keyword} in ${city}`);
    
    const searchUrl = `${this.config.baseUrl}/web/geep/job/?query=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}`;
    
    try {
      const response = await this.request(searchUrl, {
        params: { page, experience, salary, degree }
      });
      
      const jobs = this.parseJobCard(response.data, 'zhipin');
      
      logger.info(`Found ${jobs.length} jobs`);
      
      this.jobQueue.push(...jobs);
      
      return {
        success: true,
        count: jobs.length,
        jobs,
        page,
        hasMore: jobs.length === limit
      };
    } catch (error) {
      logger.error(`Search failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        count: 0,
        jobs: []
      };
    }
  }

  async getJobDetail(jobId) {
    const url = `${this.config.baseUrl}/job_detail/${jobId}.html`;
    
    try {
      const response = await this.request(url);
      const detail = this.parseJobDetail(response.data);
      
      const job = this.jobQueue.find(j => j.id === jobId);
      if (job) {
        Object.assign(job, detail);
      }
      
      return { success: true, detail };
    } catch (error) {
      logger.error(`Failed to get job detail: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  calculateMatchScore(job, resume) {
    if (!resume.skills) return 0;
    
    const jobSkills = job.tags.map(t => t.toLowerCase());
    const resumeSkills = resume.skills.map(s => s.toLowerCase());
    
    const matched = resumeSkills.filter(s => 
      jobSkills.some(js => js.includes(s) || s.includes(js))
    );
    
    const score = (matched.length / Math.max(jobSkills.length, resumeSkills.length)) * 100;
    
    return Math.round(score);
  }

  filterJobs(criteria) {
    return this.jobQueue.filter(job => {
      if (criteria.minSalary && job.salary.min < criteria.minSalary) return false;
      if (criteria.maxSalary && job.salary.max > criteria.maxSalary) return false;
      if (criteria.locations && !criteria.locations.includes(job.location)) return false;
      if (criteria.companies && criteria.companies.includes(job.company)) return false;
      
      return true;
    });
  }

  getSessionStats() {
    return {
      sessionId: this.sessionId,
      requestCount: this.requestCount,
      jobsInQueue: this.jobQueue.length,
      appliedCount: this.appliedJobs.size,
      failedCount: this.failedJobs.length,
      timestamp: new Date().toISOString()
    };
  }

  exportJobs(format = 'json') {
    if (format === 'csv') {
      const headers = ['ID', '职位', '公司', '薪资', '地点', '经验', '学历'];
      const rows = this.jobQueue.map(job => [
        job.id,
        job.title,
        job.company,
        job.salary.raw,
        job.location,
        job.experience,
        job.education
      ]);
      return [headers, ...rows].map(r => r.join(',')).join('\n');
    }
    
    return JSON.stringify(this.jobQueue, null, 2);
  }
}

export { JobScraper, logger };
export default JobScraper;
