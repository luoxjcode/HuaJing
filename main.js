/**
 * 画境 · 本地服务（静态页面 + API 反向代理）
 *
 * 启动：npm start            等价于 node main.js
 * 换端口：node main.js 9000  或  npm start -- 9000
 * 访问：http://127.0.0.1:8787
 *
 * 代理规则（与页面「接口配置 → 本地代理」的默认值一致）：
 *   http://127.0.0.1:8787/https://api.xxx.com/v1/images/generations
 *     -> https://api.xxx.com/v1/images/generations
 *
 * 页面本身也由本服务提供，因此页面与代理同源，浏览器不会触发跨域限制。
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8787;
const ROOT = __dirname;
const DEFAULT_PAGE = 'ai-image-generator.html';
const TIMEOUT = 300000; // 生图较慢，上游超时放宽到 5 分钟

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// 逐跳首部，转发时必须剔除
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'];

// 来源白名单：仅允许本机同源页面（页面与代理由本服务提供）
const ALLOWED_ORIGIN = 'http://' + HOST + ':' + PORT;

function setCors(req, res) {
  if (req.headers.origin !== ALLOWED_ORIGIN) return; // 非白名单来源不下发 CORS 头，浏览器会自行拦截
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function replyJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

/* ---------------- 静态页面 ---------------- */
function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? DEFAULT_PAGE : urlPath;
  const file = path.join(ROOT, path.normalize(rel).replace(/^[/\\]+/, ''));

  // 目录穿越防护
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return replyJson(res, 403, { error: '禁止访问：' + urlPath });
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return replyJson(res, 404, { error: '未找到：' + urlPath });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- 反向代理 ---------------- */
function proxy(req, res) {
  const target = req.url.slice(1);
  let url;
  try {
    url = new URL(target);
  } catch (e) {
    return replyJson(res, 400, { error: '代理地址无效：' + target });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return replyJson(res, 400, { error: '仅支持 http/https 协议：' + url.protocol });
  }

  // 透传请求头：剔除逐跳首部，并改写 Host 指向目标站点
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.includes(k) || k === 'host' || k === 'origin' || k === 'referer') continue;
    headers[k] = v;
  }
  headers.host = url.host;

  const transport = url.protocol === 'https:' ? https : http;
  const upstream = transport.request({
    method: req.method,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    headers
  }, upRes => {
    const out = {};
    for (const [k, v] of Object.entries(upRes.headers)) {
      // 剔除逐跳首部；CORS 头由本服务统一给出，避免重复
      if (HOP_BY_HOP.includes(k) || k === 'access-control-allow-origin') continue;
      out[k] = v;
    }
    res.writeHead(upRes.statusCode || 502, out);
    upRes.pipe(res);
  });

  upstream.setTimeout(TIMEOUT, () => upstream.destroy(new Error('上游响应超时（' + TIMEOUT / 1000 + ' 秒）')));

  upstream.on('error', err => {
    console.error('[proxy] 失败 %s %s -> %s', req.method, target, err.message);
    if (res.headersSent) return res.destroy();
    replyJson(res, 502, { error: 'proxy: ' + err.message });
  });

  // 直接管道转发，multipart 参考图等大体积请求不会被缓冲到内存
  req.pipe(upstream);
}

/* ---------------- 服务入口 ---------------- */
const server = http.createServer((req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (/^\/https?:\/\//i.test(req.url)) {
    console.log('[proxy] %s %s', req.method, req.url.slice(1));
    proxy(req, res);
  } else {
    serveStatic(req, res);
  }
});

// 生图耗时较长，由上游超时控制，不设请求总超时
server.timeout = 0;
server.requestTimeout = 0;

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('[错误] 端口 %d 已被占用，可换端口启动：node main.js 9000', PORT);
  } else {
    console.error('[错误]', err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  画境 · AI 生图工具已启动');
  console.log('  页面地址  http://%s:%d', HOST, PORT);
  console.log('  代理地址  http://%s:%d  （已作为「接口配置 → 本地代理」的默认值）', HOST, PORT);
  console.log('  停止服务  Ctrl + C');
  console.log('');
});
