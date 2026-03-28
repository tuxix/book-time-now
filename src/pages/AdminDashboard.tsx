import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Store, Users, Flag, Calendar, LogOut,
  Search, TrendingUp, Star, Ban, CheckCircle2, X, Shield,
  DollarSign, Megaphone, MessageSquare, Phone, AlertCircle,
  Download, Send, ArrowLeft, Clock, UserCheck, Loader2,
  Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth, subMonths, differenceInDays, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type AdminTab = "overview" | "stores" | "customers" | "reports" | "bookings" | "revenue" | "announcements" | "messages";

interface StoreRow {
  id: string; user_id: string; name: string; category: string; address?: string; phone?: string;
  rating: number; review_count: number; is_suspended: boolean; is_approved: boolean;
  created_at: string; booking_count: number; active_slots: number;
  last_booking_date: string | null; total_revenue: number;
}
interface CustomerRow {
  id: string; full_name: string | null; phone: string | null;
  is_suspended: boolean; created_at: string; booking_count: number;
  total_spent: number; no_show_count: number; last_booking_date: string | null;
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

  // Overview
  const [stats, setStats] = useState({
    totalStores: 0, totalCustomers: 0, bookingsToday: 0,
    bookingsWeek: 0, bookingsMonth: 0, revenueMonth: 0, revenueAllTime: 0,
    pendingApproval: 0, unresolvedReports: 0,
    popularCategory: "—", mostActiveStore: "—",
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Stores
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storesLoading, setStoresLoading] = useState(false);
  const [contactTarget, setContactTarget] = useState<{ name: string; phone: string } | null>(null);
  const [msgTarget, setMsgTarget] = useState<{ recipientId: string; name: string } | null>(null);
  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

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

  // Admin grant
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { fetchStats(); fetchActivity(); }, []);
  useEffect(() => {
    if (activeTab === "stores") fetchStores();
    else if (activeTab === "customers") fetchCustomers();
    else if (activeTab === "reports") fetchReports();
    else if (activeTab === "bookings") fetchBookings();
    else if (activeTab === "revenue") fetchRevenue();
    else if (activeTab === "announcements") fetchAnnouncements();
    else if (activeTab === "messages") fetchConversations();
  }, [activeTab]);

  // ── Fetch stats ───────────────────────────────────────────────────────────
  const fetchStats = async () => {
    setStatsLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    const [storesRes, custRes, todayRes, weekRes, monthRes, revMonthRes, revAllRes,
           pendingRes, unresolvedRes, catRes] = await Promise.all([
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
      .select("id, user_id, name, category, address, phone, rating, review_count, is_suspended, is_approved, created_at")
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
      .select("id, full_name, phone, is_suspended, created_at")
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
    const next = !c.is_suspended;
    const { error } = await supabase.from("profiles").update({ is_suspended: next }).eq("id", c.id);
    if (error) { toast.error("Failed to update customer"); return; }
    setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, is_suspended: next } : x));
    toast.success(next ? "Customer suspended" : "Customer reinstated");
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

  const sendAdminMessage = async () => {
    if (!msgText.trim() || !msgTarget || !user) return;
    setSendingMsg(true);
    const { error } = await supabase.from("admin_messages").insert({
      recipient_id: msgTarget.recipientId,
      sender_id: user.id,
      message: msgText.trim(),
    });
    if (error) { toast.error("Failed to send message"); setSendingMsg(false); return; }
    toast.success(`Message sent to ${msgTarget.name}`);
    setMsgTarget(null);
    setMsgText("");
    setSendingMsg(false);
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
    <div className={`rounded-2xl p-4 shadow-sm border ${highlight === "red" ? "bg-red-50 border-red-200" : highlight === "amber" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${highlight === "red" ? "text-red-700" : highlight === "amber" ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
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
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Platform Summary</p>
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
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Insights</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2"><TrendingUp size={16} className="text-primary" /><span className="text-sm font-medium text-slate-700">Popular Category</span></div>
                <span className="text-sm font-bold text-slate-900">{stats.popularCategory}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2"><Star size={16} className="text-amber-400" /><span className="text-sm font-medium text-slate-700">Most Active Store</span></div>
                <span className="text-sm font-bold text-slate-900 text-right max-w-[140px] truncate">{stats.mostActiveStore}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Recent Activity</p>
            {activityLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-xl booka-shimmer" />)}</div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No recent activity</p>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-snug">{item.description}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{format(new Date(item.timestamp), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Admin Access</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <p className="text-xs text-slate-500">Enter an email to generate the SQL to grant admin access</p>
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
  const renderStores = () => {
    const filtered = stores.filter((s) => !storeSearch || s.name.toLowerCase().includes(storeSearch.toLowerCase()));
    return (
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search stores…" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-sm" />
          </div>
          <Button onClick={exportStoresCSV} variant="outline" size="sm" className="rounded-xl h-10 px-3 shrink-0">
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>
        {storesLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl booka-shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No stores found</p>
        ) : filtered.map((s) => {
          const inactive = isInactive(s.last_booking_date, 30);
          return (
            <div key={s.id} className={`rounded-2xl border shadow-sm p-4 space-y-3 ${inactive && s.booking_count > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                    {s.is_suspended && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                    {!s.is_approved && <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">PENDING</span>}
                    {inactive && s.booking_count > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">INACTIVE</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.category} · ★ {s.review_count > 0 ? s.rating.toFixed(1) : "New"}</p>
                  {s.address && <p className="text-xs text-slate-500 mt-0.5 truncate">{s.address}</p>}
                  {s.phone && <p className="text-xs text-slate-500">{s.phone}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <p className="text-[11px] text-slate-400">{s.booking_count} bookings</p>
                    <p className="text-[11px] text-slate-400">{s.active_slots} slots</p>
                    <p className="text-[11px] text-slate-400">Revenue: {fmtJ(s.total_revenue)}</p>
                    <p className="text-[11px] text-slate-400">Last booking: {s.last_booking_date ? format(parseISO(s.last_booking_date), "MMM d, yyyy") : "Never"}</p>
                    <p className="text-[11px] text-slate-400">Joined {format(new Date(s.created_at), "MMM d, yyyy")}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => toggleStoreSuspend(s)} className={`flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 ${s.is_suspended ? "border-green-200 text-green-700 hover:bg-green-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                  <Ban size={12} />{s.is_suspended ? "Reinstate" : "Suspend"}
                </button>
                <button onClick={() => toggleStoreApprove(s)} className={`flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 ${s.is_approved ? "border-slate-200 text-slate-500 hover:bg-slate-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}>
                  <CheckCircle2 size={12} />{s.is_approved ? "Revoke Approval" : "Approve"}
                </button>
                {s.phone && (
                  <button onClick={() => setContactTarget({ name: s.name, phone: s.phone! })} className="flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                    <Phone size={12} /> Contact
                  </button>
                )}
                {s.user_id && (
                  <button onClick={() => { setMsgTarget({ recipientId: s.user_id, name: s.name }); setMsgText(""); }} className="flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-violet-200 text-violet-600 hover:bg-violet-50 transition-all active:scale-95">
                    <MessageSquare size={12} /> Message
                  </button>
                )}
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
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search customers…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-sm" />
          </div>
          <Button onClick={exportCustomersCSV} variant="outline" size="sm" className="rounded-xl h-10 px-3 shrink-0">
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>
        {customersLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl booka-shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No customers found</p>
        ) : filtered.map((c) => {
          const inactive = isInactive(c.last_booking_date, 60);
          const flagNoShow = c.no_show_count >= 3;
          return (
            <div key={c.id} className={`rounded-2xl border shadow-sm p-4 space-y-3 ${inactive && c.booking_count > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm">{c.full_name || "Anonymous"}</p>
                    {c.is_suspended && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                    {inactive && c.booking_count > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">INACTIVE</span>}
                  </div>
                  {c.phone && <p className="text-xs text-slate-500 mt-0.5">{c.phone}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <p className="text-[11px] text-slate-400">{c.booking_count} bookings</p>
                    <p className="text-[11px] text-slate-400">Spent: {fmtJ(c.total_spent)}</p>
                    <p className={`text-[11px] font-semibold ${flagNoShow ? "text-red-500" : "text-slate-400"}`}>No-shows: {c.no_show_count}</p>
                    <p className="text-[11px] text-slate-400">Last: {c.last_booking_date ? format(parseISO(c.last_booking_date), "MMM d, yyyy") : "Never"}</p>
                    <p className="text-[11px] text-slate-400">Joined {format(new Date(c.created_at), "MMM d, yyyy")}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleCustomerSuspend(c)} className={`flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 ${c.is_suspended ? "border-green-200 text-green-700 hover:bg-green-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                  <Ban size={11} />{c.is_suspended ? "Reinstate" : "Suspend"}
                </button>
                {c.phone && (
                  <button onClick={() => setCustomerContactTarget({ name: c.full_name ?? "Customer", phone: c.phone! })} className="flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all active:scale-95">
                    <Phone size={11} /> Contact
                  </button>
                )}
                <button onClick={() => { setMsgTarget({ recipientId: c.id, name: c.full_name ?? "Customer" }); setMsgText(""); }} className="flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-violet-200 text-violet-600 hover:bg-violet-50 transition-all active:scale-95">
                  <MessageSquare size={11} /> Message
                </button>
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
        <div className="text-center py-12"><Flag size={36} className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-400">No reports yet</p></div>
      ) : reports.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 text-sm">{r.store_name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "reviewed" ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-600"}`}>
                  {r.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.reason}</p>
              <p className="text-[11px] text-slate-400 mt-1">{format(new Date(r.created_at), "MMM d, yyyy h:mm a")}</p>
            </div>
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => dismissReport(r.id)} className="flex-1 h-8 rounded-xl text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1 active:scale-95 transition-all">
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
    in_progress: "bg-orange-100 text-orange-700", no_show: "bg-slate-100 text-slate-600",
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
        <p className="text-sm text-slate-400 text-center py-8">No bookings found</p>
      ) : bookings.map((b) => (
        <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate">{b.store_name}</p>
              <p className="text-xs text-slate-500">{b.customer_name} · {b.store_category}</p>
              {b.service_names && b.service_names !== "—" && <p className="text-xs text-slate-500 mt-0.5 truncate">{b.service_names}</p>}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColors[b.status] ?? "bg-slate-100 text-slate-600"}`}>
              {b.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{b.reservation_date} · {b.start_time?.slice(0, 5)}</p>
            {b.total_amount != null && <p className="text-xs font-bold text-slate-900">{fmtJ(b.total_amount)}</p>}
          </div>
          <div className="flex items-center justify-between">
            {b.commitment_fee_amount != null && <p className="text-[11px] text-slate-400">Deposit: {fmtJ(b.commitment_fee_amount)}</p>}
            {b.payment_status && <p className="text-[11px] text-slate-400">Payment: {b.payment_status}</p>}
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
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Revenue Summary</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="All Time" value={fmtJ(revenueData.allTime)} sub="completed bookings" />
              <StatCard label="This Month" value={fmtJ(revenueData.thisMonth)} />
              <StatCard label="This Week" value={fmtJ(revenueData.thisWeek)} />
              <StatCard label="Avg Booking" value={fmtJ(Math.round(revenueData.avgBooking))} sub="per completed booking" />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Monthly Revenue — Last 12 Months</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
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
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">By Category</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              {revenueData.byCategory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No data</p>
              ) : revenueData.byCategory.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{cat.category}</p>
                    <p className="text-[11px] text-slate-400">{cat.bookings} bookings</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{fmtJ(cat.revenue)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Top 10 Stores by Revenue</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              {revenueData.byStore.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No data</p>
              ) : revenueData.byStore.map((s, i) => (
                <div key={s.name + i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400">{s.bookings} bookings</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 shrink-0">{fmtJ(s.revenue)}</p>
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
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Compose Announcement</p>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
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
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sent Announcements</p>
        {annLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12"><Megaphone size={36} className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-400">No announcements sent yet</p></div>
        ) : announcements.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm">{a.title}</p>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{a.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.audience === "all" ? "bg-blue-100 text-blue-700" : a.audience === "stores" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                    {a.audience === "all" ? "All Users" : a.audience === "stores" ? "Stores" : "Customers"}
                  </span>
                  <p className="text-[11px] text-slate-400">{format(new Date(a.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>
              <button onClick={() => deleteAnnouncement(a.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 shrink-0">
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
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
            <button onClick={() => { setSelectedConv(null); setThread([]); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-90 transition-all">
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 text-sm truncate">{selectedConv.store_name}</p>
              <p className="text-xs text-slate-500">{selectedConv.customer_name}</p>
            </div>
            {selectedConv.has_report && <Flag size={16} className="text-red-500 shrink-0" />}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-12 rounded-2xl booka-shimmer ${i % 2 === 0 ? "ml-8" : "mr-8"}`} />)}</div>
            ) : thread.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No messages</p>
            ) : thread.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_role === "store" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${msg.sender_role === "store" ? "bg-slate-100 text-slate-800" : "bg-[#1e3a8a] text-white"}`}>
                  <p className="text-xs font-semibold mb-0.5 opacity-60">{msg.sender_role === "store" ? selectedConv.store_name : selectedConv.customer_name}</p>
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${msg.sender_role === "store" ? "text-slate-400" : "text-blue-200"}`}>{format(new Date(msg.created_at), "h:mm a")}</p>
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
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by store or customer…" value={msgSearch} onChange={(e) => setMsgSearch(e.target.value)} className="pl-9 rounded-xl h-10 text-sm" />
        </div>
        {msgsLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl booka-shimmer" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><MessageSquare size={36} className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-400">No conversations yet</p></div>
        ) : filtered.map((c) => (
          <button key={c.key} onClick={() => { setSelectedConv(c); fetchThread(c.reservation_id); }} className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left flex items-start gap-3 active:scale-[0.98] transition-all hover:bg-slate-50">
            <div className="w-9 h-9 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-[#1e3a8a]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-slate-900 text-sm truncate">{c.store_name}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {c.has_report && <Flag size={12} className="text-red-500" />}
                  <p className="text-[11px] text-slate-400">{format(new Date(c.last_message_at), "MMM d")}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">{c.customer_name}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{c.last_message}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // ── renderContent ─────────────────────────────────────────────────────────
  const renderContent = () => {
    if (activeTab === "overview") return renderOverview();
    if (activeTab === "stores") return renderStores();
    if (activeTab === "customers") return renderCustomers();
    if (activeTab === "reports") return renderReports();
    if (activeTab === "bookings") return renderBookings();
    if (activeTab === "revenue") return renderRevenue();
    if (activeTab === "announcements") return renderAnnouncements();
    if (activeTab === "messages") return renderMessages();
    return null;
  };

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "stores", label: "Stores", icon: Store },
    { id: "customers", label: "Customers", icon: Users },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "announcements", label: "Announce", icon: Megaphone },
    { id: "messages", label: "Messages", icon: MessageSquare },
  ];

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1e3a8a] px-4 pt-4 pb-4 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
          <X size={18} />
        </button>
        <div className="flex-1">
          <p className="text-white font-bold text-base leading-tight">Admin Dashboard</p>
          <p className="text-blue-200 text-[11px]">Booka Platform</p>
        </div>
        <button onClick={() => signOut()} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
          <LogOut size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto bg-white border-b border-slate-200 shrink-0 px-2 scrollbar-hide">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => { setSelectedConv(null); setThread([]); setActiveTab(item.id); }}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === item.id ? "border-[#1e3a8a] text-[#1e3a8a]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <item.icon size={14} />{item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>

      {/* Message dialog */}
      {msgTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => !sendingMsg && setMsgTarget(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 text-base">Send Message</p>
                <p className="text-sm text-slate-500 mt-0.5">To: {msgTarget.name}</p>
              </div>
              <button onClick={() => setMsgTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <Textarea
              placeholder="Type your message…"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              className="rounded-xl resize-none text-sm"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMsgTarget(null)} className="flex-1 rounded-xl" disabled={sendingMsg}>
                Cancel
              </Button>
              <Button onClick={sendAdminMessage} disabled={sendingMsg || !msgText.trim()} className="flex-1 rounded-xl">
                {sendingMsg ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Send size={14} className="mr-1.5" />}
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contact dialog — Store */}
      {contactTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setContactTarget(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900 text-base">Contact Store</p>
              <button onClick={() => setContactTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-600">{contactTarget.name}</p>
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="font-mono text-sm font-semibold text-slate-800">{contactTarget.phone}</p>
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
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900 text-base">Contact Customer</p>
              <button onClick={() => setCustomerContactTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-600">{customerContactTarget.name}</p>
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="font-mono text-sm font-semibold text-slate-800">{customerContactTarget.phone}</p>
              <button onClick={() => { navigator.clipboard.writeText(customerContactTarget.phone); toast.success("Copied!"); }} className="text-xs text-blue-600 font-semibold">Copy</button>
            </div>
            <a href={`https://wa.me/${customerContactTarget.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-green-500 text-white text-sm font-semibold active:scale-95 transition-all">
              <Phone size={14} /> Message on WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
