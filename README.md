# Daily English Flow 📝

**Daily English Flow** 是一款极简、专业的英语学习内容管理工具。它结合了 Google Gemini AI 的强大处理能力与 LeanCloud 的云端存储，旨在帮助用户高效地整理每日阅读材料并进行深度的单词记忆。

## ✨ 核心特性

- **🚀 AI 驱动的内容提取**: 
  - 支持通过文本、图片、PDF 或 URL 自动提取核心词汇。
  - AI 自动生成音标 (IPA)、中文释义及高质量例句。
  - 智能识别并加粗短文中的重点语言点。
- **🧠 交互式复习系统**: 
  - **递归式闪卡**: 采用“认识/模糊”逻辑，错误的单词会自动循环出现，直至掌握。
  - **多维视觉辅助**: 自动集成 Bing 缩略图，提供单词视觉记忆锚点。
  - **发音支持**: 集成浏览器语音合成 (TTS)，支持单词与例句朗读。
- **☁️ 云端同步与管理**: 
  - 接入 LeanCloud 数据库，实现数据的持久化存储与多端同步。
  - 管理员模式支持内容的增删改查及手动拖拽排序。
- **🔐 权限隔离**: 
  - **访客模式 (Guest)**: 沉浸式阅读与复习。
  - **管理模式 (Admin)**: 默认密码 `123456`，解锁内容创作与编辑功能。

## 🛠 技术栈

- **框架**: React 19 (via ESM)
- **样式**: Tailwind CSS (JIT CDN)
- **后端**: LeanCloud Storage
- **AI**: Google Gemini 2.5 Flash
- **路由**: HashRouter (兼容 GitHub Pages 静态环境)

## 🚀 部署与使用

### 1. 快速部署到 GitHub Pages
1. 创建一个新的 GitHub 仓库并将代码上传。
2. 前往仓库的 **Settings > Pages**。
3. 在 **Build and deployment** 下选择 `main` 分支并保存。
4. 稍等片刻即可通过 GitHub 提供的 URL 访问。

### 2. 权限说明
- 点击页面底部的 **Admin Login** 图标。
- 输入默认密码：`123456`。
- 您可以在 `App.tsx` 的 `LoginModal` 组件中修改此验证逻辑。

### 3. 环境配置
- 本项目依赖 Google Gemini API。请确保您的环境变量 `process.env.API_KEY` 已正确配置。
- **重要**: 请在 LeanCloud 控制台将您的域名添加至 **Web 安全域名** 白名单。

---

© 2024 Daily English Flow. 让英语学习回归纯粹。