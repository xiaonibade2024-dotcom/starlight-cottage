export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  const supabaseHost = 'ltcouifrhmsmsicvsgz.supabase.co';
  const path = req.url.replace(/^\/api\/sb\/?/, '');
  const targetUrl = 'https://' + supabaseHost + '/' + path;

  var headers = { host: supabaseHost };
  var forwardList = ['apikey', 'authorization', 'content-type', 'x-client-info', 'prefer', 'accept', 'accept-profile', 'content-profile', 'range', 'x-supabase-api-version'];
  for (var i = 0; i < forwardList.length; i++) {
    if (req.headers[forwardList[i]]) {
      headers[forwardList[i]] = req.headers[forwardList[i]];
    }
  }

  var body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    var response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body
    });

    var text = await response.text();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    var ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    var cr = response.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);

    return res.status(response.status).send(text);
  } catch (error) {
    return res.status(502).json({ error: 'proxy_error', message: error.message });
  }
}
