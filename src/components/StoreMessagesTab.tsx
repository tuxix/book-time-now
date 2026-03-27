import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, RefreshCw, User } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import ChatScreen from "@/components/ChatScreen";

interface Conversation {
  reservationId: string;
  customerName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderRole: "store" | "customer";
  unreadCount: number;
}

interface StoreMessagesTabProps {
  storeId: string;
  storeName: string;
  onUnreadChange?: (n: number) => void;
  autoOpen?: { reservationId: string; customerName: string } | null;
  onAutoOpenHandled?: () => void;
}

const StoreMessagesTab = ({ storeId, storeName, onUnreadChange, autoOpen, onAutoOpenHandled }: StoreMessagesTabProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatTarget, setChatTarget] = useState<{
    reservationId: string;
    customerName: string;
  } | null>(null);

  // Auto-open a specific conversation when navigated from a booking card
  useEffect(() => {
    if (autoOpen) {
      setChatTarget({ reservationId: autoOpen.reservationId, customerName: autoOpen.customerName });
      onAutoOpenHandled?.();
    }
  }, [autoOpen]);

  const fetchConversations = async () => {
    const { data: reservations } = await supabase
      .from("reservations")
      .select("id, customer_name, customer_label")
      .eq("store_id", storeId);

    if (!reservations || reservations.length === 0) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const resIds = reservations.map((r) => r.id);

    const customerNameMap: Record<string, string> = {};
    for (const r of reservations) {
      customerNameMap[r.id] = r.customer_name || r.customer_label || "Customer";
    }

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

    const seen = new Set<string>();
    const convMap: Record<string, Conversation> = {};

    for (const m of messages) {
      if (!seen.has(m.reservation_id)) {
        seen.add(m.reservation_id);
        convMap[m.reservation_id] = {
          reservationId: m.reservation_id,
          customerName: customerNameMap[m.reservation_id] ?? "Customer",
          lastMessage: m.message,
          lastMessageAt: m.created_at,
          lastSenderRole: m.sender_role as "store" | "customer",
          unreadCount: 0,
        };
      }
    }

    for (const m of messages) {
      if (m.sender_role === "customer" && !m.read) {
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
    if (!storeId) return;
    fetchConversations();

    const channel = supabase
      .channel(`store-messages-tab-${storeId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "messages" },
        fetchConversations
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [storeId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
        <div>
          <h2 className="text-base font-bold text-foreground">Customer Messages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {conversations.length === 0
              ? "No conversations yet"
              : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          data-testid="button-refresh-store-messages"
          onClick={() => { setRefreshing(true); fetchConversations(); }}
          className={`p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all ${refreshing ? "animate-spin" : ""}`}
        >
          <RefreshCw size={15} className="text-muted-foreground" />
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-muted-foreground opacity-40" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No messages yet</p>
          <p className="text-xs text-muted-foreground">
            Conversations from your customers will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {conversations.map((c) => (
            <button
              key={c.reservationId}
              data-testid={`store-conversation-${c.reservationId}`}
              onClick={() => setChatTarget({ reservationId: c.reservationId, customerName: c.customerName })}
              className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-secondary/50 active:bg-secondary transition-colors text-left"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 relative">
                <User size={22} className="text-primary" />
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
                    {c.customerName}
                  </p>
                  <p className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(parseISO(c.lastMessageAt), { addSuffix: true })}
                  </p>
                </div>
                <p className={`text-xs truncate ${c.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {c.lastSenderRole === "store" ? "You: " : ""}{c.lastMessage}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chat overlay */}
      {chatTarget && (
        <div className="fixed inset-0 z-50">
          <ChatScreen
            reservationId={chatTarget.reservationId}
            storeName={storeName}
            customerName={chatTarget.customerName}
            currentRole="store"
            onBack={() => {
              setChatTarget(null);
              fetchConversations();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default StoreMessagesTab;
