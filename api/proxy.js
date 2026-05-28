// Vercel Serverless Function: Supabase Proxy (ES Module)

/**
 * 关闭 Vercel 自动 body 解析，拿到原始 body
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  // 安全检查
  const ALLOWED_HOST = 'ltcouifrhmsmssicvsgz.supabase.co';
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

  const fetchOptions = {
    method: req.method,
    headers: forwardHeaders,
  };

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

  try {
    const upstream = await fetch(targetUrl, fetchOptions);

    res.status(upstream.status);

    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');

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
