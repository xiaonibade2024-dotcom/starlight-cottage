import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 自定义 fetch：将所有 Supabase 请求通过 /api/proxy 转发
 *
 * 只转发 Supabase 需要的 headers，避免非 ASCII 字符导致 fetch 报错
 */
function proxyFetch(url, options = {}) {
  const targetUrl = typeof url === 'string' ? url : url.url;
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

  // 从原始 headers 中提取值
  let source = {};
  if (options.headers instanceof Headers) {
    for (const [k, v] of options.headers.entries()) {
      source[k.toLowerCase()] = v;
    }
  } else if (options.headers && typeof options.headers === 'object') {
    for (const [k, v] of Object.entries(options.headers)) {
      source[k.toLowerCase()] = v;
    }
  }

  // 只转发 Supabase 实际需要的 headers（这些都是 ASCII 安全的）
  const allowedKeys = [
    'content-type',
    'apikey',
    'authorization',
    'prefer',
    'accept',
    'accept-profile',
    'content-profile',
    'x-supabase-api-version',
  ];

  const safeHeaders = {};
  for (const key of allowedKeys) {
    if (source[key]) {
      safeHeaders[key] = source[key];
    }
  }

  return fetch(proxyUrl, {
    method: options.method || 'GET',
    headers: safeHeaders,
    body: options.body,
  });
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: proxyFetch,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
