export async function consumeSse<T>(
  response: Response,
  onEvent: (event: T) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) throw new Error("服务端未返回数据流");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          try {
            onEvent(JSON.parse(data) as T);
          } catch {
            // ignore malformed event
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  }
}
