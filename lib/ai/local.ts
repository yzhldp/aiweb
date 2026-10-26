import { stripDocumentExt } from "@/lib/rag/chunk";
import { tokenizeForSearch } from "@/lib/rag/embedding";
import type {
  CodeIssue,
  CodeReviewPayload,
  IssueSeverity,
  QuizOption,
  QuizPayload,
  QuizQuestion,
  Source,
  SummaryPayload,
} from "@/lib/types";

interface RankedSentence {
  text: string;
  source: Source;
  sourceIndex: number;
  score: number;
}

const GENERIC_TERMS = new Set([
  "一个",
  "一种",
  "一种方法",
  "本次",
  "主要",
  "关键",
  "重要",
  "基本",
  "具体",
  "相关",
  "内容",
  "过程",
  "方法",
  "情况",
  "问题",
  "可以",
  "需要",
  "必须",
  "包括",
  "通过",
  "采用",
  "具有",
  "属于",
  "表示",
  "称为",
  "用于",
  "由于",
  "因此",
  "如果",
  "但是",
  "并且",
  "我们",
  "它们",
  "这些",
  "那些",
  "其中",
  "方面",
  "部分",
  "以下",
  "上述",
  "通常",
  "往往",
  "一般",
  "同时",
  "然后",
  "最后",
  "首先",
  "其次",
  "例如",
  "比如",
  "注意",
  "可以这样",
]);

const FALLBACK_DISTRACTORS = [
  "进程控制块",
  "时间片轮转",
  "三次握手",
  "B+ 树",
  "MVCC",
  "红黑树",
  "拥塞窗口",
  "聚簇索引",
  "拓扑排序",
  "死锁避免",
  "事务隔离级别",
  "邻接矩阵",
  "快速排序",
  "页表",
  "快重传",
  "最左前缀原则",
];

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；!?;])|\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 12 && item.length <= 420);
}

export function extractTopic(instruction: string, sources: Source[] = []): string {
  const cleaned = instruction
    .replace(/[，。！？、；：,.!?;:（）()]/g, " ")
    .replace(
      /帮我|请|麻烦|为我|我要|我想|需要|想要|一下|复习|总结|梳理|整理|提炼|概括|归纳|生成|出题|练习|测试|自测|题目|几道|道题|根据|针对|结合|课件|知识库|内容|并|然后|最后|核心|相关|知识点|考点|代码|批改|审查|讲解|分析|要求|专项|由浅入深|包含|选择题|简答题|代码题|这|那|的/g,
      " "
    )
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length >= 2) return cleaned.slice(0, 28);
  if (sources[0]) {
    const parts = stripDocumentExt(sources[0].docName).split(/[·-]/);
    return parts[parts.length - 1]?.trim() || "本次学习主题";
  }
  return "本次学习主题";
}

function weightsFor(text: string) {
  const map = new Map<string, number>();
  for (const { token, weight } of tokenizeForSearch(text)) {
    map.set(token, Math.max(map.get(token) ?? 0, weight));
  }
  return map;
}

function relevance(text: string, queryWeights: Map<string, number>) {
  if (queryWeights.size === 0) return 0;
  const textWeights = weightsFor(text);
  let total = 0;
  let matched = 0;
  for (const [token, weight] of queryWeights) {
    total += weight;
    if (textWeights.has(token)) matched += weight;
  }
  return total > 0 ? matched / total : 0;
}

export function rankSentences(
  sources: Source[],
  query: string,
  limit = 10
): RankedSentence[] {
  const queryWeights = weightsFor(query);
  const seen = new Set<string>();
  const ranked: RankedSentence[] = [];

  sources.forEach((source, sourceIndex) => {
    for (const sentence of splitSentences(source.content)) {
      const normalized = sentence.replace(/[\s，。；！？、]/g, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const score =
        relevance(sentence, queryWeights) * 0.75 + source.score * 0.25;
      ranked.push({ text: sentence, source, sourceIndex, score });
    }
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

function clip(text: string, max = 160) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const boundary = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("；"),
    slice.lastIndexOf("，")
  );
  return `${boundary > max * 0.5 ? slice.slice(0, boundary + 1) : slice}…`;
}

function clipAround(text: string, term: string, max = 180) {
  if (text.length <= max) return text;
  const index = text.indexOf(term);
  if (index < 0) return clip(text, max);
  const start = Math.max(0, index - 65);
  const end = Math.min(text.length, index + term.length + 95);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${
    end < text.length ? "…" : ""
  }`;
}

function uniquePush(list: string[], value: string) {
  const normalized = value.trim();
  if (!normalized) return;
  if (list.some((item) => item === normalized)) return;
  list.push(normalized);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const array = [...items];
  let state = seed || 1;
  for (let i = array.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function noSourceAnswer(question: string) {
  return `## 暂未检索到可靠依据

知识库中没有与「${question.slice(
    0,
    60
  )}」直接相关的内容，为了避免编造，我不会脱离课件作答。

### 建议你这样做

1. 前往 **知识库** 上传对应课程的 PDF 课件，系统会自动完成解析、切片与向量化；
2. 提问时补充课程名或章节名，例如“操作系统第 4 章中的时间片轮转”；
3. 如果只是体验功能，可以在知识库页面点击 **载入示例课件**，体验完整的 RAG 流程。

> 当前为本地演示模式（未配置 DEEPSEEK_API_KEY），以上为检索层的兜底提示。`;
}

export function buildLocalChatAnswer(question: string, sources: Source[]) {
  if (sources.length === 0) return noSourceAnswer(question);

  const ranked = rankSentences(sources, question, 9);
  if (ranked.length === 0) return noSourceAnswer(question);

  const isWhy = /为什么|为何|原因|机制|原理/.test(question);
  const isDiff = /区别|不同|对比|差异|比较/.test(question);
  const isSteps = /步骤|流程|过程|如何|怎么|实现|算法/.test(question);
  const heading = isWhy
    ? "机制与原因"
    : isDiff
      ? "关键差异"
      : isSteps
        ? "实现要点"
        : "核心回答";

  const first = ranked[0];
  const rest = ranked.slice(1, 6);
  const bullets = (rest.length > 0 ? rest : ranked).slice(0, 4);
  const sourceNames = [...new Set(sources.map((source) => source.docName))]
    .slice(0, 2)
    .map((name) => `《${stripDocumentExt(name)}》`)
    .join("、");

  const lines: string[] = [
    `> 当前为本地演示模式：以下回答由知识库检索与结构化模板生成，配置 \`DEEPSEEK_API_KEY\` 后可获得更自然的推理与讲解。`,
    "",
    `## ${heading}`,
    "",
    `${clip(first.text, 220)} [${first.sourceIndex + 1}]`,
    "",
    "### 关键依据",
    "",
    ...bullets.map(
      (item) => `- ${clip(item.text, 150)} [${item.sourceIndex + 1}]`
    ),
    "",
    "### 进一步理解",
    "",
    `结合 ${sourceNames || "知识库"} 的表述，可以把问题拆成“概念定义 → 适用条件 → 运行机制 → 边界情况”四层来理解。复习时建议先用自己的话复述上面的关键结论，再回到原文核对限定词，避免把相似概念混为一谈。`,
  ];

  if (ranked.length >= 2) {
    lines.push(
      "",
      `另一个容易忽略的点是：${clip(ranked[ranked.length - 1].text, 130)} [${
        ranked[ranked.length - 1].sourceIndex + 1
      }]`
    );
  }

  lines.push(
    "",
    "> 回答中的 [编号] 对应界面下方的原文来源，点击可展开核对。"
  );

  return lines.join("\n");
}

export function buildLocalSummary(
  instruction: string,
  sources: Source[]
): SummaryPayload {
  const topic = extractTopic(instruction, sources);
  if (sources.length === 0) {
    return {
      title: `${topic} · 考点总结`,
      overview:
        "知识库中暂未检索到与该任务直接相关的课件片段，暂时无法生成有依据的考点总结。请先上传对应课程 PDF，或换用更具体的章节关键词。",
      sections: [],
      keyTerms: [],
      pitfalls: [],
    };
  }

  const ranked = rankSentences(
    sources,
    `${instruction} 定义 概念 机制 特点 原理 区别 注意`,
    14
  );
  const used = new Set<string>();

  const pick = (predicate: (text: string) => boolean, count: number) => {
    const result: string[] = [];
    for (const item of ranked) {
      if (result.length >= count) break;
      if (!predicate(item.text)) continue;
      if (used.has(item.text)) continue;
      used.add(item.text);
      result.push(clip(item.text, 170));
    }
    return result;
  };

  const isDefinition = (text: string) =>
    /是|指|表示|称为|定义为|属于|用于|分为/.test(text);
  const isMechanism = (text: string) =>
    /通过|采用|实现|机制|流程|步骤|算法|过程|依赖|基于|利用|发生/.test(text);
  const isPitfall = (text: string) =>
    /注意|不能|必须|避免|区别|容易|误|异常|缺点|局限|关键|不要|可能|问题/.test(
      text
    );

  const definitions = pick(isDefinition, 3);
  const mechanisms = pick(isMechanism, 3);
  const pitfalls = pick(isPitfall, 3);

  const fill = (target: string[], count: number) => {
    for (const item of ranked) {
      if (target.length >= count) break;
      if (used.has(item.text)) continue;
      used.add(item.text);
      target.push(clip(item.text, 170));
    }
  };
  fill(definitions, 2);
  fill(mechanisms, 3);
  fill(pitfalls, 2);

  const sections = [
    { title: "核心概念", points: definitions },
    { title: "关键机制与流程", points: mechanisms },
    { title: "易错点与辨析", points: pitfalls },
  ].filter((section) => section.points.length > 0);

  const allSentences = ranked.map((item) => item.text).join("\n");
  const stopAcronyms = new Set([
    "NOT",
    "AND",
    "THE",
    "FOR",
    "WITH",
    "FROM",
    "INTO",
    "NULL",
    "TRUE",
    "FALSE",
  ]);
  const acronyms = [
    ...new Set(
      (allSentences.match(/\b[A-Z]{2,}[A-Za-z0-9+/-]*\b/g) ?? []).filter(
        (item) => !stopAcronyms.has(item)
      )
    ),
  ].slice(0, 4);
  const keyTerms: { term: string; explanation: string }[] = [];
  for (const acronym of acronyms) {
    const sentence = ranked.find((item) => item.text.includes(acronym));
    if (sentence) {
      keyTerms.push({
        term: acronym,
        explanation: clip(sentence.text, 110),
      });
    }
  }
  for (const item of ranked) {
    if (keyTerms.length >= 5) break;
    const match = item.text.match(
      /([\u4e00-\u9fff]{2,9})(?=是|指|表示|称为|用于|包括)/
    );
    const term = match?.[1]?.trim();
    if (!term || GENERIC_TERMS.has(term) || !isPlausibleTerm(term)) continue;
    if (keyTerms.some((entry) => entry.term === term)) continue;
    keyTerms.push({ term, explanation: clip(item.text, 110) });
  }
  if (keyTerms.length === 0) {
    keyTerms.push({
      term: topic,
      explanation: "当前检索片段的术语密度较低，建议结合原文进一步梳理。",
    });
  }

  const overviewParts = ranked.slice(0, 2).map((item) => clip(item.text, 120));
  const overview = overviewParts.join(" ");

  return {
    title: `${topic} · 考点总结`,
    overview:
      overview ||
      `围绕「${topic}」从课件中整理出的复习要点，建议结合原文核对细节。`,
    sections,
    keyTerms: keyTerms.slice(0, 6),
    pitfalls:
      pitfalls.length > 0
        ? pitfalls.map((item) => clip(item, 120))
        : [
            "相近概念较多，建议按“定义 → 适用条件 → 优缺点”对比记忆。",
            "答题时先写前提条件，再写结论，避免遗漏限定语。",
          ],
  };
}

interface ExtractedTerm {
  term: string;
  weight: number;
}

const BROKEN_TERM_SUFFIX =
  /(的|了|地|得|是|在|把|被|使|让|从|向|给|等|和|与|或|中|上|下|时|后|前)$/;
const BROKEN_TERM_PREFIX =
  /^(的|了|是|在|把|被|使|让|从|向|给|其|该|这|那|此|把|对|以|为)/;
const BROKEN_TERM_FRAGMENT =
  /的是|了的|在于|可以|我们|如图|如下|例如|因此|所以|如果|那么|其中|进行|一个|这种|这些|那些|主要|通过|采用|具有|属于|需要|必须|包含/;

function isPlausibleTerm(term: string): boolean {
  if (term.length < 2 || term.length > 12) return false;
  if (!/[\u4e00-\u9fffA-Za-z]/.test(term)) return false;
  if (/[_（）()，。；：、！？\s]/.test(term)) return false;
  if (BROKEN_TERM_SUFFIX.test(term) || BROKEN_TERM_PREFIX.test(term)) {
    return false;
  }
  if (BROKEN_TERM_FRAGMENT.test(term)) return false;
  if (/(.)\1/.test(term)) return false;
  if (term.length >= 5) {
    const seen = new Set<string>();
    for (let i = 0; i < term.length - 1; i++) {
      const bigram = term.slice(i, i + 2);
      if (seen.has(bigram)) return false;
      seen.add(bigram);
    }
  }
  return true;
}

function extractTerms(texts: string[]): ExtractedTerm[] {
  const text = texts.join("\n");
  const scores = new Map<string, number>();
  const add = (term: string, weight: number) => {
    const cleaned = term.trim();
    if (!isPlausibleTerm(cleaned)) return;
    if (GENERIC_TERMS.has(cleaned)) return;
    if (/^[\d\s.]+$/.test(cleaned)) return;
    scores.set(cleaned, (scores.get(cleaned) ?? 0) + weight);
  };

  for (const match of text.matchAll(/\b[A-Z]{2,}[A-Za-z0-9+/-]{0,8}\b/g)) {
    add(match[0], 3);
  }
  for (const match of text.matchAll(
    /([\u4e00-\u9fff]{2,9})(?=是|指|表示|称为|用于|包括|需要|必须|通过|采用|具有|属于|分为|包含)/g
  )) {
    add(match[1], 2);
  }
  for (const match of text.matchAll(
    /(?:的|和|与|及)([\u4e00-\u9fff]{2,8})(?=[，。；、：])/g
  )) {
    add(match[1], 0.7);
  }

  return [...scores.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight || b.term.length - a.term.length)
    .slice(0, 40);
}

function pickTerm(sentence: string, terms: ExtractedTerm[]): string | null {
  const candidates = terms
    .filter((item) => sentence.includes(item.term))
    .sort(
      (a, b) =>
        b.term.length - a.term.length ||
        b.weight - a.weight
    );
  if (candidates.length > 0) {
    const preferred = candidates.find((item) => item.term.length >= 3);
    return (preferred ?? candidates[0]).term;
  }
  return null;
}

function optionsFor(
  correct: string,
  terms: ExtractedTerm[],
  sentence: string,
  seed: number
): QuizOption[] {
  const pool = terms
    .map((item) => item.term)
    .filter(
      (term) =>
        term !== correct &&
        !sentence.includes(term) &&
        term.length >= 2 &&
        term.length <= 12
    );
  const fallback = FALLBACK_DISTRACTORS.filter(
    (term) => term !== correct && !pool.includes(term)
  );
  const distractors = seededShuffle([...pool, ...fallback], seed)
    .filter((term, index, array) => array.indexOf(term) === index)
    .slice(0, 3);

  while (distractors.length < 3) {
    const filler = FALLBACK_DISTRACTORS[distractors.length % FALLBACK_DISTRACTORS.length];
    if (filler !== correct && !distractors.includes(filler)) {
      distractors.push(filler);
    } else {
      distractors.push(`相关概念 ${distractors.length + 1}`);
    }
  }

  return seededShuffle([correct, ...distractors], seed + 17).map(
    (text, index) => ({
      key: String.fromCharCode(65 + index),
      text,
    })
  );
}

function buildChoiceFromSentence(
  item: RankedSentence,
  terms: ExtractedTerm[],
  index: number,
  topic: string
): QuizQuestion | null {
  const term = pickTerm(item.text, terms);
  if (!term) return null;

  const concise = clipAround(item.text, term, 190);
  const blanked = concise.replace(term, "____");
  if (blanked === concise) return null;

  const options = optionsFor(term, terms, concise, hashString(item.text) + index);
  const answer = options.find((option) => option.text === term)?.key ?? "A";

  return {
    id: `q${index + 1}`,
    type: "choice",
    question: `补全课件中的表述，空缺处应填入：\n「${blanked}」`,
    options,
    answer,
    explanation: `课件原文：“${clip(item.text, 200)}” 该内容来自《${
      item.source.docName
    }》第 ${item.source.page} 页。`,
    difficulty: index === 0 ? "基础" : index === 1 ? "基础" : "进阶",
    knowledge: topic,
  };
}

function buildConsistencyQuestion(
  item: RankedSentence,
  pool: RankedSentence[],
  index: number,
  topic: string
): QuizQuestion {
  const correctText = clip(item.text, 105);
  const distractors = seededShuffle(
    pool
      .filter((other) => other.text !== item.text)
      .map((other) => clip(other.text, 105))
      .filter((text) => text !== correctText),
    hashString(item.text) + index
  ).slice(0, 3);

  while (distractors.length < 3) {
    distractors.push(
      clip(
        pool[(index + distractors.length + 1) % Math.max(1, pool.length)]?.text ??
          "该描述与课件内容不一致",
        105
      )
    );
  }

  const options = seededShuffle(
    [correctText, ...distractors],
    hashString(item.text) + index + 3
  ).map((text, i) => ({ key: String.fromCharCode(65 + i), text }));
  const answer =
    options.find((option) => option.text === correctText)?.key ?? "A";

  return {
    id: `q${index + 1}`,
    type: "choice",
    question: `关于「${topic}」，下列哪一项与课件表述一致？`,
    options,
    answer,
    explanation: `正确项来自《${item.source.docName}》第 ${item.source.page} 页。其余选项与当前课件内容不匹配，注意区分相近概念。`,
    difficulty: "进阶",
    knowledge: topic,
  };
}

function codeQuestionFor(sources: Source[], topic: string): QuizQuestion {
  const corpus = `${topic} ${sources
    .map((source) => source.docName + source.content.slice(0, 200))
    .join(" ")}`;

  if (/进程|调度|操作系统|死锁|内存/.test(corpus)) {
    return {
      id: "q5",
      type: "code",
      question:
        "给定一组进程的到达时间与运行时间（均为非负整数），请用 Python 实现非抢占式短作业优先 SJF 调度，返回平均等待时间。要求处理 CPU 空闲的情况。",
      answer: `def sjf(processes):
    # processes: [(arrival, burst), ...]
    remaining = sorted(processes, key=lambda p: p[0])
    time = 0
    total_wait = 0
    completed = 0

    while remaining:
        ready = [p for p in remaining if p[0] <= time]
        if not ready:
            time = min(p[0] for p in remaining)
            continue

        arrival, burst = min(ready, key=lambda p: (p[1], p[0]))
        total_wait += time - arrival
        time += burst
        remaining.remove((arrival, burst))
        completed += 1

    return total_wait / len(processes) if processes else 0`,
      explanation:
        "非抢占式 SJF 每次从已到达进程中选择运行时间最短者；若当前无进程到达，需要把时间推进到下一个到达时刻，否则会错误累计等待时间。参考代码的时间复杂度为 O(n²)。",
      difficulty: "挑战",
      knowledge: "处理机调度 · SJF",
      language: "Python",
    };
  }

  if (/数据库|事务|索引|SQL|范式/.test(corpus)) {
    return {
      id: "q5",
      type: "code",
      question:
        "设有 students(id, name) 与 grades(student_id, course, score) 两张表。请编写 SQL：统计每名学生平均分，筛出平均分不低于 80 分的学生，并按平均分降序排列。说明适合建立什么索引。",
      answer: `SELECT s.id, s.name, AVG(g.score) AS avg_score
FROM students AS s
JOIN grades AS g ON g.student_id = s.id
GROUP BY s.id, s.name
HAVING AVG(g.score) >= 80
ORDER BY avg_score DESC;`,
      explanation:
        "先用 JOIN 关联两张表，再按学生分组聚合，HAVING 过滤聚合结果。建议在 grades(student_id, score) 上建立联合索引，既能加速连接，也有机会覆盖分数统计。",
      difficulty: "挑战",
      knowledge: "SQL 聚合 / 索引设计",
      language: "Python",
    };
  }

  if (/网络|TCP|UDP|协议|握手/.test(corpus)) {
    return {
      id: "q5",
      type: "code",
      question:
        "请用 Python 编写一个函数 check_handshake(events)，接收客户端/服务器发送的标志位序列（如 ['SYN', 'SYN-ACK', 'ACK']），判断它是否构成合法的 TCP 三次握手，并返回布尔值。",
      answer: `def check_handshake(events):
    expected = ["SYN", "SYN-ACK", "ACK"]
    normalized = [str(e).strip().upper().replace("+", "-") for e in events]
    return normalized == expected`,
      explanation:
        "合法三次握手的顺序是 SYN → SYN-ACK → ACK，且双方会同步初始序号。代码先规范化输入，再与期望序列比较；真实实现还应校验序号与 ACK 号。",
      difficulty: "挑战",
      knowledge: "TCP 连接管理",
      language: "Python",
    };
  }

  return {
    id: "q5",
    type: "code",
    question:
      "请用 Python 实现二叉树的层序遍历，返回按层组织的二维列表。要求使用队列，并说明时间复杂度。",
    answer: `from collections import deque

def level_order(root):
    if root is None:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result`,
    explanation:
      "BFS 使用队列逐层访问；每轮先记录当前队列长度，确保只处理当前层。每个结点入队、出队一次，时间复杂度 O(n)，空间复杂度 O(n)。",
    difficulty: "挑战",
    knowledge: "图的遍历 / BFS",
    language: "Python",
  };
}

export function buildLocalQuiz(
  instruction: string,
  sources: Source[]
): QuizPayload {
  const topic = extractTopic(instruction, sources);
  if (sources.length === 0) {
    return {
      title: `${topic} · 智能练习`,
      questions: [],
    };
  }

  const ranked = rankSentences(
    sources,
    `${instruction} 定义 概念 机制 特点 原理 区别 注意 算法`,
    18
  );
  const terms = extractTerms(ranked.map((item) => item.text));
  const questions: QuizQuestion[] = [];

  for (const item of ranked) {
    if (questions.length >= 3) break;
    const question = buildChoiceFromSentence(
      item,
      terms,
      questions.length,
      topic
    );
    if (question) questions.push(question);
  }

  let cursor = 0;
  while (questions.length < 3 && ranked.length > 0) {
    const item = ranked[cursor % ranked.length];
    const question = buildConsistencyQuestion(
      item,
      ranked,
      questions.length,
      topic
    );
    if (
      !questions.some(
        (existing) => existing.question === question.question
      )
    ) {
      questions.push(question);
    }
    cursor++;
    if (cursor > 8) break;
  }

  const shortAnswer = ranked
    .slice(0, 3)
    .map((item) => item.text)
    .join("；");
  questions.push({
    id: "q4",
    type: "short",
    question: `请简述「${topic}」的核心机制，并至少说明两个关键要点。`,
    answer: clip(shortAnswer, 420),
    explanation: `评分要点：概念准确、机制完整、能指出关键条件。参考答案由《${
      ranked[0]?.source.docName ?? "课件"
    }》等片段整理，建议对照原文核对限定词。`,
    difficulty: "进阶",
    knowledge: topic,
  });

  questions.push(codeQuestionFor(sources, topic));

  return {
    title: `${topic} · 智能练习`,
    course: stripDocumentExt(sources[0]?.docName ?? "计算机专业课"),
    questions: questions.slice(0, 5),
  };
}

/* ────────────────────────── 代码审查 ────────────────────────── */

function stripForBalance(code: string, language: "C" | "Python") {
  let output = "";
  let inString: string | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += "\n";
      } else {
        output += " ";
      }
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        output += "  ";
        i++;
      } else {
        output += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      output += char === "\n" ? "\n" : " ";
      continue;
    }
    if (char === "/" && next === "/" && language === "C") {
      inLineComment = true;
      output += "  ";
      i++;
      continue;
    }
    if (char === "/" && next === "*" && language === "C") {
      inBlockComment = true;
      output += "  ";
      i++;
      continue;
    }
    if (char === "#" && language === "Python") {
      inLineComment = true;
      output += " ";
      continue;
    }
    if (char === '"' || char === "'" || (char === "`" && language === "Python")) {
      inString = char;
      output += " ";
      continue;
    }
    output += char;
  }
  return output;
}

function lineOfIndex(code: string, index: number) {
  return code.slice(0, Math.max(0, index)).split("\n").length;
}

function balanceIssues(
  code: string,
  language: "C" | "Python"
): CodeIssue[] {
  const stripped = stripForBalance(code, language);
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { char: string; index: number }[] = [];
  const issues: CodeIssue[] = [];
  let reported = 0;

  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if ("([{".includes(char)) {
      stack.push({ char, index: i });
    } else if (")]}".includes(char)) {
      const top = stack.pop();
      if (!top || top.char !== pairs[char]) {
        issues.push({
          severity: "error",
          line: lineOfIndex(stripped, i),
          title: `括号不匹配：多余的 “${char}”`,
          detail: `第 ${lineOfIndex(
            stripped,
            i
          )} 行出现未配对的右括号 “${char}”，代码无法通过语法解析。`,
          suggestion: "检查缺失的左括号，或删除多余的右括号。",
        });
        reported++;
        break;
      }
    }
  }

  if (stack.length > 0 && reported === 0) {
    const top = stack[stack.length - 1];
    const symbol = top.char;
    issues.push({
      severity: "error",
      line: lineOfIndex(stripped, top.index),
      title: `括号未闭合：缺少 “${symbol === "(" ? ")" : symbol === "[" ? "]" : "}"}”`,
      detail: `第 ${lineOfIndex(
        stripped,
        top.index
      )} 行打开的 “${symbol}” 直到文件结束都没有闭合。`,
      suggestion: "补齐对应的右括号，并检查函数调用与代码块结构。",
    });
  }

  return issues;
}

function addIssue(
  issues: CodeIssue[],
  issue: CodeIssue
) {
  if (
    issues.some(
      (item) =>
        item.title === issue.title &&
        item.line === issue.line
    )
  ) {
    return;
  }
  issues.push(issue);
}

function reviewC(code: string, sources: Source[]): CodeReviewPayload {
  const lines = code.split("\n");
  const issues: CodeIssue[] = [];
  const knowledge = new Set<string>();

  issues.push(...balanceIssues(code, "C"));

  const arrays: {
    name: string;
    sizeExpr: string;
    numericSize?: number;
    declaredLine: number;
  }[] = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line) return;

    const arrayMatch = line.match(
      /\b(?:int|char|float|double|long|short|unsigned|signed|size_t|bool)\s+(\w+)\s*\[\s*([A-Za-z_]\w*|\d+)\s*\]/
    );
    if (arrayMatch) {
      const numeric = Number(arrayMatch[2]);
      arrays.push({
        name: arrayMatch[1],
        sizeExpr: arrayMatch[2],
        numericSize: Number.isFinite(numeric) ? numeric : undefined,
        declaredLine: lineNo,
      });
    }

    if (/\bgets\s*\(/.test(line)) {
      addIssue(issues, {
        severity: "error",
        line: lineNo,
        title: "使用了不安全的 gets()",
        detail: "gets() 不检查缓冲区长度，极易造成缓冲区溢出，已被 C11 标准移除。",
        suggestion: "改用 fgets(buffer, sizeof(buffer), stdin)，并处理末尾换行。",
      });
      knowledge.add("缓冲区溢出与安全输入");
    }

    if (/\b(strcpy|strcat|sprintf)\s*\(/.test(line)) {
      addIssue(issues, {
        severity: "warning",
        line: lineNo,
        title: "存在缓冲区溢出风险",
        detail: `${line.match(/\b(strcpy|strcat|sprintf)\b/)?.[1]} 不检查目标缓冲区容量。`,
        suggestion: "使用 strncpy / strncat / snprintf 等带长度限制的函数。",
      });
      knowledge.add("C 字符串与缓冲区安全");
    }

    const scan = line.match(
      /scanf\s*\([^,]+,\s*(?!&)([A-Za-z_]\w*)\s*\)/
    );
    if (scan) {
      addIssue(issues, {
        severity: "error",
        line: lineNo,
        title: "scanf 缺少取地址符 &",
        detail: `变量 ${scan[1]} 前缺少 &，scanf 会把变量值当作地址使用。`,
        suggestion: `改为 scanf(..., &${scan[1]})；数组名本身即地址，无需加 &。`,
      });
    }

    if (/\bif\s*\([^)]*(?<![=!<>])=(?!=)[^)]*\)/.test(line)) {
      addIssue(issues, {
        severity: "warning",
        line: lineNo,
        title: "if 条件中可能误用了赋值 =",
        detail: "条件表达式中的单个 = 是赋值，不是比较，可能导致条件恒真。",
        suggestion: "如果意图是比较，请改为 ==；如果确实是赋值，建议加括号明确表达。",
      });
    }

    const loop = line.match(
      /\bfor\s*\(\s*(?:int\s+|size_t\s+)?(\w+)\s*=\s*[^;]+;\s*\1\s*<=\s*([A-Za-z_]\w*|\d+)\s*;/
    );
    if (loop) {
      const loopVar = loop[1];
      const bound = loop[2];
      const body = lines
        .slice(index, Math.min(lines.length, index + 5))
        .join("\n");
      for (const array of arrays) {
        const sameSize =
          array.sizeExpr === bound ||
          (array.numericSize !== undefined && array.numericSize === Number(bound));
        if (!sameSize) continue;
        const access = new RegExp(
          `\\b${escapeRegExp(array.name)}\\s*\\[\\s*${escapeRegExp(loopVar)}\\s*\\]`
        );
        if (!access.test(body)) continue;
        addIssue(issues, {
          severity: "error",
          line: lineNo,
          title: `循环上界越界：${array.name}[${loopVar}]`,
          detail: `数组 ${array.name} 的容量为 ${array.sizeExpr}，合法下标是 0..${array.sizeExpr} - 1；循环条件使用 <= ${bound} 会让下标取到 ${bound}，产生越界写入。`,
          suggestion: `把循环条件改为 ${loopVar} < ${bound}，并检查循环体内对 ${array.name} 的下标计算。`,
        });
        knowledge.add("数组下标边界与循环不变式");
      }
    }
  });

  for (const array of arrays) {
    const access = new RegExp(
      `\\b${escapeRegExp(array.name)}\\s*\\[\\s*${escapeRegExp(
        array.sizeExpr
      )}\\s*\\]`,
      "g"
    );
    for (const match of code.matchAll(access)) {
      if (match.index === undefined) continue;
      const lineNo = lineOfIndex(code, match.index);
      if (lineNo === array.declaredLine) continue;
      addIssue(issues, {
        severity: "error",
        line: lineNo,
        title: `数组越界访问 ${array.name}[${array.sizeExpr}]`,
        detail: `数组 ${array.name} 的容量为 ${array.sizeExpr}，有效下标是 0 到 ${array.sizeExpr} - 1；访问 ${array.name}[${array.sizeExpr}] 会读写越界内存，结果未定义。`,
        suggestion: `若要访问最后一个元素，请使用 ${array.name}[${array.sizeExpr} - 1]；同时确认上游下标不会等于容量。`,
      });
      knowledge.add("数组下标边界与循环不变式");
    }
  }

  const missingSemicolon = lines.findIndex((raw) => {
    const line = raw.trim();
    return (
      /^(return|break|continue|printf|scanf|puts|malloc|free)\b/.test(line) &&
      !line.endsWith(";") &&
      !line.endsWith("{") &&
      !line.endsWith("}") &&
      !line.endsWith("\\")
    );
  });
  if (missingSemicolon >= 0) {
    addIssue(issues, {
      severity: "error",
      line: missingSemicolon + 1,
      title: "语句缺少分号",
      detail: `第 ${missingSemicolon + 1} 行的语句末尾缺少分号。`,
      suggestion: "在语句末尾补上 ; 后重新编译。",
    });
  }

  if (/\bmalloc\s*\(/.test(code) && !/\bfree\s*\(/.test(code)) {
    addIssue(issues, {
      severity: "warning",
      title: "动态内存可能泄漏",
      detail: "代码调用了 malloc 但没有对应的 free。",
      suggestion: "在所有退出路径上释放动态内存，或使用更安全的资源管理方式。",
    });
    knowledge.add("动态内存管理");
  }

  if (/\bwhile\s*\(\s*(1|true)\s*\)/.test(code) && !/\b(break|return)\b/.test(code)) {
    addIssue(issues, {
      severity: "warning",
      title: "死循环缺少退出条件",
      detail: "while(1) 循环中没有 break 或 return，程序可能无法终止。",
      suggestion: "补充明确的退出条件，或确认这是常驻循环并增加信号处理。",
    });
  }

  return finalizeReview({
    language: "C",
    code,
    issues,
    knowledge,
    sources,
    defaultScore: 92,
  });
}

function reviewPython(code: string, sources: Source[]): CodeReviewPayload {
  const lines = code.split("\n");
  const issues: CodeIssue[] = [];
  const knowledge = new Set<string>();

  issues.push(...balanceIssues(code, "Python"));

  let hasTab = false;
  let hasSpaceIndent = false;

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line) return;

    if (raw.startsWith("\t")) hasTab = true;
    if (raw.startsWith("    ")) hasSpaceIndent = true;

    if (/^print\s+[^(\s]/.test(line)) {
      addIssue(issues, {
        severity: "error",
        line: lineNo,
        title: "Python 3 的 print 需要括号",
        detail: "print 是函数而不是语句，缺少括号会引发 SyntaxError。",
        suggestion: "改为 print(变量或表达式)。",
      });
    }

    const control = line.match(
      /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/
    );
    if (control) {
      const withoutComment = line.split("#")[0].trim();
      if (!withoutComment.includes(":")) {
        addIssue(issues, {
          severity: "error",
          line: lineNo,
          title: `语句缺少冒号：${control[1]}`,
          detail: "Python 通过冒号标记代码块开始，缺少冒号会导致语法错误。",
          suggestion: "在条件或声明末尾补上 :，并检查下一行缩进。",
        });
      }
    }

    if (/^(if|elif|while)\b/.test(line) && /\b(if|elif|while)\b[^:]*[^=!<>]=[^=]/.test(line)) {
      addIssue(issues, {
        severity: "warning",
        line: lineNo,
        title: "条件表达式中使用了赋值 =",
        detail: "单个 = 是赋值操作，条件中通常应使用比较运算符 ==。",
        suggestion: "检查是否应写成 ==；在 Python 3.8+ 中如需赋值表达式应使用 :=。",
      });
    }

    if (/^except\s*:\s*$/.test(line)) {
      addIssue(issues, {
        severity: "warning",
        line: lineNo,
        title: "使用了裸 except",
        detail: "裸 except 会捕获包括 KeyboardInterrupt 在内的所有异常，可能掩盖真实错误。",
        suggestion: "捕获明确的异常类型，例如 except ValueError as error:。",
      });
      knowledge.add("异常处理与错误边界");
    }

    if (/range\s*\(\s*len\s*\(/.test(line)) {
      addIssue(issues, {
        severity: "info",
        line: lineNo,
        title: "可以用 enumerate 简化遍历",
        detail: "同时需要下标和元素时，range(len(seq)) 可读性较差。",
        suggestion: "改用 for index, value in enumerate(seq):。",
      });
    }

    const mutableDefault = line.match(
      /^def\s+\w+\s*\([^)]*=\s*(\[\]|\{\})\s*[,)]/
    );
    if (mutableDefault) {
      addIssue(issues, {
        severity: "warning",
        line: lineNo,
        title: "函数默认参数使用了可变对象",
        detail: "默认参数在函数定义时只创建一次，多次调用会共享同一个列表或字典。",
        suggestion: "默认值改为 None，并在函数体内创建新的容器。",
      });
      knowledge.add("Python 对象模型与默认参数");
    }

    if (/==\s*None|!=\s*None/.test(line)) {
      addIssue(issues, {
        severity: "info",
        line: lineNo,
        title: "与 None 比较建议使用 is",
        detail: "None 是单例对象，惯用写法是 is None / is not None。",
        suggestion: "将 == None 改为 is None，!= None 改为 is not None。",
      });
    }

    if (/^\s*(if|while)\s+True\s*:/.test(raw) && !/\b(break|return)\b/.test(code)) {
      addIssue(issues, {
        severity: "warning",
        line: lineNo,
        title: "死循环缺少退出条件",
        detail: "while True 循环中没有 break 或 return，程序可能无法终止。",
        suggestion: "补充明确的退出条件，避免程序卡死。",
      });
    }
  });

  if (hasTab && hasSpaceIndent) {
    addIssue(issues, {
      severity: "warning",
      title: "缩进混用了 Tab 与空格",
      detail: "混用缩进容易触发 TabError，也会让不同编辑器中的代码结构不一致。",
      suggestion: "统一使用 4 个空格缩进，并配置编辑器将 Tab 转为空格。",
    });
    knowledge.add("Python 缩进与代码块");
  }

  if (!/\bdef\s+\w+/.test(code) && code.trim().length > 400) {
    addIssue(issues, {
      severity: "info",
      title: "代码可以进一步模块化",
      detail: "当前代码较长但没有函数划分，复用与测试成本较高。",
      suggestion: "按职责拆分为小函数，保持单一职责并补充参数校验。",
    });
  }

  return finalizeReview({
    language: "Python",
    code,
    issues,
    knowledge,
    sources,
    defaultScore: 94,
  });
}

function finalizeReview(input: {
  language: "C" | "Python";
  code: string;
  issues: CodeIssue[];
  knowledge: Set<string>;
  sources: Source[];
  defaultScore: number;
}): CodeReviewPayload {
  const severityRank: Record<IssueSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  const issues = [...input.issues].sort((a, b) => {
    const rank = severityRank[a.severity] - severityRank[b.severity];
    if (rank !== 0) return rank;
    return (a.line ?? 9999) - (b.line ?? 9999);
  });

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const infos = issues.filter((issue) => issue.severity === "info").length;

  let score = input.defaultScore;
  score -= errors * 16;
  score -= warnings * 7;
  score -= infos * 2;
  score = Math.max(30, Math.min(100, score));

  const lines = input.code.split("\n");
  const lineNotes: { line: number; code: string; note: string }[] = [];
  const noteLines = new Set<number>();

  for (const issue of issues) {
    if (issue.line && !noteLines.has(issue.line)) {
      lineNotes.push({
        line: issue.line,
        code: lines[issue.line - 1]?.trim() ?? "",
        note: `${issue.title}：${issue.suggestion}`,
      });
      noteLines.add(issue.line);
    }
  }

  lines.forEach((raw, index) => {
    if (lineNotes.length >= 8) return;
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line || noteLines.has(lineNo)) return;
    let note = "";
    if (/^(def|class)\b/.test(line)) {
      note = "定义函数/类，关注职责边界、参数校验与返回值语义。";
    } else if (/^(for|while)\b/.test(line)) {
      note = "循环结构，重点检查终止条件、边界值与循环不变式。";
    } else if (/^(if|elif|else)\b/.test(line) || /^if\s*\(/.test(line)) {
      note = "条件分支，确认布尔表达式与所有边界情况都被覆盖。";
    } else if (/^return\b/.test(line)) {
      note = "返回结果，确认各分支返回类型一致且空输入有定义。";
    } else if (/printf|print\s*\(/.test(line)) {
      note = "输出语句，检查格式串与参数数量是否匹配。";
    } else if (/malloc|free/.test(line)) {
      note = "动态内存操作，确保申请与释放成对出现。";
    }
    if (note) {
      lineNotes.push({ line: lineNo, code: line, note });
      noteLines.add(lineNo);
    }
  });

  const summaryParts: string[] = [];
  if (issues.length === 0) {
    summaryParts.push("未发现明显的语法或边界问题，代码结构清晰。");
  } else {
    summaryParts.push(
      `共发现 ${errors} 个错误、${warnings} 个警告、${infos} 条改进建议。`
    );
    if (errors > 0) {
      summaryParts.push("建议先修复错误级问题，确保程序能够通过编译或解释执行。");
    } else if (warnings > 0) {
      summaryParts.push("代码可以运行，但仍存在边界与健壮性隐患，建议逐条处理警告。");
    }
  }
  if (input.sources.length > 0) {
    const docs = [...new Set(input.sources.map((source) => source.docName))]
      .slice(0, 2)
      .map((name) => `《${name}》`)
      .join("、");
    summaryParts.push(`可结合课件 ${docs} 复习相关知识点。`);
  }

  const knowledgePoints = [...input.knowledge];
  if (input.language === "C") {
    knowledgePoints.push("C 数组边界与内存安全", "编译期语法约束");
  } else {
    knowledgePoints.push("Python 语法结构", "边界条件与异常处理");
  }

  return {
    language: input.language,
    score,
    summary: summaryParts.join(" "),
    issues,
    lineNotes: lineNotes.slice(0, 10),
    knowledgePoints: [...new Set(knowledgePoints)].slice(0, 6),
  };
}

export function buildLocalCodeReview(input: {
  code: string;
  language: "C" | "Python";
  sources: Source[];
}): CodeReviewPayload {
  if (!input.code.trim()) {
    return {
      language: input.language,
      score: 0,
      summary:
        "未检测到可审查的代码。请在代码编辑器中粘贴需要批改的 C 或 Python 程序，再发起 Agent 任务。",
      issues: [
        {
          severity: "info",
          title: "尚未提供代码",
          detail: "代码审查工具需要完整的源代码才能定位语法与逻辑问题。",
          suggestion: "打开代码编辑器，粘贴代码后重新运行 Agent。",
        },
      ],
      lineNotes: [],
      knowledgePoints: ["代码调试流程"],
    };
  }
  return input.language === "C"
    ? reviewC(input.code, input.sources)
    : reviewPython(input.code, input.sources);
}
