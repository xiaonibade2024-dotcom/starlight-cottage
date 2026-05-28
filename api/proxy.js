export default async function handler(req, res) {
  var targetUrl = req.query.url;
  if (!targetUrl || !targetUrl.startsWith('https://ltcouifrhmsmsicvsgz.supabase.co')) {
    return res.status(400).json({ error: 'invalid url' });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  var headers = { host: 'ltcouifrhmsmsicvsgz.supabase.co' };
  var list = ['apikey','authorization','content-type','prefer','accept','content-profile','accept-profile','range','x-client-info'];
  for (var i = 0; i < list.length; i++) {
    if (req.headers[list[i]]) headers[list[i]] = req.headers[list[i]];
  }

  var body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    var r = await fetch(targetUrl, { method: req.method, headers: headers, body: body });
    var text = await r.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    var ct = r.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    var cr = r.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
