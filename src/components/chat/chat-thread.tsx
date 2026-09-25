"use client";

import { Paperclip, Send, X } from "lucide-react";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { markConversationRead, sendMessage } from "@/app/chat-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage, Conversation } from "@/lib/chat";
import { relativeTime } from "@/lib/relative-time";
import { createClient } from "@/lib/supabase/client";
import type { FormState } from "@/lib/validation/form-state";
import { cn } from "@/lib/utils";

const ATTACH_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ATTACH_MAX = 10 * 1024 * 1024;
// Nudge people to keep contact details on-platform (warn only, never block).
const CONTACT_RE = /(\b\d[\d\s().-]{7,}\d\b)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

function senderLabel(msg: ChatMessage, conv: Conversation) {
  if (msg.sender_id === conv.currentUserId) return "You";
  if (msg.sender_id === conv.talentId) return conv.talentName;
  return "Elev8ai team";
}

export function ChatThread({ conversation }: { conversation: Conversation }) {
  const [messages, setMessages] = useState<ChatMessage[]>(conversation.messages);
  const [state, formAction, pending] = useActionState<FormState<"body">, FormData>(
    sendMessage.bind(null, conversation.id),
    {},
  );
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());

  const scrollToEnd = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  // Mark the other side's messages read on open.
  useEffect(() => {
    void markConversationRead(conversation.id);
  }, [conversation.id]);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length]);

  // Live incoming messages. Sign any attachment on the fly (participants only).
  useEffect(() => {
    const client = supabase.current;
    const channel = client
      .channel(`messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, attachmentUrl: null }];
          });
          if (row.sender_id !== conversation.currentUserId)
            void markConversationRead(conversation.id);
          if (row.attachment_path) {
            const { data } = await client.storage
              .from("chat-attachments")
              .createSignedUrl(row.attachment_path, 60 * 60);
            if (data?.signedUrl) {
              setMessages((prev) =>
                prev.map((m) => (m.id === row.id ? { ...m, attachmentUrl: data.signedUrl } : m)),
              );
            }
          }
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [conversation.id, conversation.currentUserId]);

  function pickFile(f: File | null) {
    setUploadError(null);
    if (f && (!ATTACH_TYPES.includes(f.type) || f.size > ATTACH_MAX)) {
      setUploadError("Use a JPG, PNG, WebP or PDF up to 10 MB.");
      return;
    }
    setFile(f);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() && !file) return;
    const formData = new FormData();
    formData.set("body", body);

    if (file) {
      setUploading(true);
      const path = `${conversation.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").slice(-60)}`;
      const { error } = await supabase.current.storage
        .from("chat-attachments")
        .upload(path, file, { contentType: file.type });
      setUploading(false);
      if (error) {
        setUploadError("Couldn't upload the file. Try again.");
        return;
      }
      formData.set("attachment_path", path);
    }

    startTransition(() => formAction(formData));
    setBody("");
    setFile(null);
  }

  const showContactWarning = CONTACT_RE.test(body);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello 👋
          </p>
        )}
        {messages.map((msg) => {
          const mine = msg.sender_id === conversation.currentUserId;
          return (
            <div key={msg.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary",
                )}
              >
                {!mine && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">
                    {senderLabel(msg, conversation)}
                  </p>
                )}
                {msg.body && <p className="break-words whitespace-pre-line">{msg.body}</p>}
                {msg.attachment_path &&
                  (msg.attachmentUrl ? (
                    <a
                      href={msg.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "mt-1 inline-flex items-center gap-1.5 text-sm underline",
                        mine ? "text-primary-foreground" : "text-primary",
                      )}
                    >
                      <Paperclip className="size-3.5" /> Attachment
                    </a>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-sm opacity-70">
                      <Paperclip className="size-3.5" /> Attachment
                    </span>
                  ))}
              </div>
              <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                {relativeTime(msg.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t bg-background pt-3">
        {showContactWarning && (
          <p className="mb-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
            Keep contact details on Elev8ai. Sharing phone numbers or emails isn&apos;t allowed
            while a job is in progress.
          </p>
        )}
        {(uploadError || state.fieldErrors?.body || state.message) && (
          <p className="mb-2 text-xs text-destructive">
            {uploadError ?? state.fieldErrors?.body ?? state.message}
          </p>
        )}
        {file && (
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Paperclip className="size-3.5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button type="button" aria-label="Remove file" onClick={() => setFile(null)}>
              <X className="size-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground">
            <Paperclip className="size-5" />
            <span className="sr-only">Attach a file</span>
            <input
              type="file"
              accept={ATTACH_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
            rows={1}
            placeholder="Write a message…"
            aria-label="Write a message"
            className="max-h-32 min-h-11 flex-1 resize-none py-2.5"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0"
            disabled={pending || uploading || (!body.trim() && !file)}
            aria-label="Send"
          >
            <Send className="size-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
