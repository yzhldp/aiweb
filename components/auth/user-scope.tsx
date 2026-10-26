"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";

export function UserScope({ userId }: { userId: string }) {
  useEffect(() => {
    void useChatStore.getState().bindUser(userId);
  }, [userId]);
  return null;
}
