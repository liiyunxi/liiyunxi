#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { JobHunterEngine } from '../core/engine.js';
import { demoJobs, demoApplications, demoStats } from '../data/demo-data.js';

const program = new Command();

program
  .name('jobhunter')
  .description('Boss直聘自动投递简历工具')
  .version('1.0.0');

program
  .command('search')
  .description('搜索职位')
  .option('-k, --keyword <keyword>', '搜索关键词', '前端工程师')
  .option('-c, --city <city>', '城市', '北京')
  .option('-p, --page <page>', '页码', '1')
  .option('-l, --limit <limit>', '结果数量限制', '30')
  .action(async (options) => {
    const spinner = ora('正在搜索职位...').start();
    
    try {
      const engine = new JobHunterEngine();
      const result = await engine.searchJobs(options.keyword, {
        city: options.city,
        page: parseInt(options.page),
        limit: parseInt(options.limit)
      });
      
      spinner.succeed(chalk.green(`找到 ${result.count} 个职位`));
      
      if (result.jobs.length > 0) {
        console.log(chalk.bold('\n职位列表:'));
        result.jobs.forEach((job, i) => {
          console.log(`\n${i + 1}. ${chalk.cyan(job.title)} @ ${chalk.yellow(job.company)}`);
          console.log(`   薪资: ${chalk.green(job.salary.raw)} | 地点: ${job.location}`);
          console.log(`   要求: ${job.experience} | ${job.education}`);
        });
      }
      
    } catch (error) {
      spinner.fail(chalk.red(`搜索失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('批量投递简历')
  .option('-k, --keyword <keyword>', '搜索关键词', '前端工程师')
  .option('-c, --city <city>', '城市', '北京')
  .option('-l, --limit <limit>', '投递数量限制', '20')
  .option('--dry-run', '仅模拟，不实际投递', false)
  .option('--demo', '使用演示数据', false)
  .action(async (options) => {
    const spinner = ora('正在准备投递...').start();
    
    try {
      if (options.demo) {
        spinner.text = '使用演示数据模拟投递...';
        await simulateDemo(options.limit);
        return;
      }
      
      const engine = new JobHunterEngine();
      
      engine.on('progress', (data) => {
        if (data.type === 'progress') {
          spinner.text = `投递进度: ${data.data.current}/${data.data.total} - ${data.data.job}`;
        }
      });
      
      const result = await engine.searchAndApply({
        keyword: options.keyword,
        city: options.city,
        limit: parseInt(options.limit),
        dryRun: options.dryRun
      });
      
      if (result.success) {
        spinner.succeed(chalk.green('投递完成!'));
        console.log(chalk.bold('\n投递结果:'));
        console.log(`  成功: ${chalk.green(result.applyResult.success)}`);
        console.log(`  失败: ${chalk.red(result.applyResult.failed)}`);
        console.log(`  跳过: ${chalk.gray(result.applyResult.skipped)}`);
      } else {
        spinner.fail(chalk.red(`投递失败: ${result.error}`));
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('查看投递统计')
  .option('-r, --range <range>', '时间范围', '7d')
  .option('--json', '输出JSON格式')
  .action(async (options) => {
    const spinner = ora('加载统计数据...').start();
    
    try {
      const engine = new JobHunterEngine();
      engine.analytics.createSession();
      
      demoApplications.forEach(app => {
        engine.analytics.recordApplication(app);
      });
      
      const dashboard = engine.getDashboard();
      
      spinner.succeed(chalk.green('统计加载完成'));
      
      if (options.json) {
        console.log(JSON.stringify(dashboard, null, 2));
        return;
      }
      
      displayDashboard(dashboard);
      
    } catch (error) {
      spinner.fail(chalk.red(`加载失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('启动Web演示服务')
  .option('-p, --port <port>', '端口号', '3000')
  .action(async (options) => {
    console.log(chalk.bold('\n🚀 JobHunter Pro Web 服务\n'));
    console.log(chalk.gray(`服务地址: http://localhost:${options.port}`));
    console.log(chalk.gray(`演示页面: http://localhost:${options.port}/web/index.html\n`));
    
    const { createServer } = await import('http');
    const { parse } = await import('url');
    const { readFile } = await import('fs/promises');
    const { join, extname } = await import('path');
    
    const projectRoot = process.cwd();
    
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    
    const server = createServer(async (req, res) => {
      const parsedUrl = parse(req.url);
      let filePath = parsedUrl.pathname;
      
      if (filePath === '/') {
        filePath = '/src/web/index.html';
      } else if (filePath.startsWith('/web/')) {
        filePath = '/src' + filePath;
      } else if (!filePath.startsWith('/src/')) {
        filePath = '/src/web' + filePath;
      }
      
      filePath = join(projectRoot, filePath);
      
      try {
        const data = await readFile(filePath);
        const ext = extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>404</title></head>
          <body>
            <h1>404 - 页面未找到</h1>
            <p>请访问 <a href="/web/index.html">/web/index.html</a></p>
          </body>
          </html>
        `);
      }
    });
    
    server.listen(options.port, () => {
      console.log(chalk.green('✓ 服务已启动'));
      console.log(chalk.cyan('\n按 Ctrl+C 停止服务\n'));
    });
    
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n正在停止服务...'));
      server.close(() => {
        console.log(chalk.green('服务已停止'));
        process.exit(0);
      });
    });
  });

async function simulateDemo(limit) {
  console.log(chalk.bold('\n📊 演示模式 - 模拟投递过程\n'));
  
  const jobs = demoJobs.slice(0, Math.min(limit, demoJobs.length));
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    process.stdout.write(`\r${chalk.cyan('▶ 投递中')} ${job.title} @ ${job.company}...`);
    
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    if (Math.random() > 0.15) {
      success++;
      process.stdout.write(`\r${chalk.green('✓ 成功')} ${job.title} @ ${job.company}                    \n`);
    } else {
      failed++;
      process.stdout.write(`\r${chalk.red('✗ 失败')} ${job.title} - 简历不匹配                        \n`);
    }
  }
  
  console.log(chalk.bold('\n\n┌─────────────────────────────────────┐'));
  console.log(chalk.bold('│') + chalk.white('           投递结果统计') + chalk.bold('              │'));
  console.log(chalk.bold('├─────────────────────────────────────┤'));
  console.log(chalk.bold('│') + `  总投递数: ${chalk.cyan(limit.toString())}                     ${chalk.bold('│')}`);
  console.log(chalk.bold('│') + `  成功: ${chalk.green(success.toString())}                           ${chalk.bold('│')}`);
  console.log(chalk.bold('│') + `  失败: ${chalk.red(failed.toString())}                           ${chalk.bold('│')}`);
  console.log(chalk.bold('│') + `  成功率: ${chalk.green(((success / limit) * 100).toFixed(1) + '%')}                        ${chalk.bold('│')}`);
  console.log(chalk.bold('└─────────────────────────────────────┘\n'));
}

function displayDashboard(dashboard) {
  const kpis = dashboard.kpis;
  
  console.log(chalk.bold('\n┌──────────────────────────────────────────────────────────────────┐'));
  console.log(chalk.bold('│') + chalk.cyan('                    📊 求职数据看板') + chalk.white('                           │'));
  console.log(chalk.bold('├──────────────────────────────────────────────────────────────────┤'));
  
  console.log(chalk.bold('│') + `  总投递数      ${chalk.green(kpis.totalApplied.toString())}                                  ${chalk.bold('│')}`);
  console.log(chalk.bold('│') + `  简历浏览率    ${chalk.yellow((kpis.responseRate * 100).toFixed(1) + '%')}` + chalk.gray('                              ') + chalk.bold('│'));
  console.log(chalk.bold('│') + `  面试机会      ${chalk.cyan(kpis.interviewRate > 0 ? Math.round(kpis.interviewRate * kpis.totalApplied).toString() : '0')}` + chalk.gray('                                  ') + chalk.bold('│'));
  console.log(chalk.bold('│') + `  平均薪资      ${chalk.green((kpis.averageSalary / 1000).toFixed(1) + 'K')}` + chalk.gray('                                ') + chalk.bold('│'));
  console.log(chalk.bold('└──────────────────────────────────────────────────────────────────┘\n'));
  
  console.log(chalk.bold('📈 近7天投递趋势:'));
  dashboard.charts.applicationTrend.forEach(day => {
    const bar = '█'.repeat(day.count);
    console.log(`  ${chalk.gray(day.label)} ${chalk.cyan(bar)} ${day.count}`);
  });
  
  console.log(chalk.bold('\n🏢 投递热门公司:'));
  dashboard.charts.companyDistribution.slice(0, 5).forEach((company, i) => {
    const bar = '█'.repeat(Math.floor(company.count / 2));
    console.log(`  ${i + 1}. ${company.name.padEnd(8)} ${chalk.yellow(bar)} ${company.count}`);
  });
  
  console.log(chalk.bold('\n💼 热门技能需求:'));
  const topSkills = dashboard.charts.skillDemand.slice(0, 8);
  console.log('  ' + topSkills.map(s => chalk.cyan(s.name)).join('  ·  '));
}

program.parse();
