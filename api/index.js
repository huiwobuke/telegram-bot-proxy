const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Length');
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  const url = new URL(req.url, `https://${req.headers.host}`);
  let path = url.pathname;
  
  // 移除 /bot 前缀
  if (path.startsWith('/bot')) {
    path = path.substring(4);
  }
  
  // 处理 /file/ 端点
  let targetUrl;
  if (path.startsWith('/file/')) {
    const fileParts = path.split('/file/');
    if (fileParts.length >= 2) {
      const botTokenPart = fileParts[1].split('/')[0];
      const filePath = fileParts.slice(1).join('/file/').replace(botTokenPart + '/', '');
      targetUrl = `https://api.telegram.org/file/bot${botTokenPart}/${filePath}`;
    } else {
      return res.status(400).json({ error: 'Invalid file path' });
    }
  } else {
    targetUrl = `https://api.telegram.org${path}`;
  }
  
  // 转发请求到 Telegram
  const options = {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
  };
  
  // 处理请求体
  let body = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    options.headers['Content-Length'] = Buffer.byteLength(body);
  }
  
  // 发送请求
  const lib = targetUrl.startsWith('https') ? https : http;
  
  return new Promise((resolve) => {
    const proxyReq = lib.request(targetUrl, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
      resolve();
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Proxy error', message: err.message });
      resolve();
    });
    
    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
};
