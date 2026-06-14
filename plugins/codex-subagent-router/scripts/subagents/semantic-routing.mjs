function projectGraphMayInfluence(taskKind, projectSignals, hasExplicitSecurityRisk) {
  return Boolean(projectSignals) && taskKind !== "content-marketing" && !hasExplicitSecurityRisk;
}

export function applyProjectSignalsToTaskKind(task, taskKind, projectSignals, options = {}) {
  if (!projectGraphMayInfluence(taskKind, projectSignals, Boolean(options.hasExplicitSecurityRisk))) return taskKind;
  if (projectSignals.isChromeExtension && /manifest|popup|extension|插件/i.test(task)) return "chrome-extension-qa";
  if (projectSignals.isAndroid && /android|gradle|apk|测试|检查|验证/i.test(task)) return "android-qa";
  if (projectSignals.isFrontend && /性能|首屏|ui|页面|component|组件|test|测试|build|构建/i.test(task)) return "web-app-qa";
  return taskKind;
}

export function projectBoostForAgent(agent, task, taskKind, projectSignals) {
  if (!projectGraphMayInfluence(taskKind, projectSignals, false)) return { boost: 0, reason: "" };
  const text = `${agent.name} ${agent.displayName || ""} ${agent.description || ""} ${agent.category || ""}`.toLowerCase();
  let boost = 0;
  const reasons = [];
  if (projectSignals.isFrontend && /frontend|react|ui|browser|web/.test(text)) {
    boost += /test|测试|qa|检查|验证/i.test(task) ? 24 : 34;
    reasons.push("project graph detected frontend framework");
  }
  if (projectSignals.isBackend && /backend|api|server|architect|security/.test(text)) {
    boost += /auth|鉴权|security|权限/i.test(task) ? 34 : 26;
    reasons.push("project graph detected backend framework");
  }
  if (projectSignals.isChromeExtension && /browser|frontend|test|qa|code-mapper/.test(text)) {
    boost += /test-automator|browser-debugger|qa-expert|frontend-developer|code-mapper/.test(text) ? 82 : 38;
    reasons.push("project graph detected Chrome extension manifest");
  }
  if (projectSignals.isAndroid && /android|mobile|test|qa/.test(text)) {
    boost += 38;
    reasons.push("project graph detected Android or Gradle project");
  }
  if (projectSignals.isIos && /ios|swift|mobile/.test(text)) {
    boost += 34;
    reasons.push("project graph detected Swift project");
  }
  if (projectSignals.hasTests && /test|qa|automation/.test(text) && /test|测试|验证|coverage|覆盖/i.test(task)) {
    boost += 24;
    reasons.push("project graph detected existing tests");
  }
  return { boost, reason: reasons.join("; ") };
}

export function projectPreferredAgentNames(task, taskKind, projectSignals, options = {}) {
  if (!projectGraphMayInfluence(taskKind, projectSignals, Boolean(options.hasExplicitSecurityRisk))) return [];
  const names = [];
  if (projectSignals.isChromeExtension && /manifest|popup|extension|插件/i.test(task)) names.push("test-automator", "frontend-developer", "browser-debugger", "qa-expert", "code-mapper");
  if (projectSignals.isAndroid && /gradle|android|apk|测试|检查|验证/i.test(task)) names.push("test-automator", "qa-expert", "mobile-developer", "code-mapper");
  if (projectSignals.isFrontend && /性能|首屏|ui|页面|component|组件|test|测试/i.test(task)) names.push("frontend-developer", "test-automator", "browser-debugger", "qa-expert");
  if (projectSignals.isBackend && /api|接口|auth|鉴权|server|后端|test|测试/i.test(task)) names.push("backend-developer", "security-auditor", "test-automator", "reviewer");
  return [...new Set(names)];
}
