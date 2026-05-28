import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 自定义 fetch：将所有 Supabase 请求通过 /api/proxy 转发
 *
 * 注意：需要对 headers 进行 ASCII 安全处理，
 * 因为 HTTP headers 不允许非 ASCII 字符（如中文）
 */
function proxyFetch(url, options = {}) {
  const targetUrl = typeof url === 'string' ? url : url.url;
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

  // 克隆 options 并清理 headers 中的非 ASCII 字符
  const sanitizedOptions = { ...options };

  if (options.headers) {
    const newHeaders = {};
    let entries;

    if (options.headers instanceof Headers) {
      entries = Array.from(options.headers.entries());
    } else if (Array.isArray(options.headers)) {
      entries = options.headers;
    } else {
      entries = Object.entries(options.headers);
    }

    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        // 将非 ASCII 字符进行 URI 编码，确保 header 值只包含 ASCII
        newHeaders[key] = value.replace(/[^\x00-\xFF]/g, (ch) => encodeURIComponent(ch));
      } else {
        newHeaders[key] = value;
      }
    }

    sanitizedOptions.headers = newHeaders;
  }

  return fetch(proxyUrl, sanitizedOptions);
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
