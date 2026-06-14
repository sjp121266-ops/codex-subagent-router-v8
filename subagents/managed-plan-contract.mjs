import path from "node:path";

export const DISPLAY_BOARD_SCHEMA_VERSION = "display-board-v2";
export const MANAGED_INTERNAL_KEYS = ["judgeMode", "judgeModel", "candidateBudget", "cache", "cacheKey", "decisionTrace", "rejectedCandidates"];
export const MANAGED_INTERNAL_LEAK_PATTERN = /\b(judgeMode|judgeModel|candidateBudget|decisionTrace|rejectedCandidates|cacheKey|cache key|raw candidate scoring)\b/i;
export const MANAGED_SECRET_LEAK_PATTERN = /\b(sk-[A-Za-z0-9_-]{8,}|refresh_token\s*=|access_token\s*=|Authorization:\s*Bearer\s+|api[_-]?key\s*=|secret\s*=|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i;

export function validateManagedPlanContract(plan, options = {}) {
  const errors = [];
  const warnings = [];
  const addError = (condition, message) => { if (!condition) errors.push(message); };
  const addWarning = (condition, message) => { if (!condition) warnings.push(message); };
  const goalLoop = plan.goalLoop || [];
  const stageInputs = plan.stageInputs || {};
  const stageOutputs = plan.stageOutputs || {};
  addError(plan && typeof plan === "object", "managed plan must be an object");
  addError(plan.executionContract && typeof plan.executionContract === "object", "missing executionContract");
  addError(plan.planningBrief && typeof plan.planningBrief === "object", "missing planningBrief");
  addError(Array.isArray(goalLoop) && goalLoop.length > 0, "missing non-empty goalLoop");
  addError(plan.writeBoundaries && typeof plan.writeBoundaries === "object", "missing writeBoundaries");
  addError(Array.isArray(plan.parentResponsibilities) && plan.parentResponsibilities.length >= 3, "missing parent responsibilities");
  addError(plan.delegationReadiness && typeof plan.delegationReadiness === "object", "missing delegationReadiness");
  addError(plan.nextAction && typeof plan.nextAction === "object", "missing nextAction");
  addError(Array.isArray(plan.stageSkillLoadingOrder), "missing stageSkillLoadingOrder");
  addError(plan.displayBoard && typeof plan.displayBoard === "object", "missing displayBoard");
  addError(plan.openSourcePatterns && typeof plan.openSourcePatterns === "object", "missing openSourcePatterns");
  addError(plan.verificationBoard && typeof plan.verificationBoard === "object", "missing verificationBoard");
  addError(plan.contextLedger && typeof plan.contextLedger === "object", "missing contextLedger");
  addError(plan.projectGraph && typeof plan.projectGraph === "object", "missing projectGraph");
  addError(plan.executionAdapter && typeof plan.executionAdapter === "object", "missing executionAdapter");
  if (plan.executionAdapter) {
    addError(["native-custom-agent", "generic-role-bridge"].includes(plan.executionAdapter.mode), `invalid executionAdapter mode: ${plan.executionAdapter.mode}`);
    addError(["explorer", "worker"].includes(plan.executionAdapter.bridgeRole), `invalid executionAdapter bridgeRole: ${plan.executionAdapter.bridgeRole}`);
    addError(plan.executionAdapter.providerTransport || plan.executionAdapter.mode === "native-custom-agent", "executionAdapter missing providerTransport");
    addError(plan.executionAdapter.spawnInvocation && typeof plan.executionAdapter.spawnInvocation === "object", "executionAdapter missing spawnInvocation");
    if (plan.executionAdapter.spawnInvocation) {
      addError(plan.executionAdapter.spawnInvocation.fullContextFork === false, "spawnInvocation must disable full-context fork for Codex App role calls");
      addError(plan.executionAdapter.spawnInvocation.includeFullConversation === false, "spawnInvocation must disable full conversation context for Codex App role calls");
      addError(plan.executionAdapter.spawnInvocation.writeRequiredContextIntoTask === true, "spawnInvocation must require compact context in task body");
      addError(["explorer", "worker"].includes(plan.executionAdapter.spawnInvocation.role), `invalid spawnInvocation role: ${plan.executionAdapter.spawnInvocation.role}`);
      addError((plan.executionAdapter.spawnInvocation.forbiddenShapes || []).some((shape) => shape.id === "full-context-fork-plus-explicit-role"), "spawnInvocation must forbid full-context fork plus explicit role");
    }
  }
  for (const internal of MANAGED_INTERNAL_KEYS) {
    addError(!Object.prototype.hasOwnProperty.call(plan, internal), `managed plan leaks internal field: ${internal}`);
  }
  if (goalLoop.length) {
    addError(Object.keys(stageInputs).length === goalLoop.length, "stageInputs must cover every goal stage");
    addError(Object.keys(stageOutputs).length === goalLoop.length, "stageOutputs must cover every goal stage");
    addError((plan.stageSkillLoadingOrder || []).length === goalLoop.length, "stageSkillLoadingOrder must cover every goal stage");
    addError((plan.handoffContracts || []).length === goalLoop.length, "handoffContracts must cover every goal stage");
    addError((plan.verificationBoard?.stageChecks || []).length === goalLoop.length, "verificationBoard.stageChecks must cover every goal stage");
  }
  const readOnly = plan.executionContract?.writeIntent === "none";
  if (readOnly) {
    const stageText = JSON.stringify(goalLoop);
    addError(!/implement|mitigate|maintain/i.test(stageText), "read-only managed plan must not include implementation or mitigation stages");
    addError(!(plan.agentWorkPlan || []).some((card) => card.rosterRole === "implementer" && card.agent), "read-only managed plan must not assign an implementer");
  }
  if (plan.executionContract?.mustReview || plan.delegationReadiness?.state === "parent-review-required") {
    addError(Boolean(plan.verificationBoard?.summary?.requiresParentReview || goalLoop.some((stage) => /review|parent-review/i.test(`${stage.goal} ${stage.role}`))), "review-required plan must expose a visible review gate");
  }
  if (plan.displayBoard) {
    const boardText = JSON.stringify(plan.displayBoard);
    addError(/司南/.test(plan.displayBoard.headline || ""), "displayBoard headline must be Chinese and branded");
    addError(plan.displayBoard.schema?.version === DISPLAY_BOARD_SCHEMA_VERSION, "displayBoard missing schema version");
    addError(Array.isArray(plan.displayBoard.schema?.required) && plan.displayBoard.schema.required.includes("safetyPanel"), "displayBoard schema missing required fields");
    addError(Array.isArray(plan.displayBoard.userNarrative) && plan.displayBoard.userNarrative.length >= 3, "displayBoard missing user narrative");
    addError(Array.isArray(plan.displayBoard.goalBoard) && plan.displayBoard.goalBoard.length >= 1, "displayBoard missing goal board");
    addError(plan.displayBoard.safetyPanel && typeof plan.displayBoard.safetyPanel.requiresParentReview === "boolean", "displayBoard missing safety review state");
    addError(!MANAGED_INTERNAL_LEAK_PATTERN.test(boardText), "displayBoard leaks internal routing details");
    addError(!MANAGED_SECRET_LEAK_PATTERN.test(boardText), "displayBoard leaks secret-like content");
    addError(!/\/Users\/[^\s"'`，。；)]+/.test(boardText), "displayBoard leaks absolute user paths");
    for (const [field, limit] of [["headline", 180], ["userNarrative", 220], ["goalBoard", 180]]) {
      const target = field === "goalBoard" ? plan.displayBoard.goalBoard : plan.displayBoard[field];
      const values = Array.isArray(target) ? target.flatMap((item) => typeof item === "string" ? [item] : Object.values(item || {}).flat()) : [target];
      for (const value of values.flat().filter((item) => typeof item === "string")) {
        addError(value.length <= limit, `displayBoard ${field} item exceeds ${limit} characters`);
      }
    }
    addWarning(Boolean(plan.displayBoard.mermaidFlow), "displayBoard has no Mermaid flow");
  }
  if (plan.projectGraph) {
    const graphText = JSON.stringify(plan.projectGraph);
    addError(["ready", "missing", "disabled"].includes(plan.projectGraph.status), `projectGraph has invalid status: ${plan.projectGraph.status}`);
    addError(typeof plan.projectGraph.graphPath === "string" && !path.isAbsolute(plan.projectGraph.graphPath), "projectGraph graphPath must be relative");
    addError(!/\/Users\/[^\s"'`，。；)]+/.test(graphText), "projectGraph leaks absolute user paths");
    addError(!MANAGED_SECRET_LEAK_PATTERN.test(graphText), "projectGraph leaks secret-like content");
    addError(Number(plan.contextLedger?.projectGraphSummaryBytes || 0) >= 0, "contextLedger missing projectGraphSummaryBytes");
  }
  if (plan.openSourcePatterns) {
    addError(Array.isArray(plan.openSourcePatterns.designSources) && plan.openSourcePatterns.designSources.length >= 3, "openSourcePatterns missing design sources");
    addError(Array.isArray(plan.openSourcePatterns.selectedPatterns) && plan.openSourcePatterns.selectedPatterns.length >= 3, "openSourcePatterns missing selected patterns");
    addError(plan.openSourcePatterns.contextPolicy?.mode === "stage-output-only", "openSourcePatterns must define stage-output-only context policy");
    addError(Array.isArray(plan.openSourcePatterns.guardrailPlan?.beforeSpawn), "openSourcePatterns missing beforeSpawn guardrails");
    addError(Array.isArray(plan.openSourcePatterns.tracePlan?.events) && plan.openSourcePatterns.tracePlan.events.length >= 3, "openSourcePatterns missing trace events");
  }
  if (options.maxCompactTokens && plan.contextLedger?.estimatedInputTokens) {
    addError(plan.contextLedger.estimatedInputTokens <= options.maxCompactTokens, `managed plan exceeds compact token budget: ${plan.contextLedger.estimatedInputTokens}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
