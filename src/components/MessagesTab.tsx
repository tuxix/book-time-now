import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, RefreshCw, Store } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import ChatScreen from "@/components/ChatScreen";

interface Conversation {
  reservationId: string;
  storeName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderRole: "store" | "customer";
  unreadCount: number;
}

interface MessagesTabProps {
  onUnreadChange?: (n: number) => void;
  autoOpen?: { reservationId: string; storeName: string; customerName: string } | null;
  onAutoOpenHandled?: () => void;
}

const MessagesTab = ({ onUnreadChange, autoOpen, onAutoOpenHandled }: MessagesTabProps) => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatTarget, setChatTarget] = useState<{
    reservationId: string;
    storeName: string;
    customerName: string;
  } | null>(null);

  // Auto-open a conversation when navigated from a booking card
  useEffect(() => {
    if (autoOpen) {
      setChatTarget(autoOpen);
      onAutoOpenHandled?.();
    }
  }, [autoOpen]);

  const customerName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Customer";

  const fetchConversations = async () => {
    if (!user) return;

    const { data: reservations } = await supabase
      .from("reservations")
      .select("id, stores(name)")
      .eq("user_id", user.id);

    if (!reservations || reservations.length === 0) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const resIds = reservations.map((r) => r.id);

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .in("reservation_id", resIds)
      .order("created_at", { ascending: false });

    if (!messages || messages.length === 0) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const storeNameMap: Record<string, string> = {};
    for (const r of reservations) {
      storeNameMap[r.id] = (r.stores as any)?.name ?? "Store";
    }

    const seen = new Set<string>();
    const convMap: Record<string, Conversation> = {};

    for (const m of messages) {
      if (!seen.has(m.reservation_id)) {
        seen.add(m.reservation_id);
        convMap[m.reservation_id] = {
          reservationId: m.reservation_id,
          storeName: storeNameMap[m.reservation_id] ?? "Store",
          lastMessage: m.message,
          lastMessageAt: m.created_at,
          lastSenderRole: m.sender_role as "store" | "customer",
          unreadCount: 0,
        };
      }
    }

    for (const m of messages) {
      if (m.sender_role === "store" && !m.read) {
        if (convMap[m.reservation_id]) {
          convMap[m.reservation_id].unreadCount += 1;
        }
      }
    }

    const sorted = Object.values(convMap).sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    setConversations(sorted);
    const totalUnread = sorted.reduce((sum, c) => sum + c.unreadCount, 0);
    onUnreadChange?.(totalUnread);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel(`messages-tab-${user?.id}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "messages" },
        fetchConversations
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  if (loading) {
    return (
      <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3" style={{ bottom: 56 }}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto bg-background slide-in-right" style={{ bottom: 56 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-5 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
        <button
          data-testid="button-refresh-messages"
          onClick={handleRefresh}
          className={`p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all ${refreshing ? "animate-spin" : ""}`}
        >
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-muted-foreground opacity-40" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No messages yet</p>
          <p className="text-xs text-muted-foreground">
            When you message a store from a booking, conversations will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {conversations.map((c) => (
            <button
              key={c.reservationId}
              data-testid={`conversation-${c.reservationId}`}
              onClick={() =>
                setChatTarget({
                  reservationId: c.reservationId,
                  storeName: c.storeName,
                  customerName,
                })
              }
              className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-secondary/50 active:bg-secondary transition-colors text-left"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 relative">
                <Store size={22} className="text-primary" />
                {c.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-sm truncate ${c.unreadCount > 0 ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                    {c.storeName}
                  </p>
                  <p className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(parseISO(c.lastMessageAt), { addSuffix: true })}
                  </p>
                </div>
                <p className={`text-xs truncate ${c.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {c.lastSenderRole === "customer" ? "You: " : ""}{c.lastMessage}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chat overlay */}
      {chatTarget && (
        <ChatScreen
          reservationId={chatTarget.reservationId}
          storeName={chatTarget.storeName}
          customerName={chatTarget.customerName}
          currentRole="customer"
          onBack={() => {
            setChatTarget(null);
            fetchConversations();
          }}
        />
      )}
    </div>
  );
};

export default MessagesTab;
