export const DEFAULT_TASK_KIND_POLICY = {
  "web-app-qa": {
    keywords: [
      "vite|next\\.?js|react|vue|svelte|package\\.json|npm run|pnpm|yarn|vitest|jest|tsconfig|tailwind|web app|前端项目|网页项目|静态站点|无限画布|libtv画布|自动插件剪辑|open cut",
    ],
    preferredAgents: ["test-automator", "qa-expert", "frontend-developer", "browser-debugger", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "matched"],
  },
  "monorepo-wasm-qa": {
    keywords: [
      "monorepo|turbo|turborepo|wasm|webassembly|wasm-pack|rust|cargo|build:wasm|opencut-classic|workspace packages|分层验证|多栈",
    ],
    preferredAgents: ["test-automator", "qa-expert", "code-mapper", "devops-engineer", "build-engineer"],
    allowedPhases: ["planning", "research", "design", "debugging", "testing", "review", "matched"],
  },
  "chrome-extension-qa": {
    keywords: [
      "chrome extension|browser extension|manifest\\s*v?3|manifest\\.json|mv3|service_worker|service worker|content script|content-scripts|popup\\.html|popup\\.js|sidepanel|side panel|chrome 插件|谷歌浏览器插件|浏览器插件|扩展程序",
    ],
    preferredAgents: ["test-automator", "frontend-developer", "browser-debugger", "qa-expert", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "matched"],
  },
  "desktop-rpa-qa": {
    keywords: [
      "rpa|playwright|pyside6|qt_qpa_platform|offscreen|flow-smoke|flow smoke|pytest|桌面\\s*RPA|自动化控制台|扫码登录|隔离环境|浏览器隔离",
    ],
    preferredAgents: ["test-automator", "qa-expert", "debugger", "automation-engineer", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "matched"],
  },
  "desktop-automation-qa": {
    keywords: [
      "jianying|capcut|剪映|操控剪映|desktop automation|gui automation|pyautogui|uiautomation|appium|本地 GUI|桌面自动化",
    ],
    preferredAgents: ["test-automator", "qa-expert", "debugger", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "matched"],
  },
  "comfyui-workflow-qa": {
    keywords: [
      "comfyui|\\bcomfy\\b|workflow\\.json|validate\\s+workflows|模型检查|checkpoint|工作流验证",
    ],
    preferredAgents: ["test-automator", "qa-expert", "workflow-orchestrator", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "debugging", "testing", "review", "matched"],
  },
  "credential-tooling": {
    keywords: [
      "oauth|token|credential|refresh_token|access_token|auth\\.json|auth cache|get_token|凭证|令牌|登录态|密钥|secret|不要输出\\s*token",
    ],
    preferredAgents: ["security-auditor", "security-engineer", "reviewer", "code-mapper"],
    allowedPhases: ["planning", "research", "debugging", "testing", "review", "matched"],
  },
  "integration-bot-qa": {
    keywords: [
      "feishu|lark|飞书|机器人|bot|webhook|callback|oauth app|openapi|cli integration|connector|bridge|coze|工作流|音乐寻找|集成验证",
    ],
    preferredAgents: ["test-automator", "qa-expert", "backend-developer", "api-designer", "code-mapper"],
    allowedPhases: ["planning", "research", "debugging", "testing", "review", "matched"],
  },
  "static-artifact-inspection": {
    keywords: [
      "static artifact|static html|html 产物|报价 html|报价html|超级瑞宝文档|抖音整体流程|抖音违禁词|视频反推|客户视频|宣传海报|ppt|obsidian|资料目录|文档目录|只做文件组织|HTML 引用结构|文件组织",
    ],
    preferredAgents: ["code-mapper", "docs-researcher", "documentation-engineer", "research-analyst"],
    allowedPhases: ["planning", "research", "testing", "review", "matched"],
  },
  "empty-sample-blocker": {
    keywords: [
      "empty directory|empty sample|no visible files|空目录|没有文件|无可见文件|只记录 blocker|RPA 空目录",
    ],
    preferredAgents: ["code-mapper", "qa-expert", "docs-researcher"],
    allowedPhases: ["planning", "research", "testing", "review", "matched"],
  },
  "artifact-inspection": {
    keywords: [
      "transcription|transcript|srt|字幕|转录|语音转录|纪要|音频|m4a|wav|产物|artifact|现有\\s*\\.txt|现有\\s*\\.srt|资料与产出|产物结构",
    ],
    preferredAgents: ["docs-researcher", "documentation-engineer", "research-analyst", "code-mapper"],
    allowedPhases: ["planning", "research", "testing", "review", "matched"],
  },
  "android-qa": {
    keywords: [
      "android|安卓|gradle|apk|adb|emulator|模拟器|真机|connectedDebugAndroidTest|instrumentation|仪器测试|androidTest|CameraX|logcat|安装\\s*APK|截图",
    ],
    preferredAgents: ["test-automator", "qa-expert", "mobile-developer", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "matched"],
  },
  "release-publishing": {
    keywords: [
      "readme|changelog|release notes?|release\\b|publish|publishing|public repo|github readme|installation steps|发布说明|发布|公开仓库|仓库说明|安装步骤|版本说明|致谢",
    ],
    preferredAgents: ["documentation-engineer", "technical-writer", "github-expert", "release-manager", "docs-researcher"],
    allowedPhases: ["planning", "research", "review", "deployment", "matched"],
  },
  "repo-maintenance": {
    keywords: [
      "doctor|report|config|configuration|cache|snapshot|registry|cleanup|maintenance|dependency|sync|健康状态|配置|缓存|快照|注册表|维护|清理|同步|依赖",
    ],
    preferredAgents: ["code-mapper", "architect-reviewer", "documentation-engineer", "devops-engineer"],
    allowedPhases: ["planning", "research", "design", "implementation", "testing", "review", "matched"],
  },
  "research-only": {
    keywords: [
      "research only|read[- ]?only research|only research|official docs|source verification|do not edit|do not write|no code changes|不要改代码|不要修改|只调研|仅调研|只读调研|官方文档|查资料|只读",
    ],
    preferredAgents: ["docs-researcher", "research-analyst", "code-mapper", "reviewer"],
    allowedPhases: ["planning", "research", "review", "matched"],
  },
  "incident-response": {
    keywords: [
      "incident|outage|production log|prod log|rollback|hotfix|sev[0-9]?|downtime|sre|线上事故|生产事故|线上故障|生产故障|线上日志|生产日志|回滚|紧急修复|宕机|告警",
    ],
    preferredAgents: ["sre-engineer", "incident-responder", "debugger", "security-engineer", "devops-engineer"],
    allowedPhases: ["planning", "research", "debugging", "testing", "review", "implementation", "matched"],
  },
  "content-marketing": { keywords: ["小红书|xiaohongshu|rednote|red note|抖音|douyin|tiktok|bilibili|b\\s*站|哔哩|微信公号|公众号|wechat official|微博|weibo|知乎|zhihu|内容营销|内容策略|社媒|种草|爆款笔记|笔记结构|视频脚本|短视频|直播话术|带货脚本|选题策略"], preferredAgents: ["xiaohongshu-specialist", "douyin-strategist", "bilibili-content-strategist", "wechat-official-account-manager", "weibo-strategist", "zhihu-strategist", "content-creator", "social-media-strategist"], allowedPhases: ["planning", "research", "design", "review", "matched"] },
  "orchestration-design": {
    keywords: [
      "subagent-router|router|routing|dispatch|scheduler|scheduling|handoff|fallback|quality gate|judge matrix|goal mode|agent routing|multi-agent|multiple subagents|调度|调度器|路由器|路由|调用速度|调用的速度|算法调度|质量门|回退|委派|编排|多代理|多智能体|多个子代理|goal 模式",
    ],
    preferredAgents: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "review", "testing", "matched"],
  },
  "product-analysis": {
    keywords: [
      "adoption|churn|funnel|market|用户体验|用户问题|用户|产品|需求|商业|增长|定位|留存|转化|漏斗",
    ],
    preferredAgents: ["product-manager", "research-analyst", "risk-manager", "business-analyst"],
    allowedPhases: ["planning", "research", "review", "matched"],
  },
  "engineering-analysis": {
    keywords: [
      "review|audit|analy[sz]e|inspect|diagnose|map|评审|审查|审计|分析|检查|诊断",
    ],
    preferredAgents: ["reviewer", "architect-reviewer", "code-mapper", "debugger"],
    allowedPhases: ["planning", "research", "design", "debugging", "testing", "review", "matched"],
  },
  "engineering-execution": {
    keywords: [
      "fix|implement|build|create|edit|update|refactor|optimi[sz]e|improve|iterate|execute|修复|实现|创建|修改|改|写|补齐|重构|优化|完善|迭代|执行",
    ],
    preferredAgents: [],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "deployment", "matched"],
  },
};

export const DEFAULT_HIGH_RISK_RULES = [
  { id: "security", pattern: "security|vulnerability|permission|secret|privacy|compliance|xss|csrf|sql injection|安全|漏洞|权限|隐私|合规|威胁" },
  { id: "auth", pattern: "auth|oauth|token|credential|鉴权|认证|凭证|令牌" },
  { id: "production", pattern: "production|prod\\b|线上|生产" },
  { id: "current-diff", pattern: "current diff|当前\\s*diff|git diff|uncommitted|working tree|当前分支" },
  { id: "incident", pattern: "incident|outage|rollback|downtime|线上事故|生产事故|故障|回滚|宕机" },
];
