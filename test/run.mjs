// 无依赖测试运行器：用本机 Edge/Chrome 无头加载 test/harness.html，
// 解析 <pre id="T"> 里的 PASS/FAIL/SUMMARY 行，输出并决定退出码。
// 不引入任何 npm 依赖。
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const harnessPath = join(here, 'harness.html');

function posix(name) {
  return ['', 'usr', 'bin', name].join('/');
}

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    process.env.EDGE_PATH,
    join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.ProgramFiles ?? '', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Microsoft/Edge/Application/msedge.exe'),
    join(process.env.ProgramFiles ?? '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
    posix('microsoft-edge'),
    posix('google-chrome'),
    posix('chromium'),
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (existsSync(c)) return c;
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.error('找不到 Edge/Chrome。可用环境变量 BROWSER_PATH 指定浏览器可执行文件。');
  process.exit(2);
}

const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  '--disable-extensions',
  '--no-first-run',
  '--user-data-dir=' + join(tmpdir(), 'solar-system-test-profile'),
  '--virtual-time-budget=' + (process.env.TEST_BUDGET_MS ?? '20000'),
  '--dump-dom',
  pathToFileURL(harnessPath).href,
];

const res = spawnSync(browser, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
if (res.error) {
  console.error('启动浏览器失败：' + res.error.message);
  process.exit(2);
}

const dom = res.stdout ?? '';
const matched = dom.match(/<pre id="T">([\s\S]*?)<\/pre>/);
if (!matched) {
  console.error('没有从页面里取到测试结果。原始输出前 2000 字符：\n' + dom.slice(0, 2000));
  process.exit(2);
}

const text = matched[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
for (const l of lines) console.log(l);

if (lines.length === 0) {
  console.error('\n被测页面没有产出任何结果。');
  process.exit(2);
}
if (lines.indexOf('running') >= 0) {
  console.error('\n被测页面没有跑完（仍停在 running）。');
  process.exit(2);
}

const sum = lines.find((l) => l.startsWith('SUMMARY'));
if (!sum) {
  console.error('\n缺少 SUMMARY 行。');
  process.exit(2);
}
const pass = Number((sum.match(/pass=(\d+)/) ?? [])[1]);
const fail = Number((sum.match(/fail=(\d+)/) ?? [])[1]);
console.log('\n' + (fail === 0 ? '全部通过' : '有失败用例') + '：pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);