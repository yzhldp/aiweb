import { TOOL_META } from "@/lib/constants";
import type { AgentStepPlan } from "@/lib/types";

/**
 * 轻量级混合意图规划器：
 * 先通过规则识别学习意图（大模型调用成本低、结果可控），
 * 再把复合指令拆解为有依赖顺序的工具调用计划。
 */
export function planAgent(instruction: string, hasCode: boolean): AgentStepPlan[] {
  const text = instruction.trim();
  const wantsSummary =
    /复习|总结|梳理|整理|提炼|概括|归纳|考点|知识点|重点/.test(text);
  const wantsQuiz =
    /出题|练习|题目|测试|自测|测验|做题|几道|选择题|简答题|代码题/.test(text);
  const wantsReview =
    hasCode ||
    /批改|纠错|审查|代码审查|debug|调试|报错|语法错误|代码有问题|优化代码/.test(
      text
    );

  const tools: AgentStepPlan["tool"][] = [];
  if (wantsSummary) tools.push("summary");
  if (wantsQuiz) tools.push("quiz");
  if (wantsReview) tools.push("review");
  if (tools.length === 0) tools.push("answer");

  const descriptions: Record<AgentStepPlan["tool"], string> = {
    summary:
      "检索私有知识库，提炼核心概念、关键机制与易错点，生成结构化复习清单。",
    quiz:
      "基于检索到的课件片段自主命题，覆盖选择、简答与代码题，并生成标准解析。",
    review:
      "对提交的代码做语法与边界检查，定位逻辑漏洞，输出逐行讲解与优化建议。",
    answer:
      "先检索知识库中的相关片段，再结合上下文生成可溯源的专业课回答。",
  };

  return tools.map((tool, index) => ({
    id: `step-${index + 1}-${tool}`,
    tool,
    title: TOOL_META[tool].label,
    description: descriptions[tool],
  }));
}

export function buildAgentFinal(input: {
  steps: { title: string; status: string }[];
  mode: "deepseek" | "local";
  hasSources: boolean;
  hasQuiz: boolean;
}) {
  const completed = input.steps
    .filter((step) => step.status === "done")
    .map((step) => step.title);
  const failed = input.steps.filter((step) => step.status === "error");

  if (completed.length === 0) {
    return failed.length > 0
      ? `本次任务执行失败：${failed.map((step) => step.title).join("、")}。请稍后重试，或检查知识库与 API 配置。`
      : "本次任务没有产生可展示的结果，请调整指令后重试。";
  }

  const parts = [`已完成 ${completed.join(" → ")}。`];
  if (input.hasQuiz) {
    parts.push("练习题已在结果区生成，请先独立作答并提交批改，再查看标准解析。");
  }
  if (!input.hasSources) {
    parts.push(
      "提示：本次未从知识库检索到高度相关的片段，结果可能以通用模板为主。建议上传对应课程 PDF 后重试。"
    );
  }
  if (input.mode === "local") {
    parts.push(
      "当前为本地演示模式，结构化结果由检索片段与规则模板生成；配置 DEEPSEEK_API_KEY 后可获得更深入的推理式讲解。"
    );
  }
  return parts.join(" ");
}
