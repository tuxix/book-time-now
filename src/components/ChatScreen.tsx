import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Message {
  id: string;
  reservation_id: string;
  sender_id: string;
  sender_role: "store" | "customer";
  message: string;
  read: boolean;
  created_at: string;
}

interface Props {
  reservationId: string;
  storeName: string;
  customerName: string;
  currentRole: "store" | "customer";
  onBack: () => void;
}

const ChatScreen = ({ reservationId, storeName, customerName, currentRole, onBack }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const otherName = currentRole === "store" ? customerName : storeName;

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
  };

  const markRead = async () => {
    if (!user) return;
    const oppositeRole = currentRole === "store" ? "customer" : "store";
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("reservation_id", reservationId)
      .eq("sender_role", oppositeRole)
      .eq("read", false);
  };

  useEffect(() => {
    fetchMessages().then(() => markRead());
  }, [reservationId]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${reservationId}`)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `reservation_id=eq.${reservationId}`,
      }, (payload: any) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Message];
        });
        if (payload.new.sender_role !== currentRole) {
          supabase
            .from("messages")
            .update({ read: true })
            .eq("id", payload.new.id)
            .then(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reservationId, currentRole]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    const msg = text.trim();
    setText("");
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      reservation_id: reservationId,
      sender_id: user.id,
      sender_role: currentRole,
      message: msg,
      read: false,
    });
    setSending(false);
    if (error) {
      setText(msg);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = parseISO(ts);
      const today = new Date();
      if (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      ) {
        return format(d, "h:mm a");
      }
      return format(d, "MMM d, h:mm a");
    } catch { return ""; }
  };

  return (
    <div className="absolute inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-4 shrink-0"
        style={{ background: "hsl(213 82% 42%)" }}
      >
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {currentRole === "store" ? customerName : storeName}
          </p>
          <p className="text-xs text-blue-200 truncate">
            {currentRole === "store" ? `Booking #${reservationId.slice(-6).toUpperCase()}` : storeName}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-semibold text-foreground">Start the conversation</p>
            <p className="text-xs text-muted-foreground">
              Send a message to {otherName}
            </p>
          </div>
        ) : (
          <>
            {messages.map((m, i) => {
              const isMine = m.sender_role === currentRole;
              const showTime =
                i === messages.length - 1 ||
                new Date(messages[i + 1]?.created_at).getTime() - new Date(m.created_at).getTime() > 5 * 60 * 1000;

              return (
                <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-[hsl(213_82%_42%)] text-white rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}
                  >
                    {m.message}
                  </div>
                  {showTime && (
                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                      {formatTime(m.created_at)}
                      {isMine && <span className="ml-1">{m.read ? " ✓✓" : " ✓"}</span>}
                    </p>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 border-t border-border bg-background shrink-0 flex items-center gap-2">
        <input
          ref={inputRef}
          data-testid="input-message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={`Message ${otherName}…`}
          className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-secondary text-sm text-foreground placeholder:text-muted-foreground border border-border outline-none focus:border-primary transition-colors"
        />
        <button
          data-testid="button-send-message"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-40 active:scale-90 transition-all shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};

export default ChatScreen;
