export default async function handler(req, res) {
  const supabaseUrl = 'https://ltcouifrhmsmsicvsgz.supabase.co';
  const path = req.url.replace(/^\/api\/sb\/?/, '');
  const targetUrl = `${supabaseUrl}/${path}`;

  const forwardHeaders = {};
  const skipHeaders = ['host', 'connection', 'transfer-encoding'];
  for (const [key, value] of Object.entries(req.headers)) {
    if (!skipHeaders.includes(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  }
  forwardHeaders['host'] = 'ltcouifrhmsmsicvsgz.supabase.co';

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    if (chunks.length > 0) {
      body = Buffer.concat(chunks);
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body,
    });

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (key !== 'transfer-encoding' && key !== 'content-encoding') {
        responseHeaders[key] = value;
      }
    });

    const data = await response.arrayBuffer();
    
    for (const [key, value] of Object.entries(responseHeaders)) {
      res.setHeader(key, value);
    }
    
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    res.status(502).json({ error: 'proxy_error', message: error.message });
  }
}

export const config = {
  api: { bodyParser: false }
};
