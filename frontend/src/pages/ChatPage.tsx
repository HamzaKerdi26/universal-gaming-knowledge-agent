import { type FormEvent, useEffect, useRef, useState } from "react";
import { chatService } from "../services/chatService";
import { conversationService } from "../services/conversationService";
import { getErrorMessage } from "../utils/errors";
import type { ChatMessage } from "../types";
import type { Conversation } from "../types/conversation";

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const selectionRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    conversationService
      .list()
      .then((items) => {
        if (active) setConversations(items);
      })
      .catch((requestError) => {
        if (active) setHistoryError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setConversationLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function selectConversation(conversation: Conversation) {
    const requestId = ++selectionRequestRef.current;
    setSelectedConversation(conversation);
    setMessages([]);
    setHistoryLoading(true);
    setHistoryError(null);
    setError(null);

    try {
      const [details, history] = await Promise.all([
        conversationService.getById(conversation.id),
        conversationService.getMessages(conversation.id),
      ]);
      if (requestId !== selectionRequestRef.current) return;
      setSelectedConversation(details);
      setMessages(
        history
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            role: message.role as "user" | "assistant",
            content: message.content,
          }))
      );
    } catch (requestError) {
      if (requestId === selectionRequestRef.current) {
        setHistoryError(getErrorMessage(requestError));
        setSelectedConversation(null);
      }
    } finally {
      if (requestId === selectionRequestRef.current) setHistoryLoading(false);
    }
  }

  async function startNewConversation() {
    ++selectionRequestRef.current;
    setHistoryLoading(false);
    setCreatingConversation(true);
    setHistoryError(null);
    setError(null);
    try {
      const conversation = await conversationService.create();
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setSelectedConversation(conversation);
      setMessages([]);
      setHistoryLoading(false);
    } catch (requestError) {
      setHistoryError(getErrorMessage(requestError));
    } finally {
      setCreatingConversation(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: nextLocalId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      let conversationId = selectedConversation?.id;
      if (!conversationId) {
        const conversation = await conversationService.create();
        conversationId = conversation.id;
        setConversations((current) => [conversation, ...current]);
        setSelectedConversation(conversation);
      }

      const result = await chatService.sendMessage({
        message: trimmed,
        conversationId,
      });
      setMessages((prev) => [
        ...prev,
        { id: nextLocalId(), role: "assistant", content: result.message },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
      // Mark the just-sent user message as failed so it's visually clear
      // the assistant never replied to it.
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m))
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page chat-page">
      <div className="page-header">
        <h1>Chat</h1>
      </div>

      <div className="chat-workspace">
        <aside className="conversation-sidebar" aria-label="Conversation history">
          <div className="conversation-sidebar-header">
            <h2>History</h2>
            <button
              type="button"
              className="btn btn-primary conversation-new-button"
              onClick={startNewConversation}
              disabled={conversationLoading || creatingConversation || sending}
            >
              {creatingConversation ? "Creating..." : "+ New"}
            </button>
          </div>

          {historyError && (
            <div className="form-api-error conversation-error" role="alert">
              {historyError}
            </div>
          )}
          {conversationLoading ? (
            <p className="muted conversation-status">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p className="muted conversation-status">No conversations yet.</p>
          ) : (
            <ul className="conversation-list">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={`conversation-item${selectedConversation?.id === conversation.id ? " conversation-item-active" : ""}`}
                    onClick={() => void selectConversation(conversation)}
                    disabled={historyLoading || sending}
                    aria-current={selectedConversation?.id === conversation.id ? "page" : undefined}
                  >
                    <span className="conversation-item-title">
                      {conversation.title || "Conversation"}
                    </span>
                    <time dateTime={conversation.createdAt}>
                      {new Date(conversation.createdAt).toLocaleDateString()}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="chat-panel">
          <div className="chat-panel-header">
            <h2>{selectedConversation?.title || "New conversation"}</h2>
            {historyLoading && <span className="muted">Loading messages...</span>}
          </div>

          <div className="chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="state-panel empty-state chat-empty">
                <span className="state-icon" aria-hidden="true">
                  &#128172;
                </span>
                <h3>Ask about any game</h3>
                <p>
                  Try "What is Elden Ring?" or "Explain the Souls-like genre."
                  I can use the available gaming knowledge and game records to help.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble-row chat-bubble-row-${m.role}`}
              >
                <div
                  className={`chat-bubble chat-bubble-${m.role}${
                    m.failed ? " chat-bubble-failed" : ""
                  }`}
                >
                  {m.content}
                  {m.failed && (
                    <span className="chat-bubble-failed-tag">
                      Not delivered
                    </span>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="chat-bubble-row chat-bubble-row-assistant">
                <div className="chat-bubble chat-bubble-assistant chat-bubble-typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={scrollAnchorRef} />
          </div>

        {error && (
          <div className="form-api-error chat-error" role="alert">
            {error}
          </div>
        )}

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a game..."
            disabled={conversationLoading || sending || historyLoading || creatingConversation}
            aria-label="Chat message"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={conversationLoading || sending || historyLoading || creatingConversation || !input.trim()}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
