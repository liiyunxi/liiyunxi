// Demo data is defined in index.html to avoid duplication

let charts = {};
let currentJobs = [];
let currentApplications = [];
let isRunning = false;

const ChartColors = {
  primary: '#00d4aa',
  secondary: '#6366f1',
  tertiary: '#f59e0b',
  quaternary: '#10b981',
  quinary: '#8b5cf6',
  background: 'rgba(0, 212, 170, 0.1)',
  backgroundSecondary: 'rgba(99, 102, 241, 0.1)'
};

function initCharts() {
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    }
  };

  const trendCtx = document.getElementById('trendChart').getContext('2d');
  charts.trend = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '投递数',
        data: [],
        borderColor: ChartColors.primary,
        backgroundColor: ChartColors.background,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: ChartColors.primary
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });

  const skillCtx = document.getElementById('skillChart').getContext('2d');
  charts.skill = new Chart(skillCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '需求热度',
        data: [],
        backgroundColor: [
          ChartColors.primary,
          ChartColors.secondary,
          ChartColors.tertiary,
          ChartColors.quaternary,
          ChartColors.quinary,
          '#ec4899',
          '#14b8a6',
          '#f97316'
        ],
        borderRadius: 6
      }]
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });

  const companyCtx = document.getElementById('companyChart').getContext('2d');
  charts.company = new Chart(companyCtx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          ChartColors.primary,
          ChartColors.secondary,
          ChartColors.tertiary,
          ChartColors.quaternary,
          ChartColors.quinary,
          '#ec4899',
          '#14b8a6',
          '#f97316'
        ],
        borderWidth: 0
      }]
    },
    options: {
      ...chartDefaults,
      cutout: '65%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: '#94a3b8', padding: 12, font: { size: 11 } }
        }
      }
    }
  });

  const salaryCtx = document.getElementById('salaryChart').getContext('2d');
  charts.salary = new Chart(salaryCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '职位数量',
        data: [],
        backgroundColor: ChartColors.backgroundSecondary,
        borderColor: ChartColors.secondary,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function updateKPIs(stats) {
  const kpis = stats.kpis;

  document.getElementById('kpiTotal').textContent = kpis.totalApplied;
  document.getElementById('kpiViewed').textContent = (kpis.responseRate * 100).toFixed(0) + '%';
  document.getElementById('kpiInterview').textContent = Math.round(kpis.interviewRate * kpis.totalApplied);
  document.getElementById('kpiSalary').textContent = (kpis.averageSalary / 1000).toFixed(0) + 'K';

  const trendApplied = document.getElementById('trendApplied');
  trendApplied.textContent = '+' + kpis.trendApplied.toFixed(1) + '%';

  const trendResponse = document.getElementById('trendResponse');
  trendResponse.textContent = '+' + kpis.trendResponse.toFixed(1) + '%';
}

function updateCharts(stats) {
  const charts_data = stats.charts;

  charts.trend.data.labels = charts_data.applicationTrend.map(d => d.label);
  charts.trend.data.datasets[0].data = charts_data.applicationTrend.map(d => d.count);
  charts.trend.update();

  const topSkills = charts_data.skillDemand.slice(0, 8);
  charts.skill.data.labels = topSkills.map(s => s.name);
  charts.skill.data.datasets[0].data = topSkills.map(s => s.count);
  charts.skill.update();

  const topCompanies = charts_data.companyDistribution.slice(0, 6);
  charts.company.data.labels = topCompanies.map(c => c.name);
  charts.company.data.datasets[0].data = topCompanies.map(c => c.count);
  charts.company.update();

  charts.salary.data.labels = charts_data.salaryDistribution.map(d => d.range);
  charts.salary.data.datasets[0].data = charts_data.salaryDistribution.map(d => d.count);
  charts.salary.update();
}

function renderJobList(applications) {
  const container = document.getElementById('jobList');
  container.innerHTML = '';

  const statusMap = {
    success: '已投递',
    viewed: '已查看',
    interview: '面试中',
    rejected: '不合适'
  };

  const statusClass = {
    success: 'success',
    viewed: 'viewed',
    interview: 'interview',
    rejected: 'rejected'
  };

  applications.forEach(app => {
    const item = document.createElement('div');
    item.className = 'job-item';
    item.innerHTML = `
      <div class="job-info">
        <h4>${app.jobTitle}</h4>
        <p>${app.company}</p>
      </div>
      <div class="job-salary">${app.salary}</div>
      <div>
        <span class="job-status ${statusClass[app.status]}">${statusMap[app.status]}</span>
      </div>
      <div class="job-time">${formatTime(app.appliedAt)}</div>
    `;
    container.appendChild(item);
  });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  return Math.floor(diff / 86400) + '天前';
}

function addLog(level, message) {
  const container = document.getElementById('logList');
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;

  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-message">${message}</span>
  `;

  container.insertBefore(entry, container.firstChild);

  while (container.children.length > 50) {
    container.removeChild(container.lastChild);
  }
}

function updateProgress(current, total, jobTitle) {
  const section = document.getElementById('progressSection');
  const bar = document.getElementById('progressBar');
  const text = document.getElementById('progressText');

  section.classList.add('active');
  const percent = (current / total) * 100;
  bar.style.width = percent + '%';
  text.textContent = `${current} / ${total}`;
}

function generateMockJobs(keyword, count = 8) {
  const companies = ['字节跳动', '阿里巴巴', '腾讯', '美团', '快手', '京东', '小米', '网易', '百度', '滴滴'];
  const titles = ['前端工程师', '高级前端工程师', '资深前端开发', '前端技术专家', 'Web前端工程师'];
  const locations = ['北京·海淀区', '北京·朝阳区', '杭州·西湖区', '深圳·南山区', '上海·浦东新区'];
  const tags = ['React', 'Vue', 'TypeScript', 'JavaScript', 'Node.js', 'CSS3', 'Webpack'];

  const jobs = [];
  for (let i = 0; i < count; i++) {
    const salaryMin = Math.floor(Math.random() * 20 + 15) * 1000;
    const salaryMax = salaryMin + Math.floor(Math.random() * 15 + 10) * 1000;
    const selectedTags = [...tags].sort(() => Math.random() - 0.5).slice(0, 3);

    jobs.push({
      id: `job_demo_${Date.now()}_${i}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      company: companies[Math.floor(Math.random() * companies.length)],
      salary: {
        min: salaryMin,
        max: salaryMax,
        raw: `${salaryMin / 1000}K-${salaryMax / 1000}K`
      },
      location: locations[Math.floor(Math.random() * locations.length)],
      experience: ['1-3年', '3-5年', '5-10年'][Math.floor(Math.random() * 3)],
      education: '本科',
      tags: selectedTags,
      matchScore: Math.floor(Math.random() * 30 + 70)
    });
  }
  return jobs;
}

async function runDemo(keyword) {
  if (isRunning) return;
  isRunning = true;

  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true;
  startBtn.innerHTML = '<span>⏳</span><span>运行中...</span>';

  addLog('info', `开始搜索: ${keyword || '前端工程师'} @ 北京`);
  await sleep(1000);

  currentJobs = generateMockJobs(keyword);
  addLog('info', `找到 ${currentJobs.length} 个匹配职位`);
  await sleep(800);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < currentJobs.length; i++) {
    const job = currentJobs[i];

    updateProgress(i + 1, currentJobs.length, job.title);
    addLog('info', `正在投递: ${job.title} @ ${job.company}`);

    await sleep(500 + Math.random() * 1000);

    if (Math.random() > 0.15) {
      success++;
      addLog('success', `✓ 投递成功: ${job.title} @ ${job.company}`);
    } else {
      failed++;
      addLog('warning', `✗ 投递失败: ${job.title} - 简历待完善`);
    }

    const stats = calculateStats();
    updateKPIs(stats);
    updateCharts(stats);
  }

  const newApps = currentJobs.map((job, index) => ({
    id: `app_new_${Date.now()}_${index}`,
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    salary: job.salary.raw,
    status: Math.random() > 0.15 ? 'success' : 'failed',
    appliedAt: new Date().toISOString()
  }));

  currentApplications = [...newApps, ...demoApplications.slice(0, 4)];
  renderJobList(currentApplications);

  const progressSection = document.getElementById('progressSection');
  progressSection.classList.remove('active');

  addLog('info', `投递完成: 成功 ${success}, 失败 ${failed}`);

  startBtn.disabled = false;
  startBtn.innerHTML = '<span>🚀</span><span>再次演示</span>';
  isRunning = false;
}

function calculateStats() {
  const baseStats = { ...demoStats };
  const newSuccessCount = currentJobs.filter(() => Math.random() > 0.15).length;

  baseStats.kpis.totalApplied = demoStats.kpis.totalApplied + newSuccessCount;
  baseStats.kpis.responseRate = 0.65 + Math.random() * 0.2;
  baseStats.kpis.interviewRate = 0.1 + Math.random() * 0.1;
  baseStats.kpis.averageSalary = 40000 + Math.floor(Math.random() * 10000);
  baseStats.kpis.trendApplied = 5 + Math.random() * 15;
  baseStats.kpis.trendResponse = 2 + Math.random() * 8;

  return baseStats;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function init() {
  initCharts();

  updateKPIs(demoStats);
  updateCharts(demoStats);
  renderJobList(demoApplications);

  addLog('info', '系统初始化完成');
  addLog('info', '输入关键词并点击"开始演示"以运行模拟');

  document.getElementById('startBtn').addEventListener('click', () => {
    const keyword = document.getElementById('keywordInput').value.trim();
    runDemo(keyword || '前端工程师');
  });

  document.getElementById('keywordInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const keyword = e.target.value.trim();
      runDemo(keyword || '前端工程师');
    }
  });

  document.getElementById('clearLogsBtn').addEventListener('click', () => {
    document.getElementById('logList').innerHTML = '';
    addLog('info', '日志已清空');
  });

  document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
