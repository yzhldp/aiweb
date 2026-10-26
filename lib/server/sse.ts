type SseSend = (event: unknown) => void;

interface SseContext {
  send: SseSend;
  signal?: AbortSignal;
}

/**
 * 统一的 SSE 响应封装：
 * - 事件使用 `data: <json>\n\n` 传输；
 * - 自动处理 done 与异常事件；
 * - 客户端断开后停止写入，配合 AbortSignal 中断上游模型请求。
 */
export function createSseResponse(
  handler: (ctx: SseContext) => Promise<void>,
  requestSignal?: AbortSignal
): Response {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SseSend = (event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        await handler({ send, signal: requestSignal });
      } catch (error) {
        if (!closed) {
          send({
            type: "error",
            message:
              error instanceof Error && error.name === "AbortError"
                ? "生成已取消"
                : error instanceof Error
                  ? error.message
                  : "生成过程中发生未知错误",
          });
        }
      } finally {
        if (!closed) {
          send({ type: "done" });
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
