import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  FileText,
  GitBranch,
  Layers,
  LibraryBig,
  MessagesSquare,
  Quote,
  ScanSearch,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATS = [
  { value: "4", unit: "门", label: "内置示范课程" },
  { value: "RAG", unit: "", label: "私有知识库检索" },
  { value: "3", unit: "大", label: "Agent 学习工具" },
  { value: "100", unit: "%", label: "回答可溯源" },
];

const CAPABILITIES = [
  {
    icon: ScanSearch,
    tag: "RAG 核心",
    title: "基于私有课件的精准问答",
    description:
      "上传 PDF、Word、Markdown、TXT、HTML 或图片，系统自动解析与 OCR、清洗、重叠切片和向量化。提问时先检索 Top-K 原文，再让大模型基于证据作答，显著压低专业课幻觉。",
    points: ["混合检索：向量 + 关键词覆盖", "Top-K 可调，相关度过滤", "检索结果实时展示"],
    tone: "accent",
  },
  {
    icon: Quote,
    tag: "溯源机制",
    title: "每一条回答都有出处",
    description:
      "回答底部自动附带引用文档与原文片段，可展开查看命中内容与相关度。AI 生成内容统一标注学习参考声明。",
    points: ["文档级引用定位", "原文片段展开阅读", "相关度可视化"],
    tone: "cyan",
  },
  {
    icon: Bot,
    tag: "Agent",
    title: "会规划、会用工具的学习体",
    description:
      "识别复合学习指令并拆解为多步任务，自主调用考点总结、智能出题、代码批改工具，串成完整学习闭环。",
    points: ["复合指令自动拆解", "工具链顺序执行", "单步失败不影响整体"],
    tone: "mint",
  },
  {
    icon: BrainCircuit,
    tag: "可视化",
    title: "把 Agent 的思考过程摊开",
    description:
      "规划、检索、工具调用与结果生成逐步展示，每一步都有状态、耗时与产出，评审可以直接看到智能体的决策路径。",
    points: ["实时步骤时间线", "运行状态与耗时", "结果结构化渲染"],
    tone: "amber",
  },
];

const WORKFLOW = [
  {
    step: "01",
    icon: FileText,
    title: "上传课程资料",
    description: "拖拽 PDF / Word / Markdown / 图片，格式、大小与文件头自动校验。",
  },
  {
    step: "02",
    icon: Layers,
    title: "解析切片入库",
    description: "文本清洗后按语义边界切片，重叠窗口保持知识点完整。",
  },
  {
    step: "03",
    icon: Database,
    title: "向量化构建知识库",
    description: "生成向量并持久化，支持文档预览、删除与清空。",
  },
  {
    step: "04",
    icon: MessagesSquare,
    title: "溯源问答",
    description: "检索私有知识库，流式生成回答并附带原文出处。",
  },
  {
    step: "05",
    icon: Zap,
    title: "Agent 自动学习",
    description: "一句话触发总结、出题、批改的多步学习任务。",
  },
];

const STACK = [
  { label: "Next.js 14", hint: "App Router 全栈" },
  { label: "TypeScript", hint: "全量强类型" },
  { label: "Vercel AI SDK", hint: "流式生成" },
  { label: "DeepSeek", hint: "LLM + Embedding" },
  { label: "Tailwind CSS", hint: "组件化 UI" },
  { label: "Vector Store", hint: "私有向量检索" },
];

const AGENT_STEPS = [
  { label: "拆解学习任务", detail: "识别「复习 + 出题」复合意图", state: "done" },
  { label: "检索私有知识库", detail: "命中 6 段进程调度相关原文", state: "done" },
  { label: "生成考点总结", detail: "提炼 5 个核心考点与易错点", state: "done" },
  { label: "生成分层练习", detail: "3 选择 + 1 简答 + 1 代码题", state: "live" },
];

function ToneStyles(tone: string) {
  switch (tone) {
    case "cyan":
      return {
        icon: "border-cyan/25 bg-cyan/10 text-cyan-soft",
        tag: "cyan" as const,
        glow: "from-cyan/[0.09]",
      };
    case "mint":
      return {
        icon: "border-mint/25 bg-mint/10 text-mint-soft",
        tag: "mint" as const,
        glow: "from-mint/[0.08]",
      };
    case "amber":
      return {
        icon: "border-amber/25 bg-amber/10 text-amber-soft",
        tag: "amber" as const,
        glow: "from-amber/[0.07]",
      };
    default:
      return {
        icon: "border-accent/25 bg-accent/12 text-accent-soft",
        tag: "accent" as const,
        glow: "from-accent/[0.1]",
      };
  }
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink-950">
      <div className="pointer-events-none fixed inset-0 bg-aurora" />
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_72%)]" />
      <div className="pointer-events-none fixed left-1/2 top-[-18rem] h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />

      <header className="relative z-30">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between px-5 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-400 md:flex">
            <Link className="transition hover:text-white" href="#capabilities">
              产品能力
            </Link>
            <Link className="transition hover:text-white" href="#workflow">
              学习闭环
            </Link>
            <Link className="transition hover:text-white" href="#architecture">
              技术架构
            </Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Badge variant="mint" className="hidden sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              在线演示
            </Badge>
            <Link
              href="/chat"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }), "h-9 px-4")}
            >
              进入工作台
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-[1180px] px-5 pb-16 pt-14 lg:px-8 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            <div className="animate-fade-up">
              <h1 className="text-balance text-[40px] font-extrabold leading-[1.12] tracking-[-0.035em] text-white sm:text-[54px]">
                让专业课复习
                <br />
                <span className="text-gradient">有据可依。</span>
              </h1>

              <p className="mt-6 max-w-xl text-[14.5px] leading-[1.9] text-slate-400">
                面向计算机专业大学生的 AI 学习平台。上传课程资料与图片，构建你的专属知识库，
                用 <span className="font-semibold text-slate-200">RAG 溯源问答</span> 答疑，
                让 <span className="font-semibold text-slate-200">AI Agent</span> 自动完成
                考点总结、智能出题与代码批改。
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/chat"
                  className={cn(buttonVariants({ variant: "accent", size: "lg" }), "group")}
                >
                  开始智能问答
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/agent"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "group")}
                >
                  <Bot className="h-4 w-4 text-accent-soft" />
                  体验 AI Agent
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-3 text-[11.5px] text-slate-500">
                <div className="flex -space-x-2">
                  {["OS", "NET", "DS", "DB"].map((item, index) => (
                    <span
                      key={item}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full border border-ink-950 text-[9px] font-bold text-white",
                        [
                          "bg-accent/70",
                          "bg-cyan/60",
                          "bg-mint/55",
                          "bg-amber/50",
                        ][index]
                      )}
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <span>内置操作系统、计算机网络、数据结构、数据库示范课件</span>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-4 gap-3">
                {STATS.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3"
                  >
                    <dt className="text-[10px] leading-tight text-slate-500">
                      {item.label}
                    </dt>
                    <dd className="mt-1.5 font-mono text-[18px] font-semibold tracking-tight text-white">
                      {item.value}
                      <span className="ml-0.5 text-[10px] font-normal text-slate-500">
                        {item.unit}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative animate-fade-up [animation-delay:120ms]">
              <div className="pointer-events-none absolute -inset-8 rounded-[36px] bg-accent/[0.09] blur-3xl" />
              <div className="glow-border relative overflow-hidden rounded-[22px] border border-white/10 bg-[#070b14]/90 shadow-panel">
                <div className="flex h-11 items-center gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/55" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber/55" />
                  <span className="h-2.5 w-2.5 rounded-full bg-mint/55" />
                  <div className="ml-3 flex h-6 flex-1 items-center rounded-md border border-white/[0.06] bg-black/30 px-2.5 font-mono text-[9.5px] text-slate-500">
                    cs-learnmate.app/chat
                  </div>
                </div>

                <div className="grid grid-cols-[54px_1fr]">
                  <div className="flex flex-col items-center gap-3 border-r border-white/[0.06] py-4">
                    <span className="grid h-7 w-7 place-items-center rounded-lg accent-gradient">
                      <GitBranch className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.07] text-accent-soft">
                      <MessagesSquare className="h-3.5 w-3.5" />
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg text-slate-600">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg text-slate-600">
                      <LibraryBig className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="min-w-0 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-semibold text-slate-200">
                          TCP 连接管理
                        </span>
                        <Badge variant="cyan" className="px-1.5 py-0 text-[9px]">
                          Top-5 检索
                        </Badge>
                      </div>
                      <span className="flex items-center gap-1 text-[9px] text-mint">
                        <span className="h-1 w-1 rounded-full bg-mint" />
                        流式输出中
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="ml-8 rounded-2xl rounded-tr-md border border-accent/20 bg-accent/[0.09] px-3 py-2.5 text-[11px] leading-relaxed text-slate-200">
                        TCP 为什么必须三次握手，两次不行吗？
                      </div>

                      <div className="flex gap-2">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg accent-gradient">
                          <Sparkles className="h-3 w-3 text-white" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.035] px-3 py-2.5">
                            <p className="text-[10.5px] leading-[1.75] text-slate-300">
                              三次握手的本质是
                              <span className="font-semibold text-white">
                                双方确认收发能力并同步初始序列号
                              </span>
                              。两次握手无法让服务端确认客户端已收到 SYN-ACK，
                              可能因历史连接请求造成资源浪费。
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md border border-cyan/20 bg-cyan/[0.07] px-1.5 py-0.5 text-[8.5px] text-cyan-soft">
                                <Quote className="h-2.5 w-2.5" />
                                计网课件 · P.42
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] text-slate-400">
                                相关度 0.91
                              </span>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[8px] text-slate-600">
                            AI 生成内容仅供学习参考
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-accent-soft">
                          <Bot className="h-3 w-3" />
                          Agent 正在执行
                        </span>
                        <span className="font-mono text-[8px] text-slate-600">
                          3 / 4
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {AGENT_STEPS.map((step) => (
                          <div
                            key={step.label}
                            className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.025] px-2 py-1.5"
                          >
                            {step.state === "done" ? (
                              <CheckCircle2 className="h-3 w-3 shrink-0 text-mint" />
                            ) : (
                              <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                                <span className="absolute h-3 w-3 animate-ping rounded-full bg-accent/40" />
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                              </span>
                            )}
                            <span className="text-[9px] font-medium text-slate-300">
                              {step.label}
                            </span>
                            <span className="ml-auto hidden truncate text-[8px] text-slate-600 sm:block">
                              {step.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-3 -top-4 hidden animate-float rounded-xl border border-mint/25 bg-[#0a1220]/95 px-3 py-2 shadow-glow xl:block">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mint" />
                  <div>
                    <p className="text-[9.5px] font-semibold text-white">检索命中 6 段原文</p>
                    <p className="text-[8px] text-slate-500">向量 + 关键词混合排序</p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 -left-4 hidden animate-float rounded-xl border border-white/10 bg-[#0a1220]/95 px-3 py-2 shadow-panel [animation-delay:1.4s] xl:block">
                <div className="flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-cyan" />
                  <div>
                    <p className="text-[9.5px] font-semibold text-white">C 代码批改完成</p>
                    <p className="text-[8px] text-slate-500">发现 3 处越界与语法问题</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-y border-white/[0.05] bg-white/[0.012] py-5">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-[11px] text-slate-500 lg:px-8">
            <span className="flex items-center gap-2 font-medium text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-accent-soft" />
              为计科核心课程而构建
            </span>
            {["操作系统", "计算机网络", "数据结构", "数据库原理", "计算机组成", "编译原理"].map(
              (course) => (
                <span key={course} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  {course}
                </span>
              )
            )}
          </div>
        </section>

        <section id="capabilities" className="mx-auto max-w-[1180px] scroll-mt-20 px-5 py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent-soft">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Core Capabilities
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[38px]">
              不是通用聊天，是
              <span className="text-gradient">专业课学习系统</span>
            </h2>
            <p className="mt-4 text-[13.5px] leading-relaxed text-slate-500">
              从资料到知识库、从检索到回答、从规划到工具链，每一层都为计算机专业课程场景定制。
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {CAPABILITIES.map((item) => {
              const tone = ToneStyles(item.tone);
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className={cn(
                    "panel panel-hover group relative overflow-hidden p-6",
                    "bg-gradient-to-br to-transparent",
                    tone.glow
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-xl border",
                        tone.icon
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge variant={tone.tag}>{item.tag}</Badge>
                  </div>
                  <h3 className="mt-5 text-[17px] font-bold text-white">{item.title}</h3>
                  <p className="mt-2.5 text-[12.5px] leading-[1.85] text-slate-500">
                    {item.description}
                  </p>
                  <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
                    {item.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-2 text-[11.5px] text-slate-400"
                      >
                        <ChevronRight className="h-3 w-3 text-slate-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="relative scroll-mt-20 border-y border-white/[0.06] bg-[#060a12]/70 py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-dots opacity-[0.25]" />
          <div className="relative mx-auto max-w-[1180px] px-5 lg:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-cyan-soft">
                  <span className="h-1 w-1 rounded-full bg-cyan" />
                  Learning Loop
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[38px]">
                  一条完整的智能学习闭环
                </h2>
                <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-slate-500">
                  上传、入库、检索、问答、Agent 自动化，五个环节全部在同一个工作台内完成。
                </p>
              </div>
              <Link
                href="/knowledge"
                className={cn(buttonVariants({ variant: "secondary", size: "md" }), "shrink-0")}
              >
                <LibraryBig className="h-4 w-4 text-cyan-soft" />
                构建我的知识库
              </Link>
            </div>

            <div className="relative mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="pointer-events-none absolute left-0 right-0 top-[26px] hidden h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent lg:block" />
              {WORKFLOW.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="relative">
                    <div className="relative z-10 flex items-center gap-2.5">
                      <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl border border-white/[0.09] bg-[#080d18] text-accent-soft shadow-[0_14px_40px_-24px_rgba(124,108,255,0.9)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="mt-4 text-[13.5px] font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[11.5px] leading-[1.75] text-slate-500">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {[
                {
                  icon: BookOpenCheck,
                  title: "考点总结",
                  text: "从课件提炼核心考点、重难点与易混淆概念，输出结构化复习清单。",
                },
                {
                  icon: Layers,
                  title: "智能出题",
                  text: "完全基于上传内容生成选择、简答与代码题，附标准答案与解析。",
                },
                {
                  icon: Code2,
                  title: "代码批改",
                  text: "在线提交 C / Python，识别语法、越界与逻辑漏洞并逐行讲解。",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent-soft">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="text-[12.5px] font-semibold text-white">{item.title}</h4>
                      <p className="mt-1 text-[11px] leading-[1.7] text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="architecture" className="mx-auto max-w-[1180px] scroll-mt-20 px-5 py-20 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-mint-soft">
                <span className="h-1 w-1 rounded-full bg-mint" />
                Architecture
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[38px]">
                全栈一体化
                <br />
                <span className="text-gradient">RAG × Agent 架构</span>
              </h2>
              <p className="mt-4 max-w-md text-[13px] leading-[1.9] text-slate-500">
                Next.js 全栈承载前端交互与 AI 业务；Vercel AI SDK 负责流式生成与工具调度；
                私有向量库负责知识检索。密钥全部走环境变量，支持 Vercel 一键部署。
              </p>

              <div className="mt-7 space-y-2.5">
                {[
                  { icon: Layers, title: "前端展示层", text: "页面、对话、上传、状态管理" },
                  { icon: BrainCircuit, title: "AI 业务层", text: "RAG 核心、Agent 调度、流式协议" },
                  { icon: Database, title: "数据存储层", text: "多格式解析 / OCR、切片、向量持久化" },
                ].map((layer) => {
                  const Icon = layer.icon;
                  return (
                    <div
                      key={layer.title}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] text-cyan-soft">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white">{layer.title}</p>
                        <p className="text-[10.5px] text-slate-500">{layer.text}</p>
                      </div>
                      <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-mint/70" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel relative overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tech Stack
                </span>
                <Badge variant="outline">TypeScript 全栈</Badge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {STACK.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3 transition hover:border-accent/25 hover:bg-accent/[0.05]"
                  >
                    <p className="text-[11.5px] font-semibold text-slate-100">{item.label}</p>
                    <p className="mt-0.5 text-[9.5px] text-slate-600">{item.hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-white/[0.07] bg-[#050810] p-4 font-mono text-[10.5px] leading-[1.9]">
                <p className="text-slate-600">// RAG pipeline</p>
                <p>
                  <span className="text-cyan-soft">pdf</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-slate-300">clean</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-slate-300">chunk(520/90)</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-accent-soft">embed</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-mint-soft">retrieve(topK)</span>
                </p>
                <p className="mt-1">
                  <span className="text-cyan-soft">query</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-mint-soft">context</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-accent-soft">stream</span>
                  <span className="text-slate-600"> → </span>
                  <span className="text-slate-300">citations</span>
                  <span className="ml-1 inline-block h-3 w-1.5 animate-blink bg-accent align-middle" />
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/15 bg-mint/[0.055] px-3 py-2.5">
                <Zap className="h-3.5 w-3.5 shrink-0 text-mint" />
                <p className="text-[10.5px] leading-relaxed text-slate-400">
                  未配置 API Key 时自动进入本地演示模式，全部核心流程仍可完整运行。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-20 lg:px-8 lg:pb-24">
          <div className="glow-border relative overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-accent/[0.14] via-[#0a1020] to-cyan/[0.08] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-[32rem] -translate-x-1/2 rounded-full bg-accent/25 blur-[90px]" />
            <div className="relative">
              <Badge variant="accent">
                <Sparkles className="h-3 w-3" />
                开箱即用 · 无需注册
              </Badge>
              <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-bold tracking-tight text-white sm:text-[40px]">
                用你的课件，训练专属于你的
                <span className="text-gradient">专业课 AI</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-slate-400">
                系统已内置四门示范课程，打开即可体验完整的 RAG 问答与 Agent 学习流程。
                也可以上传自己的 PDF、Word、Markdown 或课件截图，立即构建私有知识库。
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/chat"
                  className={cn(buttonVariants({ variant: "primary", size: "lg" }), "group")}
                >
                  立即开始体验
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/knowledge"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-black/20")}
                >
                  <LibraryBig className="h-4 w-4 text-cyan-soft" />
                  查看知识库
                </Link>
              </div>
              <p className="mt-5 text-[10.5px] text-slate-500">
                AI 生成内容仅供学习参考，请以教材与课程原始课件为准。
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] bg-[#04070d]/80">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-slate-600">
              CS-LearnMate · 面向计算机专业大学生的 RAG + Agent 智能学习平台。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-slate-500">
            <Link className="transition hover:text-white" href="/chat">
              对话问答
            </Link>
            <Link className="transition hover:text-white" href="/agent">
              AI Agent
            </Link>
            <Link className="transition hover:text-white" href="/knowledge">
              知识库
            </Link>
            <span className="h-3 w-px bg-white/10" />
            <span className="text-slate-600">RAG × Agent · 智能学习闭环</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
