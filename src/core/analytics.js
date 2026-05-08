import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

class DataAnalytics {
  constructor() {
    this.sessions = new Map();
    this.currentSession = null;
    
    this.defaultMetrics = {
      totalJobsScraped: 0,
      totalApplied: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalViewed: 0,
      totalInterview: 0,
      totalRejected: 0,
      averageSalary: 0,
      salaryDistribution: {},
      companyDistribution: {},
      locationDistribution: {},
      skillDemand: {},
      applicationTrend: [],
      responseRate: 0,
      interviewRate: 0
    };
  }

  createSession(name = 'default') {
    const session = {
      id: uuidv4(),
      name,
      startTime: new Date().toISOString(),
      endTime: null,
      metrics: { ...this.defaultMetrics },
      jobsScraped: [],
      applications: [],
      logs: []
    };
    
    this.sessions.set(session.id, session);
    this.currentSession = session;
    
    return session;
  }

  endSession() {
    if (this.currentSession) {
      this.currentSession.endTime = new Date().toISOString();
      this.currentSession = null;
    }
  }

  recordJobScraped(job) {
    if (!this.currentSession) return;
    
    this.currentSession.jobsScraped.push(job);
    this.currentSession.metrics.totalJobsScraped++;
    
    const salary = job.salary;
    if (salary && salary.min && salary.max) {
      const avg = (salary.min + salary.max) / 2;
      this.updateAverageSalary(avg);
      this.updateSalaryDistribution(avg);
    }
    
    if (job.company) {
      this.updateDistribution('companyDistribution', job.company);
    }
    
    if (job.location) {
      this.updateDistribution('locationDistribution', job.location);
    }
    
    if (job.tags) {
      job.tags.forEach(tag => {
        this.updateDistribution('skillDemand', tag);
      });
    }
  }

  recordApplication(application) {
    if (!this.currentSession) return;
    
    this.currentSession.applications.push(application);
    this.currentSession.metrics.totalApplied++;
    
    if (application.status === 'success') {
      this.currentSession.metrics.totalSuccess++;
    } else if (application.status === 'failed') {
      this.currentSession.metrics.totalFailed++;
    }
    
    this.updateApplicationTrend();
    this.updateRates();
  }

  recordStatusChange(jobId, newStatus) {
    if (!this.currentSession) return;
    
    const app = this.currentSession.applications.find(a => a.jobId === jobId);
    if (app) {
      const oldStatus = app.status;
      app.status = newStatus;
      app.statusUpdatedAt = new Date().toISOString();
      
      if (newStatus === 'viewed' && oldStatus === 'success') {
        this.currentSession.metrics.totalViewed++;
      } else if (newStatus === 'interview') {
        this.currentSession.metrics.totalInterview++;
      } else if (newStatus === 'rejected') {
        this.currentSession.metrics.totalRejected++;
      }
      
      this.updateRates();
    }
  }

  updateAverageSalary(newSalary) {
    const session = this.currentSession;
    if (!session) return;
    
    const current = session.metrics.averageSalary;
    const count = session.metrics.totalJobsScraped;
    
    session.metrics.averageSalary = (current * (count - 1) + newSalary) / count;
  }

  updateSalaryDistribution(salary) {
    const session = this.currentSession;
    if (!session) return;
    
    const range = this.getSalaryRange(salary);
    session.metrics.salaryDistribution[range] = 
      (session.metrics.salaryDistribution[range] || 0) + 1;
  }

  getSalaryRange(salary) {
    const k = salary / 1000;
    if (k < 10) return '<10K';
    if (k < 15) return '10-15K';
    if (k < 20) return '15-20K';
    if (k < 25) return '20-25K';
    if (k < 30) return '25-30K';
    if (k < 40) return '30-40K';
    if (k < 50) return '40-50K';
    return '50K+';
  }

  updateDistribution(field, value) {
    const session = this.currentSession;
    if (!session) return;
    
    session.metrics[field][value] = (session.metrics[field][value] || 0) + 1;
  }

  updateApplicationTrend() {
    const session = this.currentSession;
    if (!session) return;
    
    const today = new Date().toISOString().split('T')[0];
    const existing = session.metrics.applicationTrend.find(t => t.date === today);
    
    if (existing) {
      existing.count++;
    } else {
      session.metrics.applicationTrend.push({ date: today, count: 1 });
    }
  }

  updateRates() {
    const session = this.currentSession;
    if (!session) return;
    
    const total = session.metrics.totalApplied;
    if (total > 0) {
      session.metrics.responseRate = 
        (session.metrics.totalSuccess + session.metrics.totalViewed) / total;
      session.metrics.interviewRate = 
        session.metrics.totalInterview / total;
    }
  }

  getDashboardData(range = '7d') {
    const now = new Date();
    const days = parseInt(range);
    
    let relevantSessions = Array.from(this.sessions.values());
    
    if (!isNaN(days)) {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      relevantSessions = relevantSessions.filter(s => 
        new Date(s.startTime) >= cutoff
      );
    }
    
    const aggregated = this.aggregateMetrics(relevantSessions);
    
    return {
      kpis: {
        totalApplied: aggregated.totalApplied,
        responseRate: aggregated.responseRate,
        interviewRate: aggregated.interviewRate,
        averageSalary: aggregated.averageSalary,
        trendApplied: this.calculateTrend(aggregated.applicationTrend),
        trendResponse: 0
      },
      charts: {
        applicationTrend: this.formatTrendChart(aggregated.applicationTrend),
        salaryDistribution: this.formatDistribution(aggregated.salaryDistribution),
        companyDistribution: this.getTopN(aggregated.companyDistribution, 10),
        locationDistribution: this.getTopN(aggregated.locationDistribution, 5),
        skillDemand: this.getTopN(aggregated.skillDemand, 15)
      },
      recentApplications: this.getRecentApplications(relevantSessions, 10)
    };
  }

  aggregateMetrics(sessions) {
    const aggregated = { ...this.defaultMetrics };
    
    sessions.forEach(session => {
      aggregated.totalJobsScraped += session.metrics.totalJobsScraped;
      aggregated.totalApplied += session.metrics.totalApplied;
      aggregated.totalSuccess += session.metrics.totalSuccess;
      aggregated.totalViewed += session.metrics.totalViewed;
      aggregated.totalInterview += session.metrics.totalInterview;
      aggregated.totalFailed += session.metrics.totalFailed;
      
      if (session.metrics.totalJobsScraped > 0) {
        aggregated.averageSalary = 
          (aggregated.averageSalary + session.metrics.averageSalary) / 2;
      }
      
      this.mergeDistribution(aggregated.salaryDistribution, session.metrics.salaryDistribution);
      this.mergeDistribution(aggregated.companyDistribution, session.metrics.companyDistribution);
      this.mergeDistribution(aggregated.locationDistribution, session.metrics.locationDistribution);
      this.mergeDistribution(aggregated.skillDemand, session.metrics.skillDemand);
      
      aggregated.applicationTrend.push(...session.metrics.applicationTrend);
    });
    
    if (aggregated.totalApplied > 0) {
      aggregated.responseRate = 
        (aggregated.totalSuccess + aggregated.totalViewed) / aggregated.totalApplied;
      aggregated.interviewRate = aggregated.totalInterview / aggregated.totalApplied;
    }
    
    return aggregated;
  }

  mergeDistribution(target, source) {
    Object.entries(source).forEach(([key, value]) => {
      target[key] = (target[key] || 0) + value;
    });
  }

  calculateTrend(data) {
    if (data.length < 2) return 0;
    
    const recent = data.slice(-7);
    if (recent.length < 2) return 0;
    
    const first = recent[0].count;
    const last = recent[recent.length - 1].count;
    
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }

  formatTrendChart(data) {
    const last7Days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const entry = data.find(d => d.date === dateStr);
      
      last7Days.push({
        date: dateStr,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        count: entry ? entry.count : 0
      });
    }
    
    return last7Days;
  }

  formatDistribution(distribution) {
    return Object.entries(distribution)
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => {
        const order = ['<10K', '10-15K', '15-20K', '20-25K', '25-30K', '30-40K', '40-50K', '50K+'];
        return order.indexOf(a.range) - order.indexOf(b.range);
      });
  }

  getTopN(distribution, n = 10) {
    return Object.entries(distribution)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  getRecentApplications(sessions, limit = 10) {
    const all = sessions.flatMap(s => s.applications);
    return all
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
      .slice(0, limit)
      .map(app => ({
        id: app.id,
        jobTitle: app.jobTitle,
        company: app.company,
        salary: app.salary,
        status: app.status,
        appliedAt: app.appliedAt,
        responseTime: app.responseTime
      }));
  }

  getReport(format = 'json') {
    const dashboard = this.getDashboardData();
    
    if (format === 'csv') {
      return this.exportCSV(dashboard);
    }
    
    return dashboard;
  }

  exportCSV(data) {
    const lines = ['指标,数值'];
    
    lines.push(`总投递数,${data.kpis.totalApplied}`);
    lines.push(`回复率,${(data.kpis.responseRate * 100).toFixed(1)}%`);
    lines.push(`面试率,${(data.kpis.interviewRate * 100).toFixed(1)}%`);
    lines.push(`平均薪资,${(data.kpis.averageSalary / 1000).toFixed(1)}K`);
    
    return lines.join('\n');
  }
}

export { DataAnalytics, logger };
export default DataAnalytics;
