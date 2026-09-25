# 参与贡献

感谢你有兴趣参与画境。本文档说明如何报告问题、提交改动。

## 项目定位

画境是一个**零依赖、无构建步骤**的本地工具：

- `ai-image-generator.html` —— 整个应用（HTML + CSS + 原生 JS 单文件，含中英双语 i18n）
- `main.js` —— 本地服务，只使用 Node 内置模块，负责托管页面并转发接口请求

没有打包、没有框架、没有第三方运行时依赖。贡献门槛因此很低：改完直接 `npm start`、刷新页面即可验证。

## 环境要求

- Node.js >= 18
- 不需要 `npm install`（项目零依赖）

```bash
npm start          # 启动本地服务，默认 http://127.0.0.1:8787
node main.js 9000  # 换端口
```

## 报告问题

提交 Issue 前请先搜索是否已有同类问题。Bug 报告请尽量包含：

- 操作系统与浏览器版本
- Node 版本（`node -v`）
- 复现步骤
- 页面「详情」中展示的请求摘要，或控制台报错
- 期望行为与实际行为

> **安全提醒**：请勿在 Issue、截图或日志中粘贴真实的 API Key。所有 `sk-` 开头的字符串都应打码。

## 提交改动

1. Fork 本仓库，从 `main` 拉出分支：`git checkout -b fix/xxx`
2. 改动并在本地验证（见下方清单）
3. 提交，建议采用 Conventional Commits：`fix: 修正 xxx`、`feat: 支持 xxx`、`docs: 更新 xxx`
4. 发起 Pull Request，说明动机、改动点与验证方式

## 代码约定

- **不要引入前端框架或构建工具**，项目会继续保持单文件、无构建。
- **不要引入运行时依赖**，`main.js` 请只使用 Node 内置模块。
- `main.js` 保持 CommonJS（`require`）风格。
- 内联脚本必须是合法且可解析的 JS（CI 会做语法检查）。

### 双语 i18n（最容易漏）

页面所有面向用户的文案都要**同时存在于两处**：

1. HTML 标签上的 `data-i18n` / `data-i18n-html` 属性写**中文默认值**
2. 文件底部 `I18N` 对象里的 `zh` 与 `en` 两份字典补上同一个 key

只补一份，切到另一种语言就会露出原始 key。新增文案后请务必检查中英是否对齐。

### 本地验证清单

```bash
node --check main.js    # 本地服务语法
npm start               # 启动后打开 http://127.0.0.1:8787
```

提交前确认：

- [ ] 首页 / 使用说明 / 关于作者 / 控制台 四个视图都能正常切换
- [ ] 中英文切换后没有出现未翻译的 key
- [ ] 生成、参考图上传、尺寸联动等既有功能未被破坏

## Skill 提示词模板

`skills/` 目录存放 SKILL.md 格式的提示词模板。想贡献模板，新增一个 `.md` 文件即可，YAML frontmatter 中的 `name` / `description` 会被页面读取并展示。

## 行为准则

参与本项目即表示你同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

---

## Contributing (English)

HuaJing is a **zero-dependency, no-build-step** local tool: the entire app lives
in `ai-image-generator.html`, and `main.js` is a local server built only on Node
built-in modules.

- **Requirements**: Node.js >= 18. No `npm install` needed.
- **Run it**: `npm start`, then open http://127.0.0.1:8787.
- **Bug reports**: include OS, browser, Node version, reproduction steps, and the
  request summary from the "Details" panel. **Never paste a real API key** — mask
  every `sk-` string.
- **Pull requests**: fork the repo, branch off `main`, and describe the motivation
  and how you verified the change.
- **Please do not add frameworks, build tools, or runtime dependencies.** The
  project is intentionally one HTML file plus a zero-dependency server.
- **i18n**: every user-facing string must be added to the markup default *and* to
  both the `zh` and `en` dictionaries in the `I18N` object.

By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
