import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES, DEFAULT_SERVICES } from "@/lib/categories";
import {
  LayoutDashboard, Store, Users, Flag, Calendar, LogOut,
  Search, TrendingUp, Star, Ban, CheckCircle2, X, Shield,
  DollarSign, Megaphone, MessageSquare, Phone, AlertCircle,
  Download, Send, ArrowLeft, Clock, UserCheck, Loader2,
  Trash2, ChevronDown, ChevronUp, Settings2, CreditCard, Eye,
  Bell as Bell2, Pencil, Plus, Image, RefreshCw, Tag, ToggleLeft, ToggleRight,
  Menu, Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth, subMonths, differenceInDays, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type AdminTab = "overview" | "stores" | "customers" | "reports" | "disputes" | "bugs" | "bookings" | "revenue" | "announcements" | "messages" | "platform" | "financial" | "moderation" | "communication" | "promotions";

interface StoreRow {
  id: string; name: string; category: string; address?: string; phone?: string;
  rating: number; review_count: number; is_suspended: boolean; is_approved: boolean;
  created_at: string; booking_count: number; active_slots: number;
  last_booking_date: string | null; total_revenue: number;
  subscription_tier?: string; trust_score?: number; category_locked_until?: string | null;
}
interface CustomerRow {
  id: string; full_name: string | null; phone: string | null;
  is_suspended: boolean; created_at: string; booking_count: number;
  total_spent: number; no_show_count: number; last_booking_date: string | null;
  email?: string; is_admin?: boolean;
  warning_count?: number; trust_score?: number; suspension_reason?: string | null;
}
interface PlatformSetting { id: string; key: string; value: string; updated_at: string; }
interface WordBlacklistItem { id: string; word: string; created_at: string; }
interface FlaggedMessageRow {
  id: string; store_id: string; customer_id: string; flagged_keyword: string;
  status: string; created_at: string; store_name?: string; customer_name?: string;
  message_content?: string;
}
interface StoreReviewRow {
  id: string; store_id: string; customer_id: string; rating: number;
  comment: string; created_at: string; store_name?: string; reviewer_name?: string;
}
interface StorePhotoRow {
  id: string; store_id: string; image_url: string; created_at: string; store_name?: string;
}
interface ScheduledNotifRow {
  id: string; title: string; message: string; audience: string;
  scheduled_for?: string; sent_at?: string; status: string;
  sent_count?: number; created_at: string;
}
interface ReportRow {
  id: string; store_id: string; reported_by: string; reason: string;
  status: string; created_at: string; store_name?: string;
}
interface BookingRow {
  id: string; customer_id: string; store_id: string; reservation_date: string;
  start_time: string; status: string; payment_status: string | null;
  total_amount: number | null; commitment_fee_amount: number | null;
  customer_name?: string; store_name?: string; store_category?: string;
  service_names?: string;
}
interface AnnouncementRow {
  id: string; title: string; message: string; audience: string;
  sent_by: string; created_at: string;
}
interface ConversationRow {
  key: string; customer_id: string; store_id: string;
  customer_name: string; store_name: string; last_message: string;
  last_message_at: string; reservation_id: string; has_report: boolean;
}
interface ThreadMessage {
  id: string; sender_role: string; message: string; created_at: string;
}
interface ActivityItem {
  id: string; type: "store" | "customer" | "booking" | "report";
  description: string; timestamp: string;
}
interface DisputeRow {
  id: string; reservation_id: string; customer_id: string; store_id: string;
  reason: string; description: string; evidence_url?: string;
  status: string; admin_notes?: string; created_at: string;
  customer_name?: string; store_name?: string;
  refund_amount?: number | null; refund_status?: string | null;
}
interface BugReportRow {
  id: string; user_id: string; description: string; screenshot_url?: string;
  created_at: string; user_name?: string;
}
interface PromotionRow {
  id: string; title: string; description?: string; discount_type: "percentage" | "fixed";
  discount_value: number; is_active: boolean; start_date?: string; end_date?: string;
  applies_to: "all" | "category" | "specific_stores"; category?: string; store_ids?: string[];
  created_at: string;
  usage_count?: number; total_discount_absorbed?: number;
}
interface RevenueState {
  allTime: number; thisMonth: number; thisWeek: number; avgBooking: number;
  monthly: { month: string; revenue: number; bookings: number }[];
  byCategory: { category: string; revenue: number; bookings: number }[];
  byStore: { name: string; revenue: number; bookings: number }[];
}

const downloadCSV = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const content = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const AdminDashboard = ({ onBack }: { onBack: () => void }) => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  // Overview
  const [stats, setStats] = useState({
    totalStores: 0, totalCustomers: 0, bookingsToday: 0,
    bookingsWeek: 0, bookingsMonth: 0, revenueMonth: 0, revenueAllTime: 0,
    pendingApproval: 0, unresolvedReports: 0,
    popularCategory: "—", mostActiveStore: "—",
    suspendedStores: 0, suspendedCustomers: 0,
    resolvedDisputes: 0, totalDisputes: 0,
    categoryBreakdown: [] as { cat: string; count: number }[],
    bookingsAllTime: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Stores
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storesLoading, setStoresLoading] = useState(false);
  const [contactTarget, setContactTarget] = useState<{ name: string; phone: string } | null>(null);

  // Customers
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerContactTarget, setCustomerContactTarget] = useState<{ name: string; phone: string } | null>(null);

  // Reports
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Bookings
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");

  // Revenue
  const [revenueData, setRevenueData] = useState<RevenueState | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annAudience, setAnnAudience] = useState<"all" | "stores" | "customers">("all");
  const [sendingAnn, setSendingAnn] = useState(false);

  // Messages
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [selectedConv, setSelectedConv] = useState<ConversationRow | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // Disputes
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [savingDisputeId, setSavingDisputeId] = useState<string | null>(null);

  // Bug Reports
  const [bugReports, setBugReports] = useState<BugReportRow[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [overviewBugCount, setOverviewBugCount] = useState(0);

  // Platform Management
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformEdits, setPlatformEdits] = useState<Record<string, string>>({});
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [newBlackWord, setNewBlackWord] = useState("");

  // Content Moderation
  const [storePhotos, setStorePhotos] = useState<StorePhotoRow[]>([]);
  const [storeReviews, setStoreReviews] = useState<StoreReviewRow[]>([]);
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessageRow[]>([]);
  const [wordBlacklist, setWordBlacklist] = useState<WordBlacklistItem[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationSubTab, setModerationSubTab] = useState<"photos" | "reviews" | "flagged" | "blacklist">("photos");

  // Communication
  const [scheduledNotifs, setScheduledNotifs] = useState<ScheduledNotifRow[]>([]);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifAudience, setNotifAudience] = useState<"all" | "stores" | "customers">("all");
  const [sendingNotif, setSendingNotif] = useState(false);

  // Financial
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialSubTab, setFinancialSubTab] = useState<"subscriptions" | "payouts" | "refunds">("subscriptions");
  const [payoutRows, setPayoutRows] = useState<{ store_id: string; name: string; unpaid: number; total_commission: number; booking_count: number }[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<{ id: string; store_id: string; store_name: string; note: string; created_at: string }[]>([]);
  const [proStores, setProStores] = useState<StoreRow[]>([]);
  const [premiumStores, setPremiumStores] = useState<StoreRow[]>([]);
  const [freeStores, setFreeStores] = useState<StoreRow[]>([]);

  // Store admin actions
  const [storeActionTarget, setStoreActionTarget] = useState<StoreRow | null>(null);
  const [storeActionType, setStoreActionType] = useState<"category" | "tier" | "edit" | "delete" | "notes" | null>(null);
  const [storeActionCategory, setStoreActionCategory] = useState("");
  const [storeActionTier, setStoreActionTier] = useState("");
  const [storeEditName, setStoreEditName] = useState("");
  const [storeEditDesc, setStoreEditDesc] = useState("");
  const [storeEditAddr, setStoreEditAddr] = useState("");
  const [storeEditPhone, setStoreEditPhone] = useState("");
  const [storeDeleteConfirm, setStoreDeleteConfirm] = useState("");
  const [storeAdminNote, setStoreAdminNote] = useState("");
  const [savingStoreAction, setSavingStoreAction] = useState(false);

  // Customer admin actions
  const [customerActionTarget, setCustomerActionTarget] = useState<CustomerRow | null>(null);
  const [customerActionType, setCustomerActionType] = useState<"bookings" | "warning" | null>(null);
  const [customerBookings, setCustomerBookings] = useState<BookingRow[]>([]);
  const [customerBookingsLoading, setCustomerBookingsLoading] = useState(false);
  const [suspendReasonTarget, setSuspendReasonTarget] = useState<CustomerRow | null>(null);
  const [suspendReasonText, setSuspendReasonText] = useState("");
  const [savingSuspend, setSavingSuspend] = useState(false);
  // Dispute refund amounts (editable per dispute)
  const [disputeRefundAmounts, setDisputeRefundAmounts] = useState<Record<string, string>>({});

  // Admin grant
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  // Promotions
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [promoForm, setPromoForm] = useState({
    title: "", description: "", discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "", start_date: "", end_date: "",
    applies_to: "all" as "all" | "category" | "specific_stores",
    category: "", store_ids: [] as string[], activate_immediately: true,
  });
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null);
  const [promoDeleteConfirm, setPromoDeleteConfirm] = useState<string | null>(null);
  const [promoStoreSearch, setPromoStoreSearch] = useState("");
  const [promoImpact, setPromoImpact] = useState<{
    monthDiscount: number; allTimeDiscount: number;
    monthBookings: number; avgDiscount: number;
    netCommissionMonth: number; netCommissionAllTime: number;
  } | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { fetchStats(); fetchActivity(); fetchOverviewBugCount(); }, []);
  useEffect(() => {
    if (activeTab === "stores") fetchStores();
    else if (activeTab === "customers") fetchCustomers();
    else if (activeTab === "reports") fetchReports();
    else if (activeTab === "disputes") fetchDisputes();
    else if (activeTab === "bugs") fetchBugReports();
    else if (activeTab === "bookings") fetchBookings();
    else if (activeTab === "revenue") fetchRevenue();
    else if (activeTab === "announcements") fetchAnnouncements();
    else if (activeTab === "messages") fetchConversations();
    else if (activeTab === "platform") fetchPlatformSettings();
    else if (activeTab === "moderation") fetchModerationData();
    else if (activeTab === "communication") fetchCommunicationData();
    else if (activeTab === "financial") fetchFinancialData();
    else if (activeTab === "promotions") { fetchPromotions(); fetchPromoImpact(); if (stores.length === 0) fetchStores(); }
  }, [activeTab]);

  // ── Fetch stats ───────────────────────────────────────────────────────────
  const fetchStats = async () => {
    setStatsLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    const [storesRes, custRes, todayRes, weekRes, monthRes, revMonthRes, revAllRes,
           pendingRes, unresolvedRes, catRes,
           suspStoresRes, suspCustRes, allBkRes, disputeRes, storeCatRes] = await Promise.all([
      supabase.from("stores").select("id", { count: "exact" }),
      supabase.from("profiles").select("id", { count: "exact" }).eq("role", "customer"),
      supabase.from("reservations").select("id", { count: "exact" }).eq("reservation_date", today),
      supabase.from("reservations").select("id", { count: "exact" }).gte("reservation_date", weekStart),
      supabase.from("reservations").select("id", { count: "exact" }).gte("reservation_date", monthStart),
      supabase.from("reservations").select("total_amount").eq("status", "completed").gte("reservation_date", monthStart),
      supabase.from("reservations").select("total_amount").eq("status", "completed"),
      supabase.from("stores").select("id", { count: "exact" }).eq("is_approved", false).eq("is_suspended", false),
      supabase.from("store_reports").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("reservations").select("store_id, stores(name, category)").gte("reservation_date", monthStart),
      supabase.from("stores").select("id", { count: "exact" }).eq("is_suspended", true),
      supabase.from("profiles").select("id", { count: "exact" }).eq("role", "customer").eq("is_suspended", true),
      supabase.from("reservations").select("id", { count: "exact" }),
      supabase.from("disputes").select("id, status"),
      supabase.from("stores").select("category"),
    ]);

    const revMonth = (revMonthRes.data ?? []).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);
    const revAll = (revAllRes.data ?? []).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);

    const catCount: Record<string, number> = {};
    const storeCount: Record<string, { name: string; count: number }> = {};
    (catRes.data ?? []).forEach((r: any) => {
      const cat = r.stores?.category ?? "Other";
      catCount[cat] = (catCount[cat] ?? 0) + 1;
      if (r.store_id) {
        if (!storeCount[r.store_id]) storeCount[r.store_id] = { name: r.stores?.name ?? "Store", count: 0 };
        storeCount[r.store_id].count++;
      }
    });
    const popCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const activeStore = Object.values(storeCount).sort((a, b) => b.count - a.count)[0]?.name ?? "—";

    const storeCatCount: Record<string, number> = {};
    (storeCatRes.data ?? []).forEach((s: any) => { storeCatCount[s.category] = (storeCatCount[s.category] ?? 0) + 1; });
    const catBreakdown = Object.entries(storeCatCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, count]) => ({ cat, count }));
    const disputeList = (disputeRes.data ?? []) as any[];
    const resolvedDisputes = disputeList.filter(d => d.status === "resolved").length;

    setStats({
      totalStores: storesRes.count ?? 0,
      totalCustomers: custRes.count ?? 0,
      bookingsToday: todayRes.count ?? 0,
      bookingsWeek: weekRes.count ?? 0,
      bookingsMonth: monthRes.count ?? 0,
      revenueMonth: revMonth,
      revenueAllTime: revAll,
      pendingApproval: pendingRes.count ?? 0,
      unresolvedReports: unresolvedRes.count ?? 0,
      popularCategory: popCat,
      mostActiveStore: activeStore,
      suspendedStores: suspStoresRes.count ?? 0,
      suspendedCustomers: suspCustRes.count ?? 0,
      resolvedDisputes,
      totalDisputes: disputeList.length,
      categoryBreakdown: catBreakdown,
      bookingsAllTime: allBkRes.count ?? 0,
    });
    setStatsLoading(false);
  };

  // ── Fetch activity ────────────────────────────────────────────────────────
  const fetchActivity = async () => {
    setActivityLoading(true);
    const [storesRes, custsRes, booksRes, reportsRes] = await Promise.all([
      supabase.from("stores").select("id, name, category, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("profiles").select("id, full_name, created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(10),
      supabase.from("reservations").select("id, reservation_date, start_time, created_at, stores(name), profiles!reservations_customer_id_fkey(full_name)").order("created_at", { ascending: false }).limit(10),
      supabase.from("store_reports").select("id, reason, created_at, stores(name)").order("created_at", { ascending: false }).limit(10),
    ]);

    const items: ActivityItem[] = [];
    (storesRes.data ?? []).forEach((s: any) => items.push({ id: `s-${s.id}`, type: "store", description: `New store registered: ${s.name} (${s.category})`, timestamp: s.created_at }));
    (custsRes.data ?? []).forEach((c: any) => items.push({ id: `c-${c.id}`, type: "customer", description: `New customer signed up: ${c.full_name ?? "Anonymous"}`, timestamp: c.created_at }));
    (booksRes.data ?? []).forEach((b: any) => items.push({ id: `b-${b.id}`, type: "booking", description: `New booking: ${b.profiles?.full_name ?? "Customer"} → ${b.stores?.name ?? "Store"} on ${b.reservation_date} at ${b.start_time?.slice(0, 5)}`, timestamp: b.created_at }));
    (reportsRes.data ?? []).forEach((r: any) => items.push({ id: `r-${r.id}`, type: "report", description: `Report submitted: ${r.stores?.name ?? "Store"} — ${r.reason?.slice(0, 60)}`, timestamp: r.created_at }));

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivity(items.slice(0, 10));
    setActivityLoading(false);
  };

  // ── Fetch stores ──────────────────────────────────────────────────────────
  const fetchStores = async () => {
    setStoresLoading(true);
    const { data } = await supabase
      .from("stores")
      .select("id, name, category, address, phone, rating, review_count, is_suspended, is_approved, created_at, subscription_tier, category_locked_until")
      .order("created_at", { ascending: false });
    if (data) {
      const ids = data.map((s: any) => s.id);
      const [bookRes, slotsRes, lastBkRes, revRes] = await Promise.all([
        supabase.from("reservations").select("store_id").in("store_id", ids),
        supabase.from("store_time_slots").select("store_id").in("store_id", ids),
        supabase.from("reservations").select("store_id, reservation_date").in("store_id", ids).order("reservation_date", { ascending: false }),
        supabase.from("reservations").select("store_id, total_amount").eq("status", "completed").in("store_id", ids),
      ]);
      const bkMap: Record<string, number> = {};
      (bookRes.data ?? []).forEach((r: any) => { bkMap[r.store_id] = (bkMap[r.store_id] ?? 0) + 1; });
      const slotMap: Record<string, number> = {};
      (slotsRes.data ?? []).forEach((r: any) => { slotMap[r.store_id] = (slotMap[r.store_id] ?? 0) + 1; });
      const lastBkMap: Record<string, string> = {};
      (lastBkRes.data ?? []).forEach((r: any) => { if (!lastBkMap[r.store_id]) lastBkMap[r.store_id] = r.reservation_date; });
      const revMap: Record<string, number> = {};
      (revRes.data ?? []).forEach((r: any) => { revMap[r.store_id] = (revMap[r.store_id] ?? 0) + (r.total_amount ?? 0); });
      setStores(data.map((s: any) => ({
        ...s,
        booking_count: bkMap[s.id] ?? 0,
        active_slots: slotMap[s.id] ?? 0,
        last_booking_date: lastBkMap[s.id] ?? null,
        total_revenue: revMap[s.id] ?? 0,
      })));
    }
    setStoresLoading(false);
  };

  // ── Fetch customers ────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    setCustomersLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, is_suspended, created_at, warning_count, trust_score, suspension_reason")
      .eq("role", "customer")
      .order("created_at", { ascending: false });
    if (data) {
      const ids = data.map((p: any) => p.id);
      const [spentRes, noShowRes, lastBkRes, bkCountRes] = await Promise.all([
        supabase.from("reservations").select("customer_id, total_amount").eq("status", "completed").in("customer_id", ids),
        supabase.from("reservations").select("customer_id").eq("status", "no_show").in("customer_id", ids),
        supabase.from("reservations").select("customer_id, reservation_date").in("customer_id", ids).order("reservation_date", { ascending: false }),
        supabase.from("reservations").select("customer_id").in("customer_id", ids),
      ]);
      const spentMap: Record<string, number> = {};
      (spentRes.data ?? []).forEach((r: any) => { spentMap[r.customer_id] = (spentMap[r.customer_id] ?? 0) + (r.total_amount ?? 0); });
      const nsMap: Record<string, number> = {};
      (noShowRes.data ?? []).forEach((r: any) => { nsMap[r.customer_id] = (nsMap[r.customer_id] ?? 0) + 1; });
      const lastMap: Record<string, string> = {};
      (lastBkRes.data ?? []).forEach((r: any) => { if (!lastMap[r.customer_id]) lastMap[r.customer_id] = r.reservation_date; });
      const bkMap: Record<string, number> = {};
      (bkCountRes.data ?? []).forEach((r: any) => { bkMap[r.customer_id] = (bkMap[r.customer_id] ?? 0) + 1; });
      setCustomers(data.map((p: any) => ({
        ...p,
        booking_count: bkMap[p.id] ?? 0,
        total_spent: spentMap[p.id] ?? 0,
        no_show_count: nsMap[p.id] ?? 0,
        last_booking_date: lastMap[p.id] ?? null,
      })));
    }
    setCustomersLoading(false);
  };

  // ── Fetch reports ─────────────────────────────────────────────────────────
  const fetchReports = async () => {
    setReportsLoading(true);
    const { data } = await supabase.from("store_reports").select("*, stores(name)").order("created_at", { ascending: false });
    if (data) setReports(data.map((r: any) => ({ ...r, store_name: r.stores?.name ?? "Store" })));
    setReportsLoading(false);
  };

  // ── Fetch bookings ────────────────────────────────────────────────────────
  const fetchBookings = async () => {
    setBookingsLoading(true);
    let q = supabase
      .from("reservations")
      .select("id, customer_id, store_id, reservation_date, start_time, status, payment_status, total_amount, commitment_fee_amount, stores(name, category), reservation_services(service_name)")
      .order("reservation_date", { ascending: false })
      .limit(200);
    if (bookingDateFilter) q = q.eq("reservation_date", bookingDateFilter);
    if (bookingStatusFilter) q = q.eq("status", bookingStatusFilter);
    const { data } = await q;
    if (data) {
      const cids = [...new Set(data.map((r: any) => r.customer_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", cids);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? "Customer"; });
      setBookings(data.map((r: any) => ({
        ...r,
        customer_name: nameMap[r.customer_id] ?? "Customer",
        store_name: r.stores?.name ?? "Store",
        store_category: r.stores?.category ?? "",
        service_names: (r.reservation_services ?? []).map((s: any) => s.service_name).filter(Boolean).join(", ") || "—",
      })));
    }
    setBookingsLoading(false);
  };

  // ── Fetch revenue ─────────────────────────────────────────────────────────
  const fetchRevenue = async () => {
    setRevenueLoading(true);
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const { data } = await supabase
      .from("reservations")
      .select("total_amount, reservation_date, store_id, stores(name, category)")
      .eq("status", "completed");
    if (data) {
      const allTime = data.reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);
      const thisMonth = data.filter((r: any) => r.reservation_date >= monthStart).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);
      const thisWeek = data.filter((r: any) => r.reservation_date >= weekStart).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);
      const avg = data.length > 0 ? allTime / data.length : 0;

      const monthMap: Record<string, { revenue: number; bookings: number }> = {};
      data.forEach((r: any) => {
        const key = r.reservation_date?.slice(0, 7);
        if (!key) return;
        if (!monthMap[key]) monthMap[key] = { revenue: 0, bookings: 0 };
        monthMap[key].revenue += r.total_amount ?? 0;
        monthMap[key].bookings += 1;
      });
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(new Date(), 11 - i);
        const key = format(d, "yyyy-MM");
        return { month: format(d, "MMM yy"), revenue: monthMap[key]?.revenue ?? 0, bookings: monthMap[key]?.bookings ?? 0 };
      });

      const catMap: Record<string, { revenue: number; bookings: number }> = {};
      data.forEach((r: any) => {
        const cat = r.stores?.category ?? "Other";
        if (!catMap[cat]) catMap[cat] = { revenue: 0, bookings: 0 };
        catMap[cat].revenue += r.total_amount ?? 0;
        catMap[cat].bookings += 1;
      });

      const storeMap: Record<string, { name: string; revenue: number; bookings: number }> = {};
      data.forEach((r: any) => {
        if (!r.store_id) return;
        if (!storeMap[r.store_id]) storeMap[r.store_id] = { name: r.stores?.name ?? "Store", revenue: 0, bookings: 0 };
        storeMap[r.store_id].revenue += r.total_amount ?? 0;
        storeMap[r.store_id].bookings += 1;
      });

      setRevenueData({
        allTime, thisMonth, thisWeek, avgBooking: avg,
        monthly,
        byCategory: Object.entries(catMap).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.revenue - a.revenue),
        byStore: Object.values(storeMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      });
    }
    setRevenueLoading(false);
  };

  // ── Fetch announcements ───────────────────────────────────────────────────
  const fetchAnnouncements = async () => {
    setAnnLoading(true);
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
    setAnnLoading(false);
  };

  // ── Fetch conversations ───────────────────────────────────────────────────
  const fetchConversations = async () => {
    setMsgsLoading(true);
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, reservation_id, sender_role, message, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (msgs && msgs.length > 0) {
      const resIds = [...new Set(msgs.map((m: any) => m.reservation_id))];

      const [resRes, reportedRes] = await Promise.all([
        supabase.from("reservations").select("id, customer_id, store_id, stores(name)").in("id", resIds),
        supabase.from("store_reports").select("store_id").eq("status", "pending"),
      ]);

      const reservations = resRes.data ?? [];
      const reportedStoreIds = new Set((reportedRes.data ?? []).map((r: any) => r.store_id));

      const customerIds = [...new Set(reservations.map((r: any) => r.customer_id).filter(Boolean))];
      const { data: profilesData } = customerIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", customerIds)
        : { data: [] };
      const profileMap: Record<string, string> = {};
      (profilesData ?? []).forEach((p: any) => { profileMap[p.id] = p.full_name ?? "Customer"; });

      const resMap: Record<string, any> = {};
      reservations.forEach((r: any) => { resMap[r.id] = r; });

      const convMap: Record<string, ConversationRow> = {};
      msgs.forEach((m: any) => {
        const r = resMap[m.reservation_id];
        if (!r) return;
        const key = `${r.customer_id}_${r.store_id}`;
        if (!convMap[key]) {
          convMap[key] = {
            key, customer_id: r.customer_id, store_id: r.store_id,
            customer_name: profileMap[r.customer_id] ?? "Customer",
            store_name: r.stores?.name ?? "Store",
            last_message: m.message,
            last_message_at: m.created_at,
            reservation_id: m.reservation_id,
            has_report: reportedStoreIds.has(r.store_id),
          };
        }
      });
      setConversations(Object.values(convMap));
    } else {
      setConversations([]);
    }
    setMsgsLoading(false);
  };

  const fetchThread = async (reservationId: string) => {
    setThreadLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, sender_role, message, created_at")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: true });
    setThread(data ?? []);
    setThreadLoading(false);
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleStoreSuspend = async (s: StoreRow) => {
    const next = !s.is_suspended;
    const { error } = await supabase.from("stores").update({ is_suspended: next }).eq("id", s.id);
    if (error) { toast.error("Failed to update store"); return; }
    setStores((prev) => prev.map((x) => x.id === s.id ? { ...x, is_suspended: next } : x));
    toast.success(next ? "Store suspended" : "Store reinstated");
  };

  const toggleStoreApprove = async (s: StoreRow) => {
    const next = !s.is_approved;
    const { error } = await supabase.from("stores").update({ is_approved: next }).eq("id", s.id);
    if (error) { toast.error("Failed to update store"); return; }
    setStores((prev) => prev.map((x) => x.id === s.id ? { ...x, is_approved: next } : x));
    toast.success(next ? "Store approved" : "Store approval revoked");
    fetchStats();
  };

  const toggleCustomerSuspend = async (c: CustomerRow) => {
    if (!c.is_suspended) {
      // Open suspension reason dialog instead of suspending immediately
      setSuspendReasonTarget(c);
      setSuspendReasonText("");
      return;
    }
    // Reinstate immediately
    const { error } = await supabase.from("profiles").update({ is_suspended: false, suspension_reason: null }).eq("id", c.id);
    if (error) { toast.error("Failed to reinstate customer"); return; }
    setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, is_suspended: false, suspension_reason: null } : x));
    toast.success("Customer reinstated");
  };

  const confirmSuspendCustomer = async () => {
    if (!suspendReasonTarget) return;
    setSavingSuspend(true);
    const { error } = await supabase.from("profiles").update({
      is_suspended: true,
      suspension_reason: suspendReasonText.trim() || "Platform policy violation",
    }).eq("id", suspendReasonTarget.id);
    setSavingSuspend(false);
    if (error) { toast.error("Failed to suspend customer"); return; }
    setCustomers((prev) => prev.map((x) => x.id === suspendReasonTarget.id ? { ...x, is_suspended: true, suspension_reason: suspendReasonText.trim() || "Platform policy violation" } : x));
    setSuspendReasonTarget(null);
    setSuspendReasonText("");
    toast.success("Customer suspended");
  };

  const issueWarning = async (c: CustomerRow) => {
    const newWarningCount = (c.warning_count ?? 0) + 1;
    const newTrustScore = Math.max(0, (c.trust_score ?? 100) - 10);
    const { error } = await supabase.from("profiles").update({
      warning_count: newWarningCount,
      trust_score: newTrustScore,
    }).eq("id", c.id);
    if (error) { toast.error("Failed to issue warning"); return; }
    setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, warning_count: newWarningCount, trust_score: newTrustScore } : x));
    toast.success(`Warning issued — trust score now ${newTrustScore}`);
  };

  const dismissReport = async (id: string) => {
    const { error } = await supabase.from("store_reports").update({ status: "reviewed" }).eq("id", id);
    if (error) { toast.error("Failed to dismiss"); return; }
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "reviewed" } : r));
    toast.success("Report dismissed");
    fetchStats();
  };

  const suspendStoreFromReport = async (report: ReportRow) => {
    const { error: rErr } = await supabase.from("store_reports").update({ status: "actioned" }).eq("id", report.id);
    const { error: sErr } = await supabase.from("stores").update({ is_suspended: true }).eq("id", report.store_id);
    if (rErr || sErr) { toast.error("Failed to suspend store"); return; }
    setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: "actioned" } : r));
    toast.success("Store suspended and report actioned");
    fetchStats();
  };

  const grantAdmin = async () => {
    if (!adminEmailInput.trim()) return;
    setGrantingAdmin(true);
    const email = adminEmailInput.trim().toLowerCase();
    toast.info(`Run this SQL in Supabase:\nUPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = '${email}');`);
    setGrantingAdmin(false);
    setAdminEmailInput("");
  };

  const fetchOverviewBugCount = async () => {
    const { count } = await supabase.from("bug_reports").select("id", { count: "exact", head: true });
    setOverviewBugCount(count ?? 0);
  };

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
    if (data) {
      const disputes = data as DisputeRow[];
      const storeIds = [...new Set(disputes.map((d) => d.store_id))];
      const customerIds = [...new Set(disputes.map((d) => d.customer_id))];
      const [storesRes, profilesRes] = await Promise.all([
        storeIds.length ? supabase.from("stores").select("id, name").in("id", storeIds) : { data: [] },
        customerIds.length ? supabase.from("profiles").select("id, full_name").in("id", customerIds) : { data: [] },
      ]);
      const storeMap = new Map((storesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name]));
      setDisputes(disputes.map((d) => ({ ...d, store_name: storeMap.get(d.store_id) ?? "Unknown", customer_name: profileMap.get(d.customer_id) ?? "Unknown" })));
      const initialNotes: Record<string, string> = {};
      const initialRefunds: Record<string, string> = {};
      disputes.forEach((d) => {
        initialNotes[d.id] = d.admin_notes ?? "";
        initialRefunds[d.id] = d.refund_amount != null ? String(d.refund_amount) : "";
      });
      setDisputeNotes(initialNotes);
      setDisputeRefundAmounts(initialRefunds);
    }
    setDisputesLoading(false);
  };

  const updateDisputeStatus = async (id: string, status: string) => {
    const notes = disputeNotes[id] ?? "";
    const refundAmtStr = disputeRefundAmounts[id] ?? "";
    const refundAmount = refundAmtStr ? parseFloat(refundAmtStr) : null;
    const refundStatus = status === "resolved" && refundAmount != null ? "approved" : status === "rejected" ? "denied" : null;
    setSavingDisputeId(id);
    await supabase.from("disputes").update({
      status,
      admin_notes: notes,
      ...(refundAmount != null && { refund_amount: refundAmount }),
      ...(refundStatus && { refund_status: refundStatus }),
    }).eq("id", id);
    setSavingDisputeId(null);
    setDisputes((prev) => prev.map((d) => d.id === id ? { ...d, status, admin_notes: notes, refund_amount: refundAmount, refund_status: refundStatus } : d));
    toast.success(`Dispute ${status}`);
  };

  const fetchBugReports = async () => {
    setBugsLoading(true);
    const { data } = await supabase.from("bug_reports").select("*").order("created_at", { ascending: false });
    if (data) {
      const reports = data as BugReportRow[];
      const userIds = [...new Set(reports.map((r) => r.user_id))];
      const { data: profilesData } = userIds.length ? await supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
      const profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p.full_name]));
      setBugReports(reports.map((r) => ({ ...r, user_name: profileMap.get(r.user_id) ?? "Unknown" })));
    }
    setBugsLoading(false);
  };

  const fetchPlatformSettings = async () => {
    setPlatformLoading(true);
    const [settingsRes, blacklistRes] = await Promise.all([
      supabase.from("platform_settings").select("*").order("key"),
      supabase.from("word_blacklist").select("*").order("created_at", { ascending: false }),
    ]);
    if (settingsRes.data) {
      setPlatformSettings(settingsRes.data as PlatformSetting[]);
      const edits: Record<string, string> = {};
      (settingsRes.data as PlatformSetting[]).forEach((s) => { edits[s.key] = s.value; });
      setPlatformEdits(edits);
    }
    if (blacklistRes.data) setWordBlacklist(blacklistRes.data as WordBlacklistItem[]);
    setPlatformLoading(false);
  };

  const savePlatformSetting = async (key: string) => {
    const val = platformEdits[key];
    if (val === undefined) return;
    setSavingPlatform(true);
    await supabase.from("platform_settings").update({ value: val, updated_at: new Date().toISOString() }).eq("key", key);
    setSavingPlatform(false);
    toast.success(`${key} updated`);
  };

  const addBlacklistWord = async () => {
    if (!newBlackWord.trim()) return;
    const word = newBlackWord.trim().toLowerCase();
    const { data, error } = await supabase.from("word_blacklist").insert({ word }).select().single();
    if (error) { toast.error("Could not add word"); return; }
    setWordBlacklist((prev) => [data as WordBlacklistItem, ...prev]);
    setNewBlackWord("");
    toast.success("Word added to blacklist");
  };

  const removeBlacklistWord = async (id: string) => {
    await supabase.from("word_blacklist").delete().eq("id", id);
    setWordBlacklist((prev) => prev.filter((w) => w.id !== id));
    toast.success("Word removed");
  };

  const fetchModerationData = async () => {
    setModerationLoading(true);
    const [photosRes, reviewsRes, flaggedRes, blacklistRes] = await Promise.all([
      supabase.from("store_photos").select("id, store_id, image_url, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("reviews").select("id, store_id, customer_id, rating, comment, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("flagged_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("word_blacklist").select("*").order("created_at", { ascending: false }),
    ]);
    if (photosRes.data) {
      const photos = photosRes.data as StorePhotoRow[];
      const storeIds = [...new Set(photos.map((p) => p.store_id))];
      const { data: storesData } = storeIds.length ? await supabase.from("stores").select("id, name").in("id", storeIds) : { data: [] };
      const sm = new Map((storesData ?? []).map((s: any) => [s.id, s.name]));
      setStorePhotos(photos.map((p) => ({ ...p, store_name: sm.get(p.store_id) ?? "Unknown" })));
    }
    if (reviewsRes.data) {
      const reviews = reviewsRes.data as StoreReviewRow[];
      const sIds = [...new Set(reviews.map((r) => r.store_id))];
      const cIds = [...new Set(reviews.map((r) => r.customer_id))];
      const [sRes, pRes] = await Promise.all([
        sIds.length ? supabase.from("stores").select("id, name").in("id", sIds) : { data: [] },
        cIds.length ? supabase.from("profiles").select("id, full_name").in("id", cIds) : { data: [] },
      ]);
      const sm2 = new Map((sRes.data ?? []).map((s: any) => [s.id, s.name]));
      const pm = new Map((pRes.data ?? []).map((p: any) => [p.id, p.full_name]));
      setStoreReviews(reviews.map((r) => ({ ...r, store_name: sm2.get(r.store_id) ?? "Unknown", reviewer_name: pm.get(r.customer_id) ?? "Unknown" })));
    }
    if (flaggedRes.data) setFlaggedMessages(flaggedRes.data as FlaggedMessageRow[]);
    if (blacklistRes.data) setWordBlacklist(blacklistRes.data as WordBlacklistItem[]);
    setModerationLoading(false);
  };

  const deleteReview = async (id: string) => {
    await supabase.from("reviews").delete().eq("id", id);
    setStoreReviews((prev) => prev.filter((r) => r.id !== id));
    toast.success("Review deleted");
  };

  const deleteStorePhoto = async (photo: StorePhotoRow) => {
    await supabase.from("store_photos").delete().eq("id", photo.id);
    setStorePhotos((prev) => prev.filter((p) => p.id !== photo.id));
    toast.success("Photo removed");
  };

  const updateFlaggedStatus = async (id: string, status: string) => {
    await supabase.from("flagged_messages").update({ status }).eq("id", id);
    setFlaggedMessages((prev) => prev.map((f) => f.id === id ? { ...f, status } : f));
    toast.success(`Flagged message ${status}`);
  };

  const fetchCommunicationData = async () => {
    setCommunicationLoading(true);
    const { data } = await supabase.from("scheduled_notifications").select("*").order("created_at", { ascending: false });
    if (data) setScheduledNotifs(data as ScheduledNotifRow[]);
    setCommunicationLoading(false);
  };

  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim() || !user) return;
    setSendingNotif(true);
    const { data, error } = await supabase.from("scheduled_notifications").insert({
      title: notifTitle.trim(), message: notifMessage.trim(),
      audience: notifAudience, status: "sent", sent_at: new Date().toISOString(), created_by: user.id,
    }).select().single();
    setSendingNotif(false);
    if (error) { toast.error("Could not send notification"); return; }
    setScheduledNotifs((prev) => [data as ScheduledNotifRow, ...prev]);
    setNotifTitle(""); setNotifMessage(""); setNotifAudience("all");
    toast.success("Announcement sent!");
  };

  const cancelScheduledNotif = async (id: string) => {
    await supabase.from("scheduled_notifications").update({ status: "cancelled" }).eq("id", id);
    setScheduledNotifs((prev) => prev.map((n) => n.id === id ? { ...n, status: "cancelled" } : n));
    toast.success("Notification cancelled");
  };

  const fetchFinancialData = async () => {
    setFinancialLoading(true);
    const { data } = await supabase.from("stores").select("id, name, category, subscription_tier, created_at, booking_count, total_revenue, last_booking_date, rating, review_count, is_suspended, is_approved, active_slots").order("name");
    if (data) {
      const all = data as StoreRow[];
      setProStores(all.filter((s) => s.subscription_tier === "pro"));
      setPremiumStores(all.filter((s) => s.subscription_tier === "premium"));
      setFreeStores(all.filter((s) => !s.subscription_tier || s.subscription_tier === "free"));
    }
    setFinancialLoading(false);
  };

  const fetchPayoutsData = async () => {
    setPayoutsLoading(true);
    const [{ data }, { data: noteData }] = await Promise.all([
      supabase
        .from("reservations")
        .select("store_id, store_earnings, commission_amount, total_amount, payout_status, stores(name)")
        .eq("status", "completed"),
      supabase
        .from("admin_store_notes")
        .select("id, store_id, note, created_at, stores(name)")
        .like("note", "PAYOUT_REQUEST:%")
        .order("created_at", { ascending: false }),
    ]);
    if (data) {
      const storeMap: Record<string, { name: string; unpaid: number; total_commission: number; booking_count: number }> = {};
      (data as any[]).forEach((r) => {
        if (!r.store_id) return;
        if (!storeMap[r.store_id]) storeMap[r.store_id] = { name: r.stores?.name ?? "Store", unpaid: 0, total_commission: 0, booking_count: 0 };
        const earnings = r.store_earnings ?? (r.total_amount ? Math.round(r.total_amount * 0.9) : 0);
        const commission = r.commission_amount ?? (r.total_amount ? Math.round(r.total_amount * 0.1) : 0);
        storeMap[r.store_id].booking_count += 1;
        storeMap[r.store_id].total_commission += commission;
        if (r.payout_status === "unpaid" || !r.payout_status) {
          storeMap[r.store_id].unpaid += earnings;
        }
      });
      const rows = Object.entries(storeMap)
        .map(([store_id, v]) => ({ store_id, ...v }))
        .filter((r) => r.unpaid > 0)
        .sort((a, b) => b.unpaid - a.unpaid);
      setPayoutRows(rows);
    }
    if (noteData) {
      setPayoutRequests(
        (noteData as any[]).map((n) => ({
          id: n.id,
          store_id: n.store_id,
          store_name: n.stores?.name ?? "Store",
          note: n.note,
          created_at: n.created_at,
        }))
      );
    }
    setPayoutsLoading(false);
  };

  // ── Promotions ─────────────────────────────────────────────────────────────
  const fetchPromotions = async () => {
    setPromotionsLoading(true);
    const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
    if (data) setPromotions(data as PromotionRow[]);
    setPromotionsLoading(false);
  };

  const fetchPromoImpact = async () => {
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const { data } = await supabase
      .from("reservations")
      .select("discount_amount, commission_amount, total_amount, reservation_date, promotion_id")
      .not("promotion_id", "is", null);
    if (data) {
      const all = data as any[];
      const thisMonth = all.filter((r) => r.reservation_date >= monthStart);
      const monthDiscount = thisMonth.reduce((s, r) => s + (r.discount_amount ?? 0), 0);
      const allTimeDiscount = all.reduce((s, r) => s + (r.discount_amount ?? 0), 0);
      const monthCommission = thisMonth.reduce((s, r) => s + (r.commission_amount ?? (r.total_amount ? Math.round(r.total_amount * 0.1) : 0)), 0);
      const allTimeCommission = all.reduce((s, r) => s + (r.commission_amount ?? (r.total_amount ? Math.round(r.total_amount * 0.1) : 0)), 0);
      setPromoImpact({
        monthDiscount,
        allTimeDiscount,
        monthBookings: thisMonth.length,
        avgDiscount: all.length > 0 ? Math.round(allTimeDiscount / all.length) : 0,
        netCommissionMonth: Math.max(0, monthCommission - monthDiscount),
        netCommissionAllTime: Math.max(0, allTimeCommission - allTimeDiscount),
      });
    }
  };

  const triggerPromoAnnouncement = async (promo: PromotionRow, ended = false) => {
    if (!user) return;
    const label = promo.discount_type === "percentage"
      ? `${promo.discount_value}% off`
      : `J$${promo.discount_value} off`;
    const applyStr = promo.applies_to === "category" && promo.category
      ? ` on ${promo.category} services`
      : promo.applies_to === "specific_stores" ? " at selected stores" : "";
    const title = ended ? "Promo Ended" : "Rezo Promo Live 🎉";
    const message = ended
      ? `The Rezo promo has ended. Thank you to everyone who took advantage. Stay tuned for future promotions.`
      : `Enjoy ${label} bookings${applyStr} for a limited time. Book now before it ends!`;
    await supabase.from("announcements").insert({ title, message, audience: "all", sent_by: user.id });
  };

  const createPromotion = async () => {
    if (!promoForm.title.trim() || !promoForm.discount_value) {
      toast.error("Title and discount value are required"); return;
    }
    setCreatingPromo(true);
    const payload: any = {
      title: promoForm.title.trim(),
      description: promoForm.description.trim() || null,
      discount_type: promoForm.discount_type,
      discount_value: parseFloat(promoForm.discount_value),
      is_active: promoForm.activate_immediately,
      applies_to: promoForm.applies_to,
      category: promoForm.applies_to === "category" ? promoForm.category || null : null,
      store_ids: promoForm.applies_to === "specific_stores" ? promoForm.store_ids : null,
      start_date: promoForm.start_date ? new Date(promoForm.start_date).toISOString() : null,
      end_date: promoForm.end_date ? new Date(promoForm.end_date).toISOString() : null,
    };
    const { data, error } = await supabase.from("promotions").insert(payload).select().single();
    setCreatingPromo(false);
    if (error) { toast.error("Failed to create promotion"); return; }
    setPromotions((prev) => [data as PromotionRow, ...prev]);
    if (promoForm.activate_immediately) await triggerPromoAnnouncement(data as PromotionRow);
    setPromoForm({
      title: "", description: "", discount_type: "percentage", discount_value: "",
      start_date: "", end_date: "", applies_to: "all", category: "",
      store_ids: [], activate_immediately: true,
    });
    toast.success("Promotion created!");
  };

  const togglePromotion = async (promo: PromotionRow) => {
    const next = !promo.is_active;
    const { error } = await supabase.from("promotions").update({ is_active: next }).eq("id", promo.id);
    if (error) { toast.error("Failed to update promotion"); return; }
    setPromotions((prev) => prev.map((p) => p.id === promo.id ? { ...p, is_active: next } : p));
    if (next) await triggerPromoAnnouncement(promo);
    else await triggerPromoAnnouncement(promo, true);
    toast.success(next ? "Promotion activated" : "Promotion deactivated");
  };

  const deletePromotion = async (id: string) => {
    const promo = promotions.find((p) => p.id === id);
    setDeletingPromoId(id);
    if (promo?.is_active) await triggerPromoAnnouncement(promo, true);
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    setDeletingPromoId(null);
    if (error) { toast.error("Failed to delete promotion"); return; }
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    setPromoDeleteConfirm(null);
    toast.success("Promotion deleted");
  };

  // ── Store admin actions ────────────────────────────────────────────────────
  const openStoreAction = (s: StoreRow, type: typeof storeActionType) => {
    setStoreActionTarget(s);
    setStoreActionType(type);
    if (type === "category") setStoreActionCategory(s.category);
    if (type === "tier") setStoreActionTier(s.subscription_tier ?? "free");
    if (type === "edit") { setStoreEditName(s.name); setStoreEditDesc(""); setStoreEditAddr(s.address ?? ""); setStoreEditPhone(s.phone ?? ""); }
    if (type === "notes") setStoreAdminNote("");
    if (type === "delete") setStoreDeleteConfirm("");
  };

  const saveStoreAction = async () => {
    if (!storeActionTarget) return;
    setSavingStoreAction(true);
    const id = storeActionTarget.id;
    if (storeActionType === "category") {
      const { data: catData, error: catErr } = await supabase.from("stores").update({ category: storeActionCategory, category_locked_until: null }).eq("id", id).select("id");
      if (catErr || !catData?.length) { toast.error("Failed to update category — permission denied"); setSavingStoreAction(false); return; }
      // Delete/disable all existing services and seed defaults for the new category
      const { data: existingSvcs } = await supabase.from("store_services").select("id").eq("store_id", id);
      if (existingSvcs && existingSvcs.length > 0) {
        const svcIds = existingSvcs.map((s) => s.id);
        const { data: refSvcs } = await supabase.from("reservation_service_selections").select("service_id").in("service_id", svcIds);
        const refSet = new Set((refSvcs ?? []).map((r) => r.service_id));
        const deletable = svcIds.filter((sid) => !refSet.has(sid));
        const locked = svcIds.filter((sid) => refSet.has(sid));
        if (deletable.length > 0) await supabase.from("store_services").delete().in("id", deletable);
        if (locked.length > 0) await supabase.from("store_services").update({ is_archived: true }).in("id", locked);
      }
      const defaults = DEFAULT_SERVICES[storeActionCategory] ?? [];
      if (defaults.length > 0) {
        const tier = storeActionTarget.subscription_tier ?? "free";
        const svcLimit = tier === "free" ? 3 : Infinity;
        const rows = defaults.map((d, i) => ({
          store_id: id,
          name: d.name,
          base_price: d.price,
          duration_minutes: d.duration,
          sort_order: i,
          is_active: tier === "free" ? i < svcLimit : true,
        }));
        await supabase.from("store_services").insert(rows);
      }
      setStores((prev) => prev.map((s) => s.id === id ? { ...s, category: storeActionCategory, category_locked_until: null } : s));
      toast.success(`Category updated for ${storeActionTarget.name}`);
    } else if (storeActionType === "tier") {
      const { data: tierData, error: tierErr } = await supabase.from("stores").update({ subscription_tier: storeActionTier }).eq("id", id).select("id");
      if (tierErr || !tierData?.length) { toast.error("Failed to update tier — permission denied"); setSavingStoreAction(false); return; }
      setStores((prev) => prev.map((s) => s.id === id ? { ...s, subscription_tier: storeActionTier } : s));
      toast.success(`${storeActionTarget.name} updated to ${storeActionTier}`);
    } else if (storeActionType === "edit") {
      const updates: any = {};
      if (storeEditName.trim()) updates.name = storeEditName.trim();
      if (storeEditAddr.trim()) updates.address = storeEditAddr.trim();
      if (storeEditPhone.trim()) updates.phone = storeEditPhone.trim();
      const { data: editData, error: editErr } = await supabase.from("stores").update(updates).eq("id", id).select("id");
      if (editErr || !editData?.length) { toast.error("Failed to update store details — permission denied"); setSavingStoreAction(false); return; }
      setStores((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
      toast.success("Store details updated");
    } else if (storeActionType === "delete") {
      if (storeDeleteConfirm !== "DELETE") { toast.error("Type DELETE to confirm"); setSavingStoreAction(false); return; }
      const { error: delErr } = await supabase.from("stores").delete().eq("id", id);
      if (delErr) { toast.error("Failed to delete store — permission denied"); setSavingStoreAction(false); return; }
      setStores((prev) => prev.filter((s) => s.id !== id));
      toast.success("Store permanently deleted");
    } else if (storeActionType === "notes") {
      const { error: noteErr } = await supabase.from("admin_store_notes").insert({ store_id: id, admin_id: user!.id, note: storeAdminNote.trim() });
      if (noteErr) { toast.error("Failed to save note"); setSavingStoreAction(false); return; }
      toast.success("Note saved");
    }
    setSavingStoreAction(false);
    setStoreActionTarget(null);
    setStoreActionType(null);
  };

  const resetCategoryLock = async (s: StoreRow) => {
    const { data, error } = await supabase.from("stores").update({ category_locked_until: null }).eq("id", s.id).select("id");
    if (error || !data?.length) { toast.error("Failed to unlock category — permission denied"); return; }
    setStores((prev) => prev.map((st) => st.id === s.id ? { ...st, category_locked_until: null } : st));
    toast.success(`Category lock cleared for ${s.name}`);
  };

  const sendPasswordReset = async (email: string | undefined) => {
    if (!email) { toast.error("No email on file"); return; }
    await supabase.auth.resetPasswordForEmail(email);
    toast.success("Password reset email sent");
  };

  const viewCustomerBookings = async (c: CustomerRow) => {
    setCustomerActionTarget(c);
    setCustomerActionType("bookings");
    setCustomerBookingsLoading(true);
    const { data } = await supabase.from("reservations")
      .select("id, store_id, reservation_date, start_time, status, total_amount, commitment_fee_amount, payment_status, reservation_services(*)")
      .eq("customer_id", c.id).order("reservation_date", { ascending: false }).limit(30);
    if (data) {
      const sIds = [...new Set((data as any[]).map((b) => b.store_id))];
      const { data: sData } = sIds.length ? await supabase.from("stores").select("id, name").in("id", sIds) : { data: [] };
      const sm = new Map((sData ?? []).map((s: any) => [s.id, s.name]));
      setCustomerBookings((data as any[]).map((b) => ({ ...b, store_name: sm.get(b.store_id) ?? "Unknown", customer_name: c.full_name ?? "Unknown" })));
    }
    setCustomerBookingsLoading(false);
  };

  const sendAnnouncement = async () => {
    if (!annTitle.trim() || !annMessage.trim()) { toast.error("Title and message required"); return; }
    if (!user) return;
    setSendingAnn(true);
    const { error } = await supabase.from("announcements").insert({ title: annTitle.trim(), message: annMessage.trim(), audience: annAudience, sent_by: user.id });
    if (error) { toast.error("Failed to send announcement"); setSendingAnn(false); return; }
    toast.success("Announcement sent!");
    setAnnTitle(""); setAnnMessage(""); setAnnAudience("all");
    setSendingAnn(false);
    fetchAnnouncements();
    fetchStats();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    toast.success("Announcement deleted");
  };

  // ── CSV exports ───────────────────────────────────────────────────────────
  const exportStoresCSV = () => {
    const headers = ["Name", "Category", "Rating", "Total Bookings", "Revenue (J$)", "Address", "Phone", "Active Slots", "Last Booking", "Approved", "Suspended", "Joined"];
    const rows = stores.map((s) => [
      s.name, s.category, s.rating, s.booking_count, s.total_revenue,
      s.address ?? "", s.phone ?? "", s.active_slots,
      s.last_booking_date ?? "Never",
      s.is_approved ? "Yes" : "No", s.is_suspended ? "Yes" : "No",
      format(new Date(s.created_at), "yyyy-MM-dd"),
    ]);
    downloadCSV("booka_stores.csv", headers, rows);
  };

  const exportCustomersCSV = () => {
    const headers = ["Name", "Phone", "Total Bookings", "Total Spent (J$)", "No Shows", "Last Booking", "Suspended", "Joined"];
    const rows = customers.map((c) => [
      c.full_name ?? "Anonymous", c.phone ?? "", c.booking_count, c.total_spent,
      c.no_show_count, c.last_booking_date ?? "Never",
      c.is_suspended ? "Yes" : "No", format(new Date(c.created_at), "yyyy-MM-dd"),
    ]);
    downloadCSV("booka_customers.csv", headers, rows);
  };

  const exportBookingsCSV = () => {
    const headers = ["Store", "Customer", "Date", "Time", "Status", "Services", "Total (J$)", "Deposit (J$)", "Payment Status"];
    const rows = bookings.map((b) => [
      b.store_name, b.customer_name, b.reservation_date, b.start_time?.slice(0, 5),
      b.status, b.service_names, b.total_amount ?? "", b.commitment_fee_amount ?? "",
      b.payment_status ?? "",
    ]);
    downloadCSV("booka_bookings.csv", headers, rows);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isInactive = (lastDate: string | null, days: number) => {
    if (!lastDate) return true;
    return differenceInDays(new Date(), parseISO(lastDate)) > days;
  };

  const fmtJ = (n: number) => `J$${n.toLocaleString()}`;

  // ── Render overview ───────────────────────────────────────────────────────
  const StatCard = ({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: "amber" | "red" }) => (
    <div className={`rounded-2xl p-4 shadow-sm border ${highlight === "red" ? "bg-red-50 border-red-200" : highlight === "amber" ? "bg-amber-50 border-amber-200" : "bg-card border-border"}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${highlight === "red" ? "text-red-700" : highlight === "amber" ? "text-amber-700" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  const activityIcon = (type: ActivityItem["type"]) => {
    if (type === "store") return <Store size={14} className="text-blue-500" />;
    if (type === "customer") return <Users size={14} className="text-green-500" />;
    if (type === "booking") return <Calendar size={14} className="text-purple-500" />;
    return <Flag size={14} className="text-red-500" />;
  };

  const renderOverview = () => (
    <div className="space-y-6 p-4">
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Platform Summary</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Stores" value={stats.totalStores} />
              <StatCard label="Customers" value={stats.totalCustomers} />
              <StatCard label="Bookings Today" value={stats.bookingsToday} />
              <StatCard label="This Week" value={stats.bookingsWeek} />
              <StatCard label="This Month" value={stats.bookingsMonth} />
              <StatCard label="Revenue (Month)" value={fmtJ(stats.revenueMonth)} />
              <StatCard label="Revenue (All Time)" value={fmtJ(stats.revenueAllTime)} sub="completed bookings" />
              <StatCard label="Pending Approval" value={stats.pendingApproval} highlight={stats.pendingApproval > 0 ? "amber" : undefined} sub="stores awaiting review" />
              <div className="col-span-2">
                <StatCard label="Unresolved Reports" value={stats.unresolvedReports} highlight={stats.unresolvedReports > 0 ? "red" : undefined} sub="pending customer reports" />
              </div>
              <div className="col-span-2">
                <StatCard label="Bug Reports" value={overviewBugCount} highlight={overviewBugCount > 0 ? "amber" : undefined} sub="submitted by users" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Insights</p>
            <div className="bg-card rounded-2xl border border-border shadow-sm divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2"><TrendingUp size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Popular Category</span></div>
                <span className="text-sm font-bold text-foreground">{stats.popularCategory}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2"><Star size={16} className="text-amber-400" /><span className="text-sm font-medium text-foreground">Most Active Store</span></div>
                <span className="text-sm font-bold text-foreground text-right max-w-[140px] truncate">{stats.mostActiveStore}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Platform Health</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Suspended Stores" value={String(stats.suspendedStores)} sub={`of ${stats.totalStores} total`} />
              <StatCard label="Suspended Users" value={String(stats.suspendedCustomers)} sub={`of ${stats.totalCustomers} total`} />
              <StatCard label="All-Time Bookings" value={String(stats.bookingsAllTime)} />
              <StatCard label="Dispute Resolution" value={stats.totalDisputes > 0 ? `${Math.round((stats.resolvedDisputes / stats.totalDisputes) * 100)}%` : "—"} sub={`${stats.resolvedDisputes}/${stats.totalDisputes} resolved`} />
            </div>
          </div>

          {stats.categoryBreakdown.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Stores by Category</p>
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                {stats.categoryBreakdown.map((c, i) => {
                  const maxCount = stats.categoryBreakdown[0]?.count ?? 1;
                  return (
                    <div key={c.cat} className={`px-4 py-3 ${i > 0 ? "border-t border-slate-50" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{c.cat}</span>
                        <span className="text-xs font-bold text-foreground">{c.count}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(c.count / maxCount) * 100}%` }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Activity</p>
            {activityLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-xl booka-shimmer" />)}</div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-sm divide-y divide-border">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground leading-snug">{item.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{format(new Date(item.timestamp), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Admin Access</p>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Enter an email to generate the SQL to grant admin access</p>
              <div className="flex gap-2">
                <Input placeholder="user@example.com" value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)} className="flex-1 h-10 rounded-xl text-sm" />
                <Button onClick={grantAdmin} disabled={grantingAdmin || !adminEmailInput.trim()} size="sm" className="rounded-xl px-3 h-10">
                  <Shield size={14} className="mr-1.5" /> Grant
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Render stores ─────────────────────────────────────────────────────────
  const TIER_ORDER: Record<string, number> = { premium: 0, pro: 1, free: 2 };
  const renderStores = () => {
    const filtered = stores
      .filter((s) => !storeSearch || s.name.toLowerCase().includes(storeSearch.toLowerCase()))
      .sort((a, b) => (TIER_ORDER[a.subscription_tier ?? "free"] ?? 2) - (TIER_ORDER[b.subscription_tier ?? "free"] ?? 2));
    return (
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search stores…" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-sm" />
          </div>
          <Button onClick={exportStoresCSV} variant="outline" size="sm" className="rounded-xl h-10 px-3 shrink-0">
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>
        {storesLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl booka-shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No stores found</p>
        ) : filtered.map((s) => {
          const inactive = isInactive(s.last_booking_date, 30);
          const lockUntil = s.category_locked_until ? new Date(s.category_locked_until) : null;
          const isCatLocked = !!(lockUntil && lockUntil > new Date());
          const tierColor = s.subscription_tier === "premium" ? "bg-purple-100 text-purple-700" : s.subscription_tier === "pro" ? "bg-blue-100 text-blue-700" : "bg-secondary text-muted-foreground";
          return (
                <div key={s.id} className={`rounded-2xl border shadow-sm p-4 space-y-3 ${inactive && s.booking_count > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-sm">{s.name}</p>
                        {s.is_suspended && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                        {!s.is_approved && <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">PENDING</span>}
                        {inactive && s.booking_count > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">INACTIVE</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${tierColor}`}>{s.subscription_tier ?? "free"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.category} · ★ {s.review_count > 0 ? s.rating.toFixed(1) : "New"}</p>
                      {s.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.address}</p>}
                      {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                      {isCatLocked && <p className="text-[11px] text-orange-500 font-semibold mt-0.5">🔒 Category locked until {format(lockUntil!, "MMM d, yyyy")}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        <p className="text-[11px] text-muted-foreground">{s.booking_count} bookings</p>
                        <p className="text-[11px] text-muted-foreground">{s.active_slots} slots</p>
                        <p className="text-[11px] text-muted-foreground">Revenue: {fmtJ(s.total_revenue)}</p>
                        <p className="text-[11px] text-muted-foreground">Last booking: {s.last_booking_date ? format(parseISO(s.last_booking_date), "MMM d, yyyy") : "Never"}</p>
                        <p className="text-[11px] text-muted-foreground">Joined {format(new Date(s.created_at), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => toggleStoreSuspend(s)} className={`h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all active:scale-95 ${s.is_suspended ? "border-green-200 text-green-700 hover:bg-green-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                      <Ban size={11} />{s.is_suspended ? "Reinstate" : "Suspend"}
                    </button>
                    <button onClick={() => toggleStoreApprove(s)} className={`h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all active:scale-95 ${s.is_approved ? "border-border text-muted-foreground hover:bg-secondary" : "border-green-200 text-green-700 hover:bg-green-50"}`}>
                      <CheckCircle2 size={11} />{s.is_approved ? "Revoke" : "Approve"}
                    </button>
                    <button onClick={() => openStoreAction(s, "category")} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-purple-200 text-purple-600 hover:bg-purple-50 transition-all active:scale-95">
                      <Store size={11} /> Category
                    </button>
                    <button onClick={() => openStoreAction(s, "tier")} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                      <CreditCard size={11} /> Tier
                    </button>
                    <button onClick={() => openStoreAction(s, "edit")} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-border text-muted-foreground hover:bg-secondary transition-all active:scale-95">
                      <Pencil size={11} /> Edit
                    </button>
                    {isCatLocked && (
                      <button onClick={() => resetCategoryLock(s)} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-orange-300 text-orange-600 hover:bg-orange-50 transition-all active:scale-95">
                        <Clock size={11} /> Unlock Category
                      </button>
                    )}
                    <button onClick={() => openStoreAction(s, "notes")} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-border text-muted-foreground hover:bg-secondary transition-all active:scale-95">
                      <Plus size={11} /> Note
                    </button>
                    {s.phone && (
                      <button onClick={() => setContactTarget({ name: s.name, phone: s.phone! })} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                        <Phone size={11} /> Call
                      </button>
                    )}
                    <button onClick={() => openStoreAction(s, "delete")} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-red-300 text-red-600 hover:bg-red-50 transition-all active:scale-95">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
          );
        })}
      </div>
    );
  };

  // ── Render customers ──────────────────────────────────────────────────────
  const renderCustomers = () => {
    const filtered = customers.filter((c) => !customerSearch || (c.full_name ?? "").toLowerCase().includes(customerSearch.toLowerCase()));
    return (
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search customers…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-sm" />
          </div>
          <Button onClick={exportCustomersCSV} variant="outline" size="sm" className="rounded-xl h-10 px-3 shrink-0">
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>
        {customersLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl booka-shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No customers found</p>
        ) : filtered.map((c) => {
          const inactive = isInactive(c.last_booking_date, 60);
          const flagNoShow = c.no_show_count >= 3;
          return (
            <div key={c.id} className={`rounded-2xl border shadow-sm p-4 space-y-3 ${inactive && c.booking_count > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground text-sm">{c.full_name || "Anonymous"}</p>
                    {c.is_suspended && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                    {inactive && c.booking_count > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">INACTIVE</span>}
                    {(c.warning_count ?? 0) >= 3 && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">HIGH RISK</span>}
                  </div>
                  {c.phone && <p className="text-xs text-muted-foreground mt-0.5">{c.phone}</p>}
                  {c.is_suspended && c.suspension_reason && (
                    <p className="text-[11px] text-red-600 mt-0.5 italic">Reason: {c.suspension_reason}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <p className="text-[11px] text-muted-foreground">{c.booking_count} bookings</p>
                    <p className="text-[11px] text-muted-foreground">Spent: {fmtJ(c.total_spent)}</p>
                    <p className={`text-[11px] font-semibold ${flagNoShow ? "text-red-500" : "text-muted-foreground"}`}>No-shows: {c.no_show_count}</p>
                    <p className="text-[11px] text-muted-foreground">Last: {c.last_booking_date ? format(parseISO(c.last_booking_date), "MMM d, yyyy") : "Never"}</p>
                    <p className="text-[11px] text-muted-foreground">Joined {format(new Date(c.created_at), "MMM d, yyyy")}</p>
                    {c.warning_count != null && c.warning_count > 0 && (
                      <p className={`text-[11px] font-semibold ${c.warning_count >= 3 ? "text-orange-500" : "text-amber-500"}`}>⚠️ {c.warning_count} warning{c.warning_count !== 1 ? "s" : ""}</p>
                    )}
                    {c.trust_score != null && (
                      <p className={`text-[11px] font-semibold ${c.trust_score < 60 ? "text-red-500" : c.trust_score < 80 ? "text-amber-500" : "text-green-600"}`}>Trust: {c.trust_score}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => toggleCustomerSuspend(c)} className={`h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all active:scale-95 ${c.is_suspended ? "border-green-200 text-green-700 hover:bg-green-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                  <Ban size={11} />{c.is_suspended ? "Reinstate" : "Suspend"}
                </button>
                <button onClick={() => issueWarning(c)} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-orange-200 text-orange-600 hover:bg-orange-50 transition-all active:scale-95">
                  <AlertCircle size={11}/> Warn
                </button>
                <button onClick={() => viewCustomerBookings(c)} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-border text-muted-foreground hover:bg-secondary transition-all active:scale-95">
                  <Calendar size={11}/> Bookings
                </button>
                <button onClick={() => sendPasswordReset(c.email)} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-amber-200 text-amber-600 hover:bg-amber-50 transition-all active:scale-95">
                  <RefreshCw size={11}/> Pwd Reset
                </button>
                {c.phone && (
                  <button onClick={() => setCustomerContactTarget({ name: c.full_name ?? "Customer", phone: c.phone! })} className="h-8 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                    <Phone size={11}/> Call
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render reports ────────────────────────────────────────────────────────
  const renderReports = () => (
    <div className="p-4 space-y-3">
      {reportsLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-2xl booka-shimmer" />)}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12"><Flag size={36} className="mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No reports yet</p></div>
      ) : reports.map((r) => (
        <div key={r.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground text-sm">{r.store_name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "reviewed" ? "bg-secondary text-muted-foreground" : "bg-red-100 text-red-600"}`}>
                  {r.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.reason}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(r.created_at), "MMM d, yyyy h:mm a")}</p>
            </div>
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => dismissReport(r.id)} className="flex-1 h-8 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-secondary flex items-center justify-center gap-1 active:scale-95 transition-all">
                <X size={12} /> Dismiss
              </button>
              <button onClick={() => suspendStoreFromReport(r)} className="flex-1 h-8 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 active:scale-95 transition-all">
                <Ban size={12} /> Suspend Store
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ── Render bookings ───────────────────────────────────────────────────────
  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600", arrived: "bg-purple-100 text-purple-700",
    in_progress: "bg-orange-100 text-orange-700", no_show: "bg-secondary text-muted-foreground",
  };

  const renderBookings = () => (
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        <Input type="date" value={bookingDateFilter} onChange={(e) => setBookingDateFilter(e.target.value)} className="flex-1 rounded-xl h-10 text-sm" />
        <select value={bookingStatusFilter} onChange={(e) => setBookingStatusFilter(e.target.value)} className="flex-1 rounded-xl h-10 text-sm border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="arrived">Arrived</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button onClick={fetchBookings} variant="outline" size="sm" className="flex-1 rounded-xl h-9 text-xs">Apply Filters</Button>
        <Button onClick={exportBookingsCSV} variant="outline" size="sm" className="rounded-xl h-9 px-3 text-xs">
          <Download size={13} className="mr-1" /> CSV
        </Button>
      </div>
      {bookingsLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl booka-shimmer" />)}</div>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No bookings found</p>
      ) : bookings.map((b) => (
        <div key={b.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm truncate">{b.store_name}</p>
              <p className="text-xs text-muted-foreground">{b.customer_name} · {b.store_category}</p>
              {b.service_names && b.service_names !== "—" && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.service_names}</p>}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColors[b.status] ?? "bg-secondary text-muted-foreground"}`}>
              {b.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{b.reservation_date} · {b.start_time?.slice(0, 5)}</p>
            {b.total_amount != null && <p className="text-xs font-bold text-foreground">{fmtJ(b.total_amount)}</p>}
          </div>
          <div className="flex items-center justify-between">
            {b.commitment_fee_amount != null && <p className="text-[11px] text-muted-foreground">Deposit: {fmtJ(b.commitment_fee_amount)}</p>}
            {b.payment_status && <p className="text-[11px] text-muted-foreground">Payment: {b.payment_status}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Render revenue ────────────────────────────────────────────────────────
  const renderRevenue = () => (
    <div className="p-4 space-y-6">
      {revenueLoading || !revenueData ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}</div>
      ) : (
        <>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Revenue Summary</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="All Time" value={fmtJ(revenueData.allTime)} sub="completed bookings" />
              <StatCard label="This Month" value={fmtJ(revenueData.thisMonth)} />
              <StatCard label="This Week" value={fmtJ(revenueData.thisWeek)} />
              <StatCard label="Avg Booking" value={fmtJ(Math.round(revenueData.avgBooking))} sub="per completed booking" />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Monthly Revenue — Last 12 Months</p>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueData.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
                  <Tooltip formatter={(v: number) => [`J$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">By Category</p>
            <div className="bg-card rounded-2xl border border-border shadow-sm divide-y divide-border">
              {revenueData.byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data</p>
              ) : revenueData.byCategory.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cat.category}</p>
                    <p className="text-[11px] text-muted-foreground">{cat.bookings} bookings</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{fmtJ(cat.revenue)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Promotions Impact ── */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Promotions Impact</p>
            {promoImpact ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-2xl border border-border shadow-sm p-3">
                  <p className="text-[11px] text-muted-foreground">Discount Absorbed (Month)</p>
                  <p className="text-xl font-extrabold text-green-600">J${promoImpact.monthDiscount.toLocaleString()}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-3">
                  <p className="text-[11px] text-muted-foreground">Discount Absorbed (All Time)</p>
                  <p className="text-xl font-extrabold text-green-600">J${promoImpact.allTimeDiscount.toLocaleString()}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-3">
                  <p className="text-[11px] text-muted-foreground">Promo Bookings (Month)</p>
                  <p className="text-xl font-extrabold text-foreground">{promoImpact.monthBookings}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-3">
                  <p className="text-[11px] text-muted-foreground">Avg Discount per Booking</p>
                  <p className="text-xl font-extrabold text-foreground">J${promoImpact.avgDiscount.toLocaleString()}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-3 col-span-2">
                  <p className="text-[11px] text-muted-foreground">Net Rezo Commission This Month (after discounts)</p>
                  <p className="text-2xl font-extrabold text-blue-900">J${promoImpact.netCommissionMonth.toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-sm p-4 text-center text-muted-foreground text-sm">No promo data yet</div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Top 10 Stores by Revenue</p>
            <div className="bg-card rounded-2xl border border-border shadow-sm divide-y divide-border">
              {revenueData.byStore.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data</p>
              ) : revenueData.byStore.map((s, i) => (
                <div key={s.name + i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.bookings} bookings</p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0">{fmtJ(s.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Render announcements ──────────────────────────────────────────────────
  const renderAnnouncements = () => (
    <div className="p-4 space-y-6">
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Compose Announcement</p>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className="rounded-xl text-sm" />
          <Textarea placeholder="Message…" value={annMessage} onChange={(e) => setAnnMessage(e.target.value)} className="rounded-xl text-sm resize-none" rows={3} />
          <select value={annAudience} onChange={(e) => setAnnAudience(e.target.value as any)} className="w-full rounded-xl h-10 text-sm border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Users</option>
            <option value="stores">Stores Only</option>
            <option value="customers">Customers Only</option>
          </select>
          <Button onClick={sendAnnouncement} disabled={sendingAnn || !annTitle.trim() || !annMessage.trim()} className="w-full rounded-xl h-10">
            {sendingAnn ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={14} className="mr-2" />}
            Send Announcement
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Sent Announcements</p>
        {annLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12"><Megaphone size={36} className="mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No announcements sent yet</p></div>
        ) : announcements.map((a) => (
          <div key={a.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.audience === "all" ? "bg-blue-100 text-blue-700" : a.audience === "stores" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                    {a.audience === "all" ? "All Users" : a.audience === "stores" ? "Stores" : "Customers"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>
              <button onClick={() => deleteAnnouncement(a.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render messages ────────────────────────────────────────────────────────
  const renderMessages = () => {
    if (selectedConv) {
      return (
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
            <button onClick={() => { setSelectedConv(null); setThread([]); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary active:scale-90 transition-all">
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-sm truncate">{selectedConv.store_name}</p>
              <p className="text-xs text-muted-foreground">{selectedConv.customer_name}</p>
            </div>
            {selectedConv.has_report && <Flag size={16} className="text-red-500 shrink-0" />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-12 rounded-2xl booka-shimmer ${i % 2 === 0 ? "ml-8" : "mr-8"}`} />)}</div>
            ) : thread.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No messages</p>
            ) : thread.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_role === "store" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${msg.sender_role === "store" ? "bg-secondary text-foreground" : "bg-[#1e3a8a] text-white"}`}>
                  <p className="text-xs font-semibold mb-0.5 opacity-60">{msg.sender_role === "store" ? selectedConv.store_name : selectedConv.customer_name}</p>
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${msg.sender_role === "store" ? "text-muted-foreground" : "text-blue-200"}`}>{format(new Date(msg.created_at), "h:mm a")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const filtered = conversations.filter((c) => !msgSearch || c.store_name.toLowerCase().includes(msgSearch.toLowerCase()) || c.customer_name.toLowerCase().includes(msgSearch.toLowerCase()));
    return (
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by store or customer…" value={msgSearch} onChange={(e) => setMsgSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-sm" />
        </div>
        {msgsLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl booka-shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><MessageSquare size={36} className="mx-auto mb-3 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">No conversations yet</p></div>
        ) : filtered.map((c) => (
          <button key={c.key} onClick={() => { setSelectedConv(c); fetchThread(c.reservation_id); }} className="w-full bg-card rounded-2xl border border-border shadow-sm p-4 text-left flex items-start gap-3 active:scale-[0.98] transition-all hover:bg-secondary">
            <div className="w-9 h-9 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-[#1e3a8a]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-foreground text-sm truncate">{c.store_name}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {c.has_report && <Flag size={12} className="text-red-500" />}
                  <p className="text-[11px] text-muted-foreground">{format(new Date(c.last_message_at), "MMM d")}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{c.customer_name}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // ── renderContent ─────────────────────────────────────────────────────────
  const renderDisputes = () => (
    <div className="p-4 space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Customer Disputes</p>
      {disputesLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl booka-shimmer" />)}</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No disputes filed yet</p>
        </div>
      ) : (
        disputes.map((d) => {
          const statusColors: Record<string, string> = { open: "bg-amber-100 text-amber-700", resolved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" };
          return (
            <div key={d.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-foreground">{d.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.customer_name} vs {d.store_name} · {format(new Date(d.created_at), "MMM d, yyyy")}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[d.status] ?? "bg-secondary text-muted-foreground"}`}>{d.status}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
              {d.evidence_url && (
                <a href={d.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">View Evidence</a>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Refund Amount (J$)</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={disputeRefundAmounts[d.id] ?? ""}
                    onChange={(e) => setDisputeRefundAmounts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="rounded-xl text-xs h-8 flex-1"
                  />
                  {d.refund_status && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${d.refund_status === "approved" ? "bg-green-100 text-green-700" : d.refund_status === "denied" ? "bg-red-100 text-red-600" : "bg-secondary text-muted-foreground"}`}>
                      {d.refund_status}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Admin Notes</p>
                <textarea
                  value={disputeNotes[d.id] ?? ""}
                  onChange={(e) => setDisputeNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  rows={2}
                  className="w-full text-xs rounded-xl border border-input p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-background text-foreground"
                  placeholder="Add internal notes…"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white border-0 text-xs"
                  onClick={() => updateDisputeStatus(d.id, "resolved")} disabled={savingDisputeId === d.id || d.status === "resolved"}>
                  {savingDisputeId === d.id ? "Saving…" : "Resolve"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs border-red-200 text-red-500 hover:bg-red-50"
                  onClick={() => updateDisputeStatus(d.id, "rejected")} disabled={savingDisputeId === d.id || d.status === "rejected"}>
                  Reject
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderBugReports = () => (
    <div className="p-4 space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Bug Reports ({bugReports.length})</p>
      {bugsLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}</div>
      ) : bugReports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bug reports yet</p>
        </div>
      ) : (
        bugReports.map((r) => (
          <div key={r.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">{r.user_name}</p>
              <p className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "MMM d, h:mm a")}</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{r.description}</p>
            {r.screenshot_url && (
              <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">View Screenshot</a>
            )}
          </div>
        ))
      )}
    </div>
  );

  // ── Platform Management ────────────────────────────────────────────────────
  const renderPlatform = () => {
    const featureKeys = ["messaging_enabled","reviews_enabled","disputes_enabled","rescheduling_enabled","walkin_enabled","late_night_pricing_enabled","featured_stores_enabled"];
    const numericKeys = ["commission_rate","min_commitment_fee"];
    const maintenanceKey = "maintenance_mode";
    const maintenanceMsgKey = "maintenance_message";
    return (
      <div className="p-4 space-y-4">
        {platformLoading ? <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 rounded-2xl booka-shimmer"/>)}</div> : <>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Commission & Fees</p>
          {numericKeys.map((key) => (
            <div key={key} className="bg-card rounded-2xl border border-border shadow-sm p-4">
              <p className="text-sm font-semibold text-foreground mb-2 capitalize">{key.replace(/_/g," ")}</p>
              <div className="flex gap-2">
                <Input type="number" value={platformEdits[key] ?? ""} onChange={e=>setPlatformEdits(p=>({...p,[key]:e.target.value}))} className="rounded-xl flex-1" />
                <Button size="sm" className="rounded-xl" onClick={()=>savePlatformSetting(key)} disabled={savingPlatform}>Save</Button>
              </div>
            </div>
          ))}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Maintenance Mode</p>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Maintenance Mode</span>
              <button onClick={()=>{const v=platformEdits[maintenanceKey]==="true"?"false":"true";setPlatformEdits(p=>({...p,[maintenanceKey]:v}));savePlatformSetting(maintenanceKey);}}
                className={`relative rounded-full transition-colors duration-200`} style={{width:42,height:24,background:platformEdits[maintenanceKey]==="true"?"#ef4444":"#e2e8f0"}}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${platformEdits[maintenanceKey]==="true"?"left-[18px]":"left-0.5"}`}/>
              </button>
            </div>
            <Textarea value={platformEdits[maintenanceMsgKey]??""} onChange={e=>setPlatformEdits(p=>({...p,[maintenanceMsgKey]:e.target.value}))} rows={2} className="rounded-xl text-xs resize-none" placeholder="Maintenance message…"/>
            <Button size="sm" className="rounded-xl w-full" onClick={()=>savePlatformSetting(maintenanceMsgKey)} disabled={savingPlatform}>Save Message</Button>
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Feature Flags</p>
          <div className="bg-card rounded-2xl border border-border shadow-sm divide-y divide-border">
            {featureKeys.map((key)=>(
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium capitalize">{key.replace(/_enabled/,"").replace(/_/g," ")}</span>
                <button onClick={()=>{const v=platformEdits[key]==="true"?"false":"true";setPlatformEdits(p=>({...p,[key]:v}));savePlatformSetting(key);}}
                  className="relative rounded-full transition-colors duration-200" style={{width:42,height:24,background:platformEdits[key]==="true"?"#3b82f6":"#e2e8f0"}}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${platformEdits[key]==="true"?"left-[18px]":"left-0.5"}`}/>
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Word Blacklist</p>
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <div className="flex gap-2">
              <Input value={newBlackWord} onChange={e=>setNewBlackWord(e.target.value)} placeholder="Add word or phrase…" className="rounded-xl flex-1 text-sm" onKeyDown={e=>{if(e.key==="Enter")addBlacklistWord();}}/>
              <Button size="sm" className="rounded-xl" onClick={addBlacklistWord}><Plus size={14}/></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wordBlacklist.map(w=>(
                <div key={w.id} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                  <span className="text-xs text-red-700">{w.word}</span>
                  <button onClick={()=>removeBlacklistWord(w.id)} className="text-red-400 hover:text-red-600"><X size={11}/></button>
                </div>
              ))}
            </div>
          </div>
        </>}
      </div>
    );
  };

  // ── Financial Management ───────────────────────────────────────────────────
  const renderFinancial = () => (
    <div className="p-4 space-y-3">
      <div className="flex gap-2 mb-3">
        {(["subscriptions","payouts","refunds"] as const).map(t=>(
          <button key={t} onClick={()=>{ setFinancialSubTab(t); if(t==="payouts") fetchPayoutsData(); if(t==="subscriptions") fetchFinancialData(); }} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${financialSubTab===t?"bg-slate-800 text-white border-slate-800":"bg-card border-border text-muted-foreground"}`}>
            {t==="subscriptions"?"Plans":t==="payouts"?`Payouts${payoutRequests.length>0?` (${payoutRequests.length})`:""}` :"Refunds"}
          </button>
        ))}
      </div>
      {financialLoading ? <div className="h-40 rounded-2xl booka-shimmer"/> : financialSubTab==="subscriptions" ? (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-extrabold text-amber-600">{premiumStores.length}</p><p className="text-[10px] text-muted-foreground font-semibold">Premium</p></div>
            <div><p className="text-lg font-extrabold text-blue-600">{proStores.length}</p><p className="text-[10px] text-muted-foreground font-semibold">Pro</p></div>
            <div><p className="text-lg font-extrabold text-foreground">{freeStores.length}</p><p className="text-[10px] text-muted-foreground font-semibold">Free</p></div>
          </div>
          {[{label:"Premium",stores:premiumStores,color:"amber"},{label:"Pro",stores:proStores,color:"blue"},{label:"Free",stores:freeStores,color:"slate"}].map(({label,stores,color})=>(
            <div key={label}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{label} ({stores.length})</p>
              {stores.length===0?<p className="text-xs text-muted-foreground text-center py-3">None</p>:stores.map(s=>(
                <div key={s.id} className="bg-card rounded-2xl border border-border shadow-sm p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.category} · {s.booking_count} bookings · {fmtJ(s.total_revenue)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${label==="Premium"?"bg-amber-100 text-amber-700":label==="Pro"?"bg-blue-100 text-blue-700":"bg-secondary text-muted-foreground"}`}>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : financialSubTab === "payouts" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending Store Payouts</p>
            <button onClick={fetchPayoutsData} className="p-1.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary"><RefreshCw size={13}/></button>
          </div>
          {payoutsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 rounded-2xl booka-shimmer"/>)}</div>
          ) : (
            <>
              {payoutRequests.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-700 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Wallet size={14} className="text-amber-600" />
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Payout Requests ({payoutRequests.length})</p>
                  </div>
                  {payoutRequests.map(req => (
                    <div key={req.id} className="bg-white dark:bg-card rounded-xl border border-amber-200 dark:border-amber-700/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{req.store_name}</p>
                          <p className="text-[11px] text-muted-foreground">{req.note.replace("PAYOUT_REQUEST: ","")}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{format(parseISO(req.created_at), "MMM d, h:mma")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {payoutRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign size={36} className="mx-auto mb-3 opacity-30"/>
                  <p className="text-sm">No pending payouts</p>
                </div>
              ) : (
                <>
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Pending</p>
                      <p className="text-lg font-extrabold text-foreground">{fmtJ(payoutRows.reduce((s, r) => s + r.unpaid, 0))}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Rezo Commission</p>
                      <p className="text-lg font-extrabold text-green-700">{fmtJ(payoutRows.reduce((s, r) => s + r.total_commission, 0))}</p>
                    </div>
                  </div>
                  <div className="bg-card rounded-2xl border border-border shadow-sm divide-y divide-border">
                    {payoutRows.map(r => {
                      const hasReq = payoutRequests.some(req => req.store_id === r.store_id);
                      return (
                        <div key={r.store_id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                              {hasReq && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">REQUESTED</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{r.booking_count} completed bookings · commission {fmtJ(r.total_commission)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-amber-700">{fmtJ(r.unpaid)}</p>
                            <p className="text-[10px] text-muted-foreground">unpaid</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">Weekly payouts processed every Monday. Mark reservations as paid in the Bookings tab once processed.</p>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign size={36} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">Refund management — connect to payment provider to process refunds</p>
        </div>
      )}
    </div>
  );

  // ── Content Moderation ─────────────────────────────────────────────────────
  const renderModeration = () => (
    <div className="p-4 space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["photos","reviews","flagged","blacklist"] as const).map(t=>(
          <button key={t} onClick={()=>setModerationSubTab(t)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${moderationSubTab===t?"bg-slate-800 text-white border-slate-800":"bg-card border-border text-muted-foreground"}`}>
            {t==="photos"?"Photos":t==="reviews"?"Reviews":t==="flagged"?"Flagged":"Blacklist"}
          </button>
        ))}
        <button onClick={fetchModerationData} className="shrink-0 p-1.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary"><RefreshCw size={13}/></button>
      </div>
      {moderationLoading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 rounded-2xl booka-shimmer"/>)}</div> :
        moderationSubTab==="photos" ? (
          storePhotos.length===0 ? <p className="text-sm text-muted-foreground text-center py-8">No photos yet</p> :
          <div className="grid grid-cols-2 gap-2">
            {storePhotos.map(p=>(
              <div key={p.id} className="relative rounded-xl overflow-hidden border border-slate-100">
                <img src={p.image_url} alt="store" className="w-full h-32 object-cover"/>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 flex items-center justify-between">
                  <span className="text-white text-[10px] truncate">{p.store_name}</span>
                  <button onClick={()=>deleteStorePhoto(p)} className="text-red-300 hover:text-red-100"><Trash2 size={11}/></button>
                </div>
              </div>
            ))}
          </div>
        ) : moderationSubTab==="reviews" ? (
          storeReviews.length===0 ? <p className="text-sm text-muted-foreground text-center py-8">No reviews yet</p> :
          storeReviews.map(r=>(
            <div key={r.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.store_name}</p>
                  <p className="text-xs text-muted-foreground">{r.reviewer_name} · {"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</p>
                </div>
                <button onClick={()=>deleteReview(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13}/></button>
              </div>
              <p className="text-xs text-muted-foreground">{r.comment}</p>
            </div>
          ))
        ) : moderationSubTab==="flagged" ? (
          flaggedMessages.length===0 ? <p className="text-sm text-muted-foreground text-center py-8">No flagged messages</p> :
          flaggedMessages.map(f=>(
            <div key={f.id} className="bg-card rounded-2xl border border-amber-200 shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.store_name ?? "Unknown Store"}</p>
                  <p className="text-xs text-muted-foreground">Keyword: <span className="font-bold text-red-500">{f.flagged_keyword}</span></p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.status==="pending"?"bg-amber-100 text-amber-700":f.status==="dismissed"?"bg-secondary text-muted-foreground":"bg-green-100 text-green-700"}`}>{f.status}</span>
              </div>
              {f.message_content && <p className="text-xs text-muted-foreground italic">"{f.message_content}"</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs" onClick={()=>updateFlaggedStatus(f.id,"dismissed")}>Dismiss</Button>
                <Button size="sm" className="flex-1 rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white border-0" onClick={()=>updateFlaggedStatus(f.id,"actioned")}>Action</Button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <div className="flex gap-2">
              <Input value={newBlackWord} onChange={e=>setNewBlackWord(e.target.value)} placeholder="Add word or phrase…" className="rounded-xl flex-1 text-sm" onKeyDown={e=>{if(e.key==="Enter")addBlacklistWord();}}/>
              <Button size="sm" className="rounded-xl" onClick={addBlacklistWord}><Plus size={14}/></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wordBlacklist.map(w=>(
                <div key={w.id} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                  <span className="text-xs text-red-700">{w.word}</span>
                  <button onClick={()=>removeBlacklistWord(w.id)} className="text-red-400 hover:text-red-600"><X size={11}/></button>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div>
  );

  // ── Communication ──────────────────────────────────────────────────────────
  const renderCommunication = () => (
    <div className="p-4 space-y-4">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Send Notification</p>
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
        <Input value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="Title…" className="rounded-xl"/>
        <Textarea value={notifMessage} onChange={e=>setNotifMessage(e.target.value)} placeholder="Message body…" rows={3} className="rounded-xl resize-none"/>
        <div className="flex gap-1.5">
          {(["all","stores","customers"] as const).map(a=>(
            <button key={a} onClick={()=>setNotifAudience(a)} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${notifAudience===a?"bg-slate-800 text-white border-slate-800":"bg-card border-border text-muted-foreground hover:bg-secondary"}`}>
              {a==="all"?"All Users":a==="stores"?"Stores Only":"Customers Only"}
            </button>
          ))}
        </div>
        <Button className="w-full rounded-xl" onClick={sendNotification} disabled={sendingNotif||!notifTitle.trim()||!notifMessage.trim()}>
          <Send size={14} className="mr-1.5"/>{sendingNotif?"Sending…":"Send Now"}
        </Button>
      </div>

      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sent History</p>
      {communicationLoading ? <div className="h-24 rounded-2xl booka-shimmer"/> :
        scheduledNotifs.length===0 ? <p className="text-sm text-muted-foreground text-center py-4">No notifications sent yet</p> :
        scheduledNotifs.map(n=>(
          <div key={n.id} className="bg-card rounded-2xl border border-border shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message.slice(0,80)}{n.message.length>80?"…":""}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{n.audience} · {n.sent_at ? format(new Date(n.sent_at),"MMM d, h:mm a") : format(new Date(n.created_at),"MMM d")}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${n.status==="sent"?"bg-green-100 text-green-700":n.status==="cancelled"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-700"}`}>{n.status}</span>
            </div>
            {n.status==="scheduled" && (
              <Button size="sm" variant="outline" className="mt-2 rounded-xl text-xs w-full border-red-200 text-red-500" onClick={()=>cancelScheduledNotif(n.id)}>Cancel</Button>
            )}
          </div>
        ))
      }
    </div>
  );

  // ── Store admin action dialogs ─────────────────────────────────────────────
  const renderStoreActionDialog = () => {
    if (!storeActionTarget || !storeActionType) return null;
    const s = storeActionTarget;
    const titleMap = { category:"Change Category", tier:"Change Tier", edit:"Edit Store", delete:"Delete Store", notes:"Add Admin Note" };
    return (
      <div className="fixed inset-0 z-[500] flex items-end justify-center" onClick={()=>{setStoreActionTarget(null);setStoreActionType(null);}}>
        <div className="absolute inset-0 bg-black/60"/>
        <div className="relative bg-card rounded-t-3xl w-full max-w-lg p-6 pb-10 shadow-2xl space-y-4" onClick={e=>e.stopPropagation()}>
          <p className="font-bold text-foreground text-base">{titleMap[storeActionType]} — {s.name}</p>
          {storeActionType==="category" && (
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c=>(
                <button key={c.label} onClick={()=>setStoreActionCategory(c.label)}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${storeActionCategory===c.label?"bg-blue-600 text-white border-blue-600":"border-border text-muted-foreground hover:bg-secondary"}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          )}
          {storeActionType==="tier" && (
            <div className="flex gap-2">
              {(["free","pro","premium"] as const).map(t=>(
                <button key={t} onClick={()=>setStoreActionTier(t)} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all capitalize ${storeActionTier===t?"bg-slate-800 text-white border-slate-800":"border-slate-200 text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
          )}
          {storeActionType==="edit" && (
            <div className="space-y-2">
              <Input value={storeEditName} onChange={e=>setStoreEditName(e.target.value)} placeholder="Store name" className="rounded-xl"/>
              <Input value={storeEditAddr} onChange={e=>setStoreEditAddr(e.target.value)} placeholder="Address" className="rounded-xl"/>
              <Input value={storeEditPhone} onChange={e=>setStoreEditPhone(e.target.value)} placeholder="Phone" className="rounded-xl"/>
            </div>
          )}
          {storeActionType==="delete" && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">This action is permanent and cannot be undone. Type DELETE to confirm.</p>
              <Input value={storeDeleteConfirm} onChange={e=>setStoreDeleteConfirm(e.target.value)} placeholder="DELETE" className="rounded-xl"/>
            </div>
          )}
          {storeActionType==="notes" && (
            <Textarea value={storeAdminNote} onChange={e=>setStoreAdminNote(e.target.value)} rows={3} placeholder="Internal admin note…" className="rounded-xl resize-none"/>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={()=>{setStoreActionTarget(null);setStoreActionType(null);}}>Cancel</Button>
            <Button className={`flex-1 rounded-xl ${storeActionType==="delete"?"bg-red-600 hover:bg-red-700 text-white border-0":""}`} onClick={saveStoreAction} disabled={savingStoreAction}>
              {savingStoreAction?"Saving…":"Confirm"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render Promotions ─────────────────────────────────────────────────────
  const renderPromotions = () => {
    const fmtDiscount = (p: PromotionRow) =>
      p.discount_type === "percentage" ? `${p.discount_value}%` : `J$${p.discount_value}`;
    const fmtApplies = (p: PromotionRow) =>
      p.applies_to === "all" ? "All Stores" : p.applies_to === "category" ? `Category: ${p.category}` : `${(p.store_ids ?? []).length} stores`;
    const activePromos = promotions.filter((p) => p.is_active);
    const pastPromos = promotions.filter((p) => !p.is_active);
    const allStores = stores.length > 0 ? stores : [];
    const filteredStores = allStores.filter((s) =>
      s.name.toLowerCase().includes(promoStoreSearch.toLowerCase())
    );

    return (
      <div className="p-4 space-y-5 pb-24">
        {/* ── Create Promotion form ── */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">Create Promotion</p>
          <Input placeholder="Title (e.g. Weekend Flash Sale)" value={promoForm.title}
            onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))} className="rounded-xl text-sm h-10" />
          <Textarea placeholder="Description (optional)" value={promoForm.description}
            onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))}
            rows={2} className="rounded-xl text-sm resize-none" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Discount Type</p>
              <select value={promoForm.discount_type}
                onChange={(e) => setPromoForm((f) => ({ ...f, discount_type: e.target.value as "percentage" | "fixed" }))}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (J$)</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                {promoForm.discount_type === "percentage" ? "Value (%)" : "Value (J$)"}
              </p>
              <Input type="number" placeholder="e.g. 10" value={promoForm.discount_value}
                onChange={(e) => setPromoForm((f) => ({ ...f, discount_value: e.target.value }))}
                className="rounded-xl text-sm h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Start Date</p>
              <Input type="datetime-local" value={promoForm.start_date}
                onChange={(e) => setPromoForm((f) => ({ ...f, start_date: e.target.value }))}
                className="rounded-xl text-xs h-10" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">End Date</p>
              <Input type="datetime-local" value={promoForm.end_date}
                onChange={(e) => setPromoForm((f) => ({ ...f, end_date: e.target.value }))}
                className="rounded-xl text-xs h-10" />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Applies To</p>
            <select value={promoForm.applies_to}
              onChange={(e) => setPromoForm((f) => ({ ...f, applies_to: e.target.value as "all" | "category" | "specific_stores" }))}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="all">All Stores</option>
              <option value="category">Specific Category</option>
              <option value="specific_stores">Specific Stores</option>
            </select>
          </div>

          {promoForm.applies_to === "category" && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Category</p>
              <select value={promoForm.category}
                onChange={(e) => setPromoForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none">
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c.label} value={c.label}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
          )}

          {promoForm.applies_to === "specific_stores" && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Select Stores</p>
              <Input placeholder="Search stores…" value={promoStoreSearch}
                onChange={(e) => setPromoStoreSearch(e.target.value)} className="rounded-xl text-xs h-8 mb-1" />
              <div className="max-h-32 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                {filteredStores.slice(0, 20).map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary">
                    <input type="checkbox" checked={promoForm.store_ids.includes(s.id)}
                      onChange={(e) => {
                        setPromoForm((f) => ({
                          ...f,
                          store_ids: e.target.checked
                            ? [...f.store_ids, s.id]
                            : f.store_ids.filter((id) => id !== s.id),
                        }));
                      }} className="rounded" />
                    <span className="text-xs text-foreground truncate">{s.name}</span>
                  </label>
                ))}
                {filteredStores.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No stores found</p>}
              </div>
              {promoForm.store_ids.length > 0 && (
                <p className="text-[11px] text-blue-600 mt-1">{promoForm.store_ids.length} store{promoForm.store_ids.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 justify-between">
            <span className="text-sm text-muted-foreground">Activate immediately</span>
            <button
              onClick={() => setPromoForm((f) => ({ ...f, activate_immediately: !f.activate_immediately }))}
              className="transition-colors"
            >
              {promoForm.activate_immediately
                ? <ToggleRight size={28} className="text-green-600" />
                : <ToggleLeft size={28} className="text-muted-foreground" />}
            </button>
          </div>

          <div className="text-[11px] text-muted-foreground bg-secondary rounded-xl px-3 py-2">
            ⚡ Store earnings are always protected. Discounts come from Rezo&apos;s 10% commission only.
          </div>

          <Button onClick={createPromotion} disabled={creatingPromo || !promoForm.title.trim() || !promoForm.discount_value}
            className="w-full rounded-xl h-10 booka-gradient text-white border-0">
            {creatingPromo ? "Creating…" : "Create Promotion"}
          </Button>
        </div>

        {/* ── Active Promotions ── */}
        {promotionsLoading ? (
          <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-20 rounded-2xl booka-shimmer"/>)}</div>
        ) : (
          <>
            {activePromos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Active ({activePromos.length})</p>
                <div className="space-y-2">
                  {activePromos.map((p) => (
                    <div key={p.id} className="bg-card rounded-2xl border border-green-200 shadow-sm p-4 space-y-2">
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">{p.title}</span>
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            <span className="text-[11px] font-bold text-green-700">{fmtDiscount(p)} off</span>
                            <span className="text-[11px] text-muted-foreground">{fmtApplies(p)}</span>
                            {p.end_date && <span className="text-[11px] text-amber-600">Ends {format(new Date(p.end_date), "MMM d, h:mm a")}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => togglePromotion(p)}
                          className="flex-1 h-8 rounded-xl text-xs font-semibold border border-amber-200 text-amber-600 hover:bg-amber-50 transition-all active:scale-95">
                          Deactivate
                        </button>
                        <button onClick={() => setPromoDeleteConfirm(p.id)}
                          className="h-8 px-3 rounded-xl text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-all active:scale-95">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Past Promotions ── */}
            {pastPromos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Past / Inactive ({pastPromos.length})</p>
                <div className="space-y-2">
                  {pastPromos.map((p) => (
                    <div key={p.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2 opacity-75">
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground">{p.title}</span>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            <span className="text-[11px] font-semibold text-muted-foreground">{fmtDiscount(p)} off</span>
                            <span className="text-[11px] text-muted-foreground">{fmtApplies(p)}</span>
                            <span className="text-[11px] text-muted-foreground">Created {format(new Date(p.created_at), "MMM d, yyyy")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => togglePromotion(p)}
                          className="flex-1 h-8 rounded-xl text-xs font-semibold border border-green-200 text-green-600 hover:bg-green-50 transition-all active:scale-95">
                          Reactivate
                        </button>
                        <button onClick={() => setPromoDeleteConfirm(p.id)}
                          className="h-8 px-3 rounded-xl text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-all active:scale-95">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {promotions.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Tag size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No promotions yet. Create your first one above.</p>
              </div>
            )}
          </>
        )}

        {/* ── Delete confirmation ── */}
        {promoDeleteConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-6" onClick={() => setPromoDeleteConfirm(null)}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <p className="font-bold text-foreground">Delete Promotion?</p>
              <p className="text-sm text-muted-foreground">This cannot be undone. If the promotion is active, an announcement will be sent to users that it has ended.</p>
              <div className="flex gap-2">
                <button onClick={() => setPromoDeleteConfirm(null)} className="flex-1 h-10 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-secondary">Cancel</button>
                <button onClick={() => deletePromotion(promoDeleteConfirm)}
                  disabled={deletingPromoId === promoDeleteConfirm}
                  className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-95 disabled:opacity-60">
                  {deletingPromoId === promoDeleteConfirm ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === "overview") return renderOverview();
    if (activeTab === "stores") return renderStores();
    if (activeTab === "customers") return renderCustomers();
    if (activeTab === "reports") return renderReports();
    if (activeTab === "disputes") return renderDisputes();
    if (activeTab === "bugs") return renderBugReports();
    if (activeTab === "bookings") return renderBookings();
    if (activeTab === "revenue") return renderRevenue();
    if (activeTab === "platform") return renderPlatform();
    if (activeTab === "financial") return renderFinancial();
    if (activeTab === "moderation") return renderModeration();
    if (activeTab === "communication") return renderCommunication();
    if (activeTab === "announcements") return renderAnnouncements();
    if (activeTab === "messages") return renderMessages();
    if (activeTab === "promotions") return renderPromotions();
    return null;
  };

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "stores", label: "Stores", icon: Store },
    { id: "customers", label: "Customers", icon: Users },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "disputes", label: "Disputes", icon: Shield },
    { id: "bugs", label: "Bugs", icon: AlertCircle },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "promotions", label: "Promotions", icon: Tag },
    { id: "platform", label: "Platform", icon: Settings2 },
    { id: "financial", label: "Financial", icon: CreditCard },
    { id: "moderation", label: "Moderation", icon: Eye },
    { id: "communication", label: "Comms", icon: Megaphone },
    { id: "announcements", label: "Announce", icon: Bell2 },
    { id: "messages", label: "Messages", icon: MessageSquare },
  ];

  const menuGroups: { label: string; items: typeof navItems }[] = [
    { label: "Dashboard", items: navItems.filter(n => n.id === "overview") },
    { label: "Management", items: navItems.filter(n => ["stores", "customers"].includes(n.id)) },
    { label: "Operations", items: navItems.filter(n => ["bookings", "disputes", "reports", "bugs"].includes(n.id)) },
    { label: "Revenue", items: navItems.filter(n => ["revenue", "financial", "promotions"].includes(n.id)) },
    { label: "Communication", items: navItems.filter(n => ["messages", "announcements", "communication"].includes(n.id)) },
    { label: "Platform", items: navItems.filter(n => ["platform", "moderation"].includes(n.id)) },
  ];

  const currentNavItem = navItems.find(n => n.id === activeTab);
  const CurrentIcon = currentNavItem?.icon ?? LayoutDashboard;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1e3a8a] px-4 pt-4 pb-4 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
          <X size={18} />
        </button>
        <button onClick={() => setMenuOpen(true)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
          <Menu size={18} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <CurrentIcon size={15} className="text-blue-200 shrink-0" />
          <div>
            <p className="text-white font-bold text-base leading-tight">{currentNavItem?.label ?? "Admin"}</p>
            <p className="text-blue-200 text-[11px]">Rezo Platform</p>
          </div>
        </div>
        <button onClick={() => signOut()} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
          <LogOut size={16} />
        </button>
      </div>

      {/* Burger menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[300] flex" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card w-72 max-w-[85vw] h-full flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1e3a8a] px-5 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-white font-bold text-base">Admin Menu</p>
                <p className="text-blue-200 text-xs">Rezo Platform</p>
              </div>
              <button onClick={() => setMenuOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              {menuGroups.map(group => (
                <div key={group.label} className="mb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-3 pb-1.5">{group.label}</p>
                  {group.items.map(item => (
                    <button key={item.id}
                      onClick={() => { setSelectedConv(null); setThread([]); setActiveTab(item.id); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all active:scale-[0.98] ${activeTab === item.id ? "bg-[#1e3a8a]/10 text-[#1e3a8a] dark:bg-blue-500/10 dark:text-blue-400" : "text-foreground hover:bg-secondary"}`}
                    >
                      <item.icon size={16} className={activeTab === item.id ? "text-[#1e3a8a] dark:text-blue-400" : "text-muted-foreground"} />
                      {item.label}
                      {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1e3a8a] dark:bg-blue-400" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-t border-border px-5 py-4 shrink-0">
              <button onClick={() => { signOut(); setMenuOpen(false); }} className="w-full flex items-center gap-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>

      {/* Contact dialog — Store */}
      {contactTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setContactTarget(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground text-base">Contact Store</p>
              <button onClick={() => setContactTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary"><X size={16} /></button>
            </div>
            <p className="text-sm text-muted-foreground">{contactTarget.name}</p>
            <div className="bg-secondary rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="font-mono text-sm font-semibold text-foreground">{contactTarget.phone}</p>
              <button onClick={() => { navigator.clipboard.writeText(contactTarget.phone); toast.success("Copied!"); }} className="text-xs text-blue-600 font-semibold">Copy</button>
            </div>
            <a href={`https://wa.me/${contactTarget.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-green-500 text-white text-sm font-semibold active:scale-95 transition-all">
              <Phone size={14} /> Message on WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Contact dialog — Customer */}
      {customerContactTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setCustomerContactTarget(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground text-base">Contact Customer</p>
              <button onClick={() => setCustomerContactTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary"><X size={16} /></button>
            </div>
            <p className="text-sm text-muted-foreground">{customerContactTarget.name}</p>
            <div className="bg-secondary rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="font-mono text-sm font-semibold text-foreground">{customerContactTarget.phone}</p>
              <button onClick={() => { navigator.clipboard.writeText(customerContactTarget.phone); toast.success("Copied!"); }} className="text-xs text-blue-600 font-semibold">Copy</button>
            </div>
            <a href={`https://wa.me/${customerContactTarget.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-green-500 text-white text-sm font-semibold active:scale-95 transition-all">
              <Phone size={14} /> Message on WhatsApp
            </a>
          </div>
        </div>
      )}
      {/* Suspension reason dialog */}
      {suspendReasonTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-6" onClick={() => setSuspendReasonTarget(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground text-base">Suspend Customer</p>
              <button onClick={() => setSuspendReasonTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary"><X size={16}/></button>
            </div>
            <p className="text-sm text-muted-foreground">Suspending <span className="font-semibold">{suspendReasonTarget.full_name || "this customer"}</span>. They will be unable to make new bookings.</p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason for suspension</label>
              <textarea
                value={suspendReasonText}
                onChange={(e) => setSuspendReasonText(e.target.value)}
                placeholder="e.g. Repeated no-shows, abusive behaviour…"
                rows={3}
                className="w-full text-sm rounded-xl border border-input p-3 resize-none focus:outline-none focus:ring-1 focus:ring-red-400 bg-background text-foreground"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSuspendReasonTarget(null)} className="flex-1 h-10 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-secondary transition-all">Cancel</button>
              <button onClick={confirmSuspendCustomer} disabled={savingSuspend} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all active:scale-95 disabled:opacity-60">
                {savingSuspend ? "Suspending…" : "Confirm Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store admin action dialog */}
      {renderStoreActionDialog()}

      {/* Customer bookings dialog */}
      {customerActionTarget && customerActionType === "bookings" && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center" onClick={() => { setCustomerActionTarget(null); setCustomerActionType(null); }}>
          <div className="absolute inset-0 bg-black/60"/>
          <div className="relative bg-card rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <p className="font-bold text-foreground text-base">Bookings — {customerActionTarget.full_name ?? "Customer"}</p>
              <button onClick={() => { setCustomerActionTarget(null); setCustomerActionType(null); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary"><X size={16}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {customerBookingsLoading ? (
                <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 rounded-2xl booka-shimmer"/>)}</div>
              ) : customerBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No bookings found</p>
              ) : customerBookings.map((b: any) => (
                <div key={b.id} className="bg-secondary rounded-2xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{b.store_name}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(b.reservation_date), "MMM d, yyyy")} · {b.start_time?.slice(0,5)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">{fmtJ(b.total_amount)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status==="completed"?"bg-green-100 text-green-700":b.status==="cancelled"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-700"}`}>{b.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
