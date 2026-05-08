import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import { JobHunterEngine } from './core/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'web')));

let engine = null;
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('[WebSocket] Client connected');

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[WebSocket] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    clients.delete(ws);
  });
});

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

function getEngine() {
  if (!engine) {
    engine = new JobHunterEngine({
      headless: false,
      autoLogin: true
    });

    engine.on('progress', (data) => {
      broadcast({ type: 'progress', data });
    });

    engine.on('log', (data) => {
      broadcast({ type: 'log', data });
    });

    engine.on('stats', (data) => {
      broadcast({ type: 'stats', data });
    });
  }
  return engine;
}

app.post('/api/login/start', async (req, res) => {
  try {
    const eng = getEngine();
    await eng.launchBrowser({ headless: false });

    const { phone, password } = req.body;

    if (phone && password) {
      const result = await eng.login({ phone, password });
      res.json(result);
    } else {
      await eng.browser.newPage();
      await eng.browser.navigate('https://www.zhipin.com');
      res.json({ success: true, message: '请在浏览器中完成登录', method: 'manual' });
    }
  } catch (error) {
    console.error('[API] Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/login/status', async (req, res) => {
  try {
    const eng = getEngine();

    if (!eng.browser || !eng.browser.isConnected()) {
      return res.json({ loggedIn: false });
    }

    const isLoggedIn = await eng.browser.checkLoginStatus();
    res.json({ loggedIn: isLoggedIn });
  } catch (error) {
    res.json({ loggedIn: false, error: error.message });
  }
});

app.post('/api/login/save', async (req, res) => {
  try {
    const eng = getEngine();
    await eng.saveSession();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/apply/start', async (req, res) => {
  try {
    const { keyword, city, limit } = req.body;
    const eng = getEngine();

    if (eng.isRunning) {
      return res.status(400).json({ success: false, error: '投递任务正在进行中' });
    }

    const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const cookieData = await eng.browser?.loadCookies?.() || null;

    if (!cookieData) {
      return res.status(401).json({
        success: false,
        error: '请先登录',
        needLogin: true
      });
    }

    eng.isRunning = true;

    eng.searchAndApply(keyword || 'Java AI应用开发', {
      city: city || '北京',
      limit: validatedLimit
    });

    res.json({ success: true, message: '投递任务已开始' });
  } catch (error) {
    console.error('[API] Apply error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/apply/stop', async (req, res) => {
  try {
    if (engine) {
      engine.isRunning = false;
      engine.currentJob = null;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/apply/status', (req, res) => {
  const defaultStats = {
    totalApplied: 0,
    successCount: 0,
    failedCount: 0,
    responseRate: 0,
    interviewRate: 0,
    averageSalary: 0
  };

  let stats = defaultStats;
  if (engine?.analytics?.getStats) {
    const engineStats = engine.analytics.getStats();
    if (engineStats && typeof engineStats === 'object') {
      stats = { ...defaultStats, ...engineStats };
    }
  }

  const status = {
    running: engine?.isRunning || false,
    currentJob: engine?.currentJob || null,
    stats
  };
  res.json(status);
});

app.get('/api/jobs/search', async (req, res) => {
  try {
    const { keyword, city, page } = req.query;
    const eng = getEngine();

    const jobs = await eng.searchJobs(keyword || 'Java AI应用开发', {
      city: city || '北京',
      page: parseInt(page) || 1
    });

    if (!jobs || jobs.jobs === null) {
      return res.status(500).json({ success: false, error: '搜索失败，请稍后重试' });
    }

    res.json({ success: true, jobs: jobs.jobs });
  } catch (error) {
    console.error('[API] Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/browser/close', async (req, res) => {
  try {
    if (engine) {
      await engine.closeBrowser();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  const stats = engine?.analytics?.getStats?.() || {
    totalApplied: 0,
    successCount: 0,
    failedCount: 0
  };
  res.json(stats);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`\n🚀 JobHunter Pro Web Server`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  if (engine) {
    await engine.closeBrowser();
  }
  server.close(() => {
    process.exit(0);
  });
});
