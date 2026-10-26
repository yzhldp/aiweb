export const APP_NAME = "CS-LearnMate";
export const APP_SUBTITLE = "计算机专业智能学习助手";

export const CHUNK_SIZE = 520;
export const CHUNK_OVERLAP = 90;
export const LOCAL_EMBEDDING_DIM = 768;
export const MIN_CHUNK_CHARS = 50;
export const DEFAULT_TOP_K = 5;
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 20);

export const CHAT_SUGGESTIONS = [
  {
    icon: "network",
    label: "TCP 为什么需要三次握手？",
    prompt: "TCP 建立连接为什么需要三次握手而不是两次？请结合知识库内容解释，并说明第三次握手的必要性。",
  },
  {
    icon: "cpu",
    label: "进程调度算法对比",
    prompt: "请对比 FCFS、SJF、时间片轮转和优先级调度算法的优缺点，并说明各自的适用场景。",
  },
  {
    icon: "database",
    label: "数据库事务的 ACID",
    prompt: "请解释数据库事务的 ACID 特性，并说明隔离级别分别解决了哪些并发问题。",
  },
  {
    icon: "tree",
    label: "B+ 树与 B 树的区别",
    prompt: "B+ 树和 B 树在结构上有什么区别？为什么数据库索引更常使用 B+ 树？",
  },
];

export const AGENT_PRESETS = [
  {
    title: "复习 + 自测",
    description: "自动生成考点总结，并配套一组练习题",
    icon: "book",
    instruction: "帮我复习进程调度的核心知识点，并出题练习。",
  },
  {
    title: "专项出题",
    description: "围绕指定知识点生成分难度题目",
    icon: "quiz",
    instruction: "针对 TCP 三次握手和四次挥手，出 5 道由浅入深的练习题，包含选择题和简答题。",
  },
  {
    title: "代码批改",
    description: "分析语法、逻辑与边界问题并讲解",
    icon: "code",
    instruction: "帮我批改下面这段代码，指出语法错误、逻辑漏洞，并逐行讲解。",
  },
];

export const CODE_TEMPLATES: Record<"C" | "Python", string> = {
  C: `#include <stdio.h>

int main() {
    int n = 5;
    int arr[n];
    for (int i = 0; i <= n; i++) {
        arr[i] = i * i;
    }
    printf("sum = %d\\n", arr[n]);
    return 0;
}`,
  Python: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

nums = [3, 1, 4, 1, 5]
print(quick_sort(nums)`,
};

export const DISCLAIMER =
  "AI 生成内容仅供学习参考，请以教材、课程原始课件与教师要求为准。";

export const TOOL_META = {
  summary: {
    label: "考点总结",
    description: "从私有知识库提炼核心考点与易错点",
  },
  quiz: {
    label: "智能出题",
    description: "基于课件内容生成分层练习与标准解析",
  },
  review: {
    label: "代码批改",
    description: "识别语法、逻辑与边界问题并给出优化建议",
  },
  answer: {
    label: "知识问答",
    description: "检索私有知识库并生成可溯源的回答",
  },
} as const;
