import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 自定义 fetch：将所有 Supabase 请求通过 /api/proxy 转发
 *
 * 关键点：
 * 1. 用 encodeURIComponent 编码整个目标 URL，避免查询参数冲突
 * 2. 其余 options（method, headers, body）原样传递给代理
 * 3. 代理会透传这些 headers 和 body 到 Supabase
 */
function proxyFetch(url, options = {}) {
  // url 可能是 Request 对象或字符串
  const targetUrl = typeof url === 'string' ? url : url.url;

  // 构造代理地址
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

  // 原样转发所有 fetch options
  return fetch(proxyUrl, options);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: proxyFetch,
  },
  auth: {
    // 如果你用的是 SSR 或有自定义 auth 流程可以调这里
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
