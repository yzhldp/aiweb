"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BookOpen,
  Bot,
  ChevronDown,
  Cpu,
  Database,
  GitBranch,
  History,
  MessageSquarePlus,
  Network,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SourceList } from "@/components/chat/source-list";
import { Logo } from "@/components/logo";
import { Markdown } from "@/components/markdown";
import { ModelSettings } from "@/components/model-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner, DotsLoader } from "@/components/ui/spinner";
import { useLibraryStatus } from "@/lib/client/hooks";
import { consumeSse } from "@/lib/client/sse";
import { CHAT_SUGGESTIONS, DISCLAIMER } from "@/lib/constants";
import type { ChatMessage, ChatSseEvent, Conversation } from "@/lib/types";
import { cn, formatRelative, truncate, uid } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";

const SUGGESTION_ICONS = {
  network: Network,
  cpu: Cpu,
  database: Database,
  tree: GitBranch,
} as const;

export default function ChatPage() {
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActive = useChatStore((state) => state.setActive);
  const removeConversation = useChatStore((state) => state.removeConversation);
  const clearConversation = useChatStore((state) => state.clearConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const appendMessageText = useChatStore((state) => state.appendMessageText);
  const { status } = useLibraryStatus();

  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [topK, setTopK] = useState(5);
  const [streaming, setStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!useChatStore.getState().scopeReady) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 2500);
          const unsubscribe = useChatStore.subscribe((state) => {
            if (state.scopeReady) {
              window.clearTimeout(timer);
              unsubscribe();
              resolve();
            }
          });
        });
      }
      if (cancelled) return;
      const state = useChatStore.getState();
      if (state.conversations.length === 0) {
        state.createConversation();
      } else if (
        !state.activeId ||
        !state.conversations.some((item) => item.id === state.activeId)
      ) {
        state.setActive(state.conversations[0].id);
      }
      setMounted(true);
    };
    void init();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distance < 240 || lastMessage?.role === "user") {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, lastMessage?.content, lastMessage?.pending, lastMessage?.role]);

  const resizeTextarea = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const handleNew = () => {
    abortRef.current?.abort();
    if (active && active.messages.length === 0) {
      setHistoryOpen(false);
      textareaRef.current?.focus();
      return;
    }
    createConversation();
    setHistoryOpen(false);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    if (id === activeId) abortRef.current?.abort();
    removeConversation(id);
    if (conversations.length <= 1) {
      createConversation();
    }
  };

  const send = async (raw?: string) => {
    if (streamingRef.current) return;
    const question = (raw ?? input).trim();
    if (!question) return;

    let conversationId = activeId;
    if (!conversationId) conversationId = createConversation();

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: question,
      createdAt: now,
    };
    const assistantId = uid("msg");
    addMessage(conversationId, userMessage);
    addMessage(conversationId, {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now,
      pending: true,
    });
    setInput("");
    requestAnimationFrame(() => {
      resizeTextarea();
      textareaRef.current?.focus();
    });

    setStreaming(true);
    streamingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const conversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversationId);
      const apiMessages = (conversation?.messages ?? [])
        .filter(
          (message) =>
            !message.pending &&
            (message.role === "user" || message.role === "assistant") &&
            message.content.trim().length > 0
        )
        .map((message) => ({
          role: message.role,
          content: message.content.slice(0, 4000),
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, topK }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `请求失败（${response.status}）`);
      }

      let received = false;
      await consumeSse<ChatSseEvent>(
        response,
        (event) => {
          if (event.type === "sources") {
            updateMessage(conversationId!, assistantId, {
              sources: event.sources,
            });
          } else if (event.type === "meta") {
            updateMessage(conversationId!, assistantId, {
              mode: event.mode,
              modelLabel: event.modelLabel,
            });
          } else if (event.type === "delta") {
            received = true;
            appendMessageText(conversationId!, assistantId, event.text);
          } else if (event.type === "error") {
            updateMessage(conversationId!, assistantId, {
              pending: false,
              error: event.message,
            });
          } else if (event.type === "done") {
            updateMessage(conversationId!, assistantId, { pending: false });
          }
        },
        controller.signal
      );

      const current = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversationId)
        ?.messages.find((message) => message.id === assistantId);
      if (current && !current.error && !current.content.trim()) {
        updateMessage(conversationId, assistantId, {
          pending: false,
          content: received
            ? ""
            : "本次没有生成有效内容，请换一种问法或补充课件后重试。",
        });
      }
      if (current?.pending) {
        updateMessage(conversationId, assistantId, { pending: false });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        const current = useChatStore
          .getState()
          .conversations.find((item) => item.id === conversationId)
          ?.messages.find((message) => message.id === assistantId);
        updateMessage(conversationId, assistantId, {
          pending: false,
          content:
            current?.content?.trim() ||
            "> 生成已停止。你可以重新提问，或调整问题后继续。",
        });
      } else {
        const message =
          error instanceof Error ? error.message : "对话服务暂时不可用";
        updateMessage(conversationId, assistantId, {
          pending: false,
          error: message,
        });
        toast.error(message);
      }
    } finally {
      setStreaming(false);
      streamingRef.current = false;
      abortRef.current = null;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-[calc(100vh-88px)] items-center justify-center gap-2 text-[12px] text-slate-600 lg:h-[calc(100vh-64px)]">
        <Spinner /> 正在恢复本地对话…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-88px)] gap-4 lg:h-[calc(100vh-64px)]">
      <aside className="panel hidden w-[258px] shrink-0 flex-col overflow-hidden xl:flex">
        <div className="border-b border-white/[0.06] p-3.5">
          <Button variant="secondary" size="sm" className="w-full justify-start" onClick={handleNew}>
            <MessageSquarePlus className="h-3.5 w-3.5 text-accent-soft" />
            新建对话
          </Button>
        </div>
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setActive}
          onDelete={handleDelete}
          onNew={handleNew}
        />
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] leading-relaxed text-slate-600">
            <ShieldCheck className="h-3 w-3" />
            对话按账号保存在本机浏览器
          </p>
        </div>
      </aside>

      <section className="panel flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 sm:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/20 bg-accent/[0.09] text-accent-soft">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[13.5px] font-semibold text-white">
              RAG 智能问答
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-600">
              <span className="h-1 w-1 rounded-full bg-mint" />
              个人 + 公共知识库 · 回答逐字溯源
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <ModelSettings />
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 sm:flex">
              <span className="text-[10px] text-slate-500">Top-K</span>
              <div className="relative">
                <select
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                  className="appearance-none bg-transparent pr-4 text-[10.5px] font-semibold text-slate-200 outline-none"
                  aria-label="检索片段数量"
                >
                  {[3, 5, 8].map((value) => (
                    <option key={value} value={value} className="bg-[#0b1120]">
                      {value}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-600" />
              </div>
            </div>
            <div className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-slate-500 md:flex">
              <Database className="h-3 w-3 text-cyan" />
              {status.chunks} 片段
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="xl:hidden"
              onClick={() => setHistoryOpen(true)}
              aria-label="历史对话"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="xl:hidden"
              onClick={handleNew}
              aria-label="新建对话"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {messages.length > 0 ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setClearOpen(true)}
                aria-label="清空当前对话"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-5 py-10 sm:px-8">
              <div className="animate-fade-up">
                <div className="relative inline-flex">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-accent/20 to-cyan/5 shadow-glow">
                    <Sparkles className="h-6 w-6 text-accent-soft" />
                  </span>
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#0a101c] bg-mint" />
                </div>
                <h2 className="mt-5 text-[22px] font-bold tracking-tight text-white sm:text-[26px]">
                  向你的课程资料提问
                </h2>
                <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-slate-500">
                  系统会先在你的个人知识与公共课件中检索最相关的片段，再让所配置的
                  大模型结合课件回答，并附上可展开的原文出处。
                </p>

                {status.docs === 0 ? (
                  <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber/20 bg-amber/[0.055] px-4 py-3">
                    <BookOpen className="h-4 w-4 shrink-0 text-amber-soft" />
                    <p className="text-[11.5px] leading-relaxed text-amber-soft/80">
                      知识库还是空的。先{" "}
                      <Link href="/knowledge" className="font-semibold underline underline-offset-2">
                        上传课程资料或图片
                      </Link>{" "}
                      或载入示例课件，回答才有依据。
                    </p>
                  </div>
                ) : null}

                <div className="mt-7 grid gap-2 sm:grid-cols-2">
                  {CHAT_SUGGESTIONS.map((suggestion) => {
                    const Icon =
                      SUGGESTION_ICONS[
                        suggestion.icon as keyof typeof SUGGESTION_ICONS
                      ] ?? Sparkles;
                    return (
                      <button
                        key={suggestion.label}
                        onClick={() => void send(suggestion.prompt)}
                        className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition-all hover:border-accent/25 hover:bg-accent/[0.045]"
                      >
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-500 transition group-hover:border-accent/20 group-hover:text-accent-soft">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span>
                          <span className="block text-[11.5px] font-medium text-slate-300 transition group-hover:text-white">
                            {suggestion.label}
                          </span>
                          <span className="mt-1 block text-[10px] leading-relaxed text-slate-600">
                            {truncate(suggestion.prompt, 46)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:px-7 sm:py-8">
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              <div className="h-2" />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#080d17]/55 p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <div
              className={cn(
                "rounded-2xl border bg-[#070b14]/85 p-1.5 transition-all",
                input.trim()
                  ? "border-accent/30 shadow-[0_0_0_3px_rgba(124,108,255,0.06)]"
                  : "border-white/10"
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  resizeTextarea();
                }}
                onKeyDown={onKeyDown}
                placeholder="输入专业课问题，例如：TCP 为什么需要三次握手？"
                rows={1}
                className="max-h-[168px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-600"
                disabled={streaming}
              />
              <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    href="/knowledge"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-300"
                  >
                    <Database className="h-3 w-3" />
                    {status.docs > 0 ? `${status.docs} 份课件` : "知识库为空"}
                  </Link>
                  {status.llm === "deepseek" ? (
                    <Badge variant="mint" className="hidden max-w-[140px] sm:inline-flex">
                      <span className="truncate">
                        {status.modelLabel ?? "DeepSeek"}
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="amber" className="hidden sm:inline-flex">
                      本地演示
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="hidden text-[9.5px] text-slate-700 sm:block">
                    Enter 发送 · Shift+Enter 换行
                  </span>
                  {streaming ? (
                    <button
                      onClick={stop}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 transition hover:bg-white/[0.1]"
                      aria-label="停止生成"
                    >
                      <Square className="h-3 w-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={() => void send()}
                      disabled={!input.trim()}
                      className="grid h-8 w-8 place-items-center rounded-lg accent-gradient text-white shadow-[0_8px_20px_-10px_rgba(124,108,255,0.9)] transition hover:brightness-110 disabled:opacity-35"
                      aria-label="发送"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[9.5px] leading-relaxed text-slate-700">
              {DISCLAIMER}
            </p>
          </div>
        </div>
      </section>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="对话记录"
        description="历史对话保存在本地浏览器，可随时切换或删除。"
        className="max-w-md"
      >
        <div className="mb-3">
          <Button variant="secondary" size="sm" className="w-full" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5" />
            新建对话
          </Button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={(id) => {
              setActive(id);
              setHistoryOpen(false);
            }}
            onDelete={handleDelete}
            onNew={handleNew}
            compact
          />
        </div>
      </Dialog>

      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="清空当前对话？"
        description="只会清除当前对话记录，不影响知识库中的课件与向量数据。"
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setClearOpen(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (activeId) clearConversation(activeId);
                setClearOpen(false);
                toast.success("对话已清空");
              }}
            >
              清空对话
            </Button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-slate-400">
          当前对话包含 <strong className="text-white">{messages.length}</strong>{" "}
          条消息。清空后无法恢复。
        </p>
      </Dialog>
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  compact = false,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  compact?: boolean;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <History className="h-5 w-5 text-slate-700" />
        <p className="mt-3 text-[11px] text-slate-600">还没有对话记录</p>
        <button
          onClick={onNew}
          className="mt-3 text-[10.5px] font-medium text-accent-soft hover:underline"
        >
          开始第一个问题
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 space-y-1 overflow-y-auto p-2.5",
        compact && "max-h-none"
      )}
    >
      {conversations.map((conversation) => {
        const active = conversation.id === activeId;
        const lastText = conversation.messages[conversation.messages.length - 1]?.content;
        return (
          <div
            key={conversation.id}
            className={cn(
              "group relative flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2.5 transition",
              active
                ? "bg-accent/[0.09]"
                : "hover:bg-white/[0.035]"
            )}
            onClick={() => onSelect(conversation.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSelect(conversation.id);
            }}
          >
            <span
              className={cn(
                "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                active
                  ? "border-accent/25 bg-accent/14 text-accent-soft"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-600"
              )}
            >
              <MessageSquarePlus className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-[11px] font-medium",
                  active ? "text-slate-100" : "text-slate-400"
                )}
              >
                {conversation.title}
              </p>
              <p className="mt-0.5 truncate text-[9.5px] text-slate-600">
                {lastText ? truncate(lastText, 34) : "空对话"} ·{" "}
                {formatRelative(conversation.updatedAt)}
              </p>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete(conversation.id);
              }}
              className="mt-0.5 hidden h-5 w-5 place-items-center rounded text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-300 group-hover:grid"
              aria-label="删除对话"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[86%] rounded-2xl rounded-tr-md border border-accent/20 bg-gradient-to-br from-accent/18 to-accent/[0.07] px-4 py-3 text-[13px] leading-relaxed text-slate-100 sm:max-w-[78%]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-up gap-2.5 sm:gap-3">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-[#0b1120]">
        <Logo href="/chat" compact />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300">
            CS-LearnMate
          </span>
          {message.mode ? (
            <Badge
              variant={message.mode === "deepseek" ? "mint" : "amber"}
              className="max-w-[160px]"
            >
              <span className="truncate">
                {message.mode === "deepseek"
                  ? message.modelLabel ?? "DeepSeek"
                  : "本地演示"}
              </span>
            </Badge>
          ) : null}
          {message.sources && message.sources.length > 0 ? (
            <span className="text-[9.5px] text-slate-600">
              {message.sources.length} 个检索片段
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.022] px-4 py-3.5">
          {message.content ? (
            <div className="relative">
              <Markdown content={message.content} />
              {message.pending ? (
                <span className="ml-0.5 inline-block h-4 w-[2px] animate-blink bg-accent-soft align-middle" />
              ) : null}
            </div>
          ) : message.pending ? (
            <div className="flex items-center gap-2.5 py-1 text-[11.5px] text-slate-500">
              <DotsLoader className="text-accent-soft" />
              {message.sources && message.sources.length > 0
                ? `已检索到 ${message.sources.length} 个片段，正在生成回答…`
                : "正在检索私有知识库…"}
            </div>
          ) : null}

          {message.error ? (
            <div className="mt-2 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-rose-300">
              {message.error}
            </div>
          ) : null}

          {message.sources && message.sources.length > 0 ? (
            <SourceList sources={message.sources} />
          ) : null}
        </div>

        {!message.pending && message.content ? (
          <p className="mt-2 flex items-start gap-1.5 px-1 text-[9.5px] leading-relaxed text-slate-700">
            <ShieldCheck className="mt-0.5 h-2.5 w-2.5 shrink-0" />
            {DISCLAIMER}
          </p>
        ) : null}
      </div>
    </div>
  );
}
