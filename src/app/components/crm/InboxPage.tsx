import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Mail, MessageSquare, Search, User } from "lucide-react";
import { Button } from "../ui/button";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { EmailRecord } from "@/app/types";

type ChannelFilter = "all" | "email" | "sms";

const CHANNELS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

interface Conversation {
  contactId: string;
  contactName: string;
  messages: EmailRecord[];
  latest: EmailRecord;
  unread: number;
}

/** Groups the message history into per-contact conversations, newest first. */
function buildConversations(records: EmailRecord[]): Conversation[] {
  const byContact = new Map<string, EmailRecord[]>();
  for (const record of records) {
    const bucket = byContact.get(record.contactId);
    if (bucket) {
      bucket.push(record);
    } else {
      byContact.set(record.contactId, [record]);
    }
  }

  return [...byContact.entries()]
    .map(([contactId, messages]) => {
      const sorted = [...messages].sort(
        (a, b) => a.sentAt.getTime() - b.sentAt.getTime(),
      );
      const latest = sorted[sorted.length - 1];
      return {
        contactId,
        contactName: latest.contactName,
        messages: sorted,
        latest,
        unread: sorted.filter((m) => m.read === false).length,
      };
    })
    .sort((a, b) => b.latest.sentAt.getTime() - a.latest.sentAt.getTime());
}

export function InboxPage() {
  const { emailHistory } = useAppData();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const conversations = useMemo(() => {
    let records = emailHistory;
    if (channel !== "all") {
      records = records.filter((r) => (r.channel ?? "email") === channel);
    }
    let result = buildConversations(records);
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.contactName.toLowerCase().includes(term) ||
          c.latest.subject.toLowerCase().includes(term),
      );
    }
    return result;
  }, [emailHistory, channel, search]);

  const selected =
    conversations.find((c) => c.contactId === selectedId) ?? conversations[0];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-5 shrink-0">
        <h2
          className="text-3xl"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
        >
          Inbox
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Email and SMS conversations across every contact.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Conversation list */}
        <div className="w-[360px] shrink-0 border-r border-border flex flex-col bg-card">
          <div className="p-4 space-y-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-input-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-1.5">
              {CHANNELS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setChannel(option.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    channel === option.value
                      ? "bg-primary text-primary-foreground border-primary font-semibold"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((conversation) => {
              const isActive = selected?.contactId === conversation.contactId;
              const isSms = (conversation.latest.channel ?? "email") === "sms";
              return (
                <button
                  key={conversation.contactId}
                  onClick={() => setSelectedId(conversation.contactId)}
                  className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                    isActive ? "bg-muted/60" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isSms ? (
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-semibold truncate flex-1">
                      {conversation.contactName}
                    </span>
                    {conversation.unread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">
                        {conversation.unread}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conversation.latest.subject}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {conversation.latest.sentAt.toLocaleString()}
                  </div>
                </button>
              );
            })}

            {conversations.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No conversations
              </div>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
                <div>
                  <div className="text-sm font-semibold">{selected.contactName}</div>
                  <div className="text-xs text-muted-foreground">
                    {selected.messages.length} message
                    {selected.messages.length > 1 ? "s" : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => navigate(`/crm/contacts/${selected.contactId}`)}
                >
                  <User className="w-4 h-4 mr-1.5" />
                  Open contact
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {selected.messages.map((message) => {
                  const inbound = message.direction === "inbound";
                  return (
                    <div
                      key={message.id}
                      className={`max-w-2xl rounded-lg border px-4 py-3 ${
                        inbound
                          ? "border-border bg-card"
                          : "border-primary/20 bg-primary/5 ml-auto"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="text-sm font-semibold">
                          {inbound ? selected.contactName : message.senderIdentity}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {message.sentAt.toLocaleString()}
                        </span>
                      </div>
                      {message.subject && (
                        <div className="text-sm font-medium mb-1">
                          {message.subject}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {message.body ?? "(no body captured)"}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {message.status}
                        </span>
                        {message.workflowName && (
                          <span className="text-[11px] text-muted-foreground">
                            · {message.workflowName}
                            {message.stepName ? ` / ${message.stepName}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
