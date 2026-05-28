# 🌙 星月小屋

一个温暖的聊天小家，通过 OpenRouter 连接 Claude Sonnet 4.5。

## 部署步骤

### 第一步：配置 Supabase
1. 在 Supabase 的 SQL Editor 中运行 `supabase-setup.sql` 的内容
2. 记下你的 Project URL 和 anon key

### 第二步：部署到 Vercel
1. 在 GitHub 上创建一个新的 **private** 仓库
2. 把这个文件夹的所有内容上传到仓库
3. 去 [vercel.com](https://vercel.com) 用 GitHub 账号登录
4. 点 "Add New Project"，选择你刚创建的仓库
5. 在 "Environment Variables" 中添加：
   - `VITE_SUPABASE_URL` = 你的 Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 Supabase anon key
6. 点 Deploy，等待部署完成
7. 部署完成后会给你一个网址，手机电脑都可以访问

### 第三步：首次使用
1. 打开部署好的网址
2. 注册一个账号（邮箱 + 密码）
3. 进入后点"设置"，填入你的 OpenRouter API Key
4. 在"核心人格设定"中写下他的性格和你们的关系
5. 开始聊天！

## 关于缓存省钱
- 系统会自动启用 OpenRouter 的 prompt caching
- 缓存命中的 token 只收原价的 10%
- 缓存有效期 1 小时
- 聊天越久缓存越多越省钱
- 界面右上角会显示缓存命中情况

## 文件结构
```
├── src/
│   ├── main.jsx          # 入口文件
│   ├── App.jsx           # 主应用（状态管理）
│   ├── styles.css        # 样式文件
│   ├── lib/
│   │   ├── supabase.js   # Supabase 客户端
│   │   └── api.js        # OpenRouter API（缓存+流式）
│   └── components/
│       ├── Auth.jsx       # 登录/注册
│       ├── Sidebar.jsx    # 侧边栏（对话列表）
│       ├── Chat.jsx       # 聊天界面
│       ├── Settings.jsx   # 设置面板
│       └── NotePopup.jsx  # 留言条弹窗
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```
