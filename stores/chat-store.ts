"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, Conversation } from "@/lib/types";
import { truncate, uid } from "@/lib/utils";

interface ChatState {
  ownerId: string | null;
  scopeReady: boolean;
  conversations: Conversation[];
  activeId: string | null;
  bindUser: (userId: string) => Promise<void>;
  createConversation: () => string;
  setActive: (id: string) => void;
  removeConversation: (id: string) => void;
  clearConversation: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    patch: Partial<ChatMessage>
  ) => void;
  appendMessageText: (
    conversationId: string,
    messageId: string,
    text: string
  ) => void;
}

function newConversation(): Conversation {
  const now = new Date().toISOString();
  return {
    id: uid("conv"),
    title: "新的学习对话",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      scopeReady: false,
      conversations: [],
      activeId: null,

      bindUser: async (userId) => {
        if (get().ownerId === userId && get().scopeReady) return;
        useChatStore.persist.setOptions({
          name: `learnmate.conversations.${userId}.v1`,
        });
        await useChatStore.persist.rehydrate();
        if (get().ownerId !== userId) {
          set({ ownerId: userId, conversations: [], activeId: null });
        }
        set({ scopeReady: true });
      },

      createConversation: () => {
        const conversation = newConversation();
        set((state) => ({
          conversations: [conversation, ...state.conversations].slice(0, 40),
          activeId: conversation.id,
        }));
        return conversation.id;
      },

      setActive: (id) => set({ activeId: id }),

      removeConversation: (id) =>
        set((state) => {
          const conversations = state.conversations.filter(
            (item) => item.id !== id
          );
          return {
            conversations,
            activeId:
              state.activeId === id
                ? (conversations[0]?.id ?? null)
                : state.activeId,
          };
        }),

      clearConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === id
              ? {
                  ...conversation,
                  title: "新的学习对话",
                  messages: [],
                  updatedAt: new Date().toISOString(),
                }
              : conversation
          ),
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            const isFirstUser =
              message.role === "user" &&
              !conversation.messages.some((item) => item.role === "user");
            return {
              ...conversation,
              title: isFirstUser
                ? truncate(message.content, 22)
                : conversation.title,
              messages: [...conversation.messages, message],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      updateMessage: (conversationId, messageId, patch) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === messageId
                      ? { ...message, ...patch }
                      : message
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : conversation
          ),
        })),

      appendMessageText: (conversationId, messageId, text) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === messageId
                      ? { ...message, content: message.content + text }
                      : message
                  ),
                }
              : conversation
          ),
        })),
    }),
    {
      name: "learnmate.conversations.v1",
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        ownerId: state.ownerId,
        conversations: state.conversations,
        activeId: state.activeId,
      }),
    }
  )
);

export function useActiveConversation() {
  const activeId = useChatStore((state) => state.activeId);
  const conversations = useChatStore((state) => state.conversations);
  return conversations.find((conversation) => conversation.id === activeId) ?? null;
}

export function ensureConversation() {
  const state = useChatStore.getState();
  if (state.activeId) {
    const exists = state.conversations.some(
      (conversation) => conversation.id === state.activeId
    );
    if (exists) return state.activeId;
  }
  return state.createConversation();
}

export { newConversation };
export type { ChatState };
