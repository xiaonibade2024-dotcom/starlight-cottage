// Vercel Serverless Function: Supabase Proxy
// 解决浏览器无法直接访问 Supabase 域名的问题

// 关闭 Vercel 的自动 body 解析，拿到原始 body
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * 从 IncomingMessage 中读取原始 body
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, X-Client-Info, Prefer');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // 从查询参数中取出目标 URL
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  // 安全检查：只允许代理到你自己的 Supabase 项目
  const ALLOWED_HOST = 'ltcouifrhmsmsicvsgz.supabase.co';
  try {
    const parsed = new URL(targetUrl);
    if (parsed.hostname !== ALLOWED_HOST) {
      return res.status(403).json({ error: `Proxy only allowed for ${ALLOWED_HOST}` });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // 转发关键 headers
  const forwardHeaders = {};
  const headerKeys = [
    'content-type',
    'apikey',
    'authorization',
    'x-client-info',
    'prefer',
    'accept',
    'accept-profile',
    'content-profile',
    'x-supabase-api-version',
  ];
  for (const key of headerKeys) {
    if (req.headers[key]) {
      forwardHeaders[key] = req.headers[key];
    }
  }

  // 构建 fetch 选项
  const fetchOptions = {
    method: req.method,
    headers: forwardHeaders,
  };

  // 有 body 的请求（POST, PUT, PATCH, DELETE）
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const rawBody = await getRawBody(req);
      if (rawBody.length > 0) {
        fetchOptions.body = rawBody;
      }
    } catch (err) {
      return res.status(400).json({ error: 'Failed to read request body', detail: err.message });
    }
  }

  // 发起代理请求
  try {
    const upstream = await fetch(targetUrl, fetchOptions);

    // 转发响应状态和关键 headers
    res.status(upstream.status);

    const passthroughHeaders = ['content-type', 'x-supabase-api-version', 'retry-after'];
    for (const h of passthroughHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 返回响应体
    const responseBody = await upstream.text();
    res.send(responseBody);
  } catch (err) {
    console.error('[proxy] Upstream fetch failed:', err);
    res.status(502).json({
      error: 'Proxy upstream request failed',
      detail: err.message,
      target: targetUrl,
    });
  }
}
