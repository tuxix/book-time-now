import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Store, Users, Flag, Calendar, LogOut,
  Search, TrendingUp, Star, Ban, CheckCircle2, Eye, UserCheck,
  Shield, ChevronRight, X, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth } from "date-fns";

type AdminTab = "overview" | "stores" | "customers" | "reports" | "bookings";

interface StoreRow {
  id: string;
  name: string;
  category: string;
  rating: number;
  review_count: number;
  is_suspended: boolean;
  is_approved: boolean;
  created_at: string;
  booking_count?: number;
}

interface CustomerRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_suspended: boolean;
  created_at: string;
  email?: string;
  booking_count?: number;
}

interface ReportRow {
  id: string;
  store_id: string;
  reported_by: string;
  reason: string;
  status: string;
  created_at: string;
  store_name?: string;
  reporter_email?: string;
}

interface BookingRow {
  id: string;
  customer_id: string;
  store_id: string;
  reservation_date: string;
  start_time: string;
  status: string;
  payment_status: string | null;
  total_amount: number | null;
  customer_name?: string;
  store_name?: string;
  store_category?: string;
}

const AdminDashboard = ({ onBack }: { onBack: () => void }) => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    totalStores: 0, totalCustomers: 0, bookingsToday: 0,
    bookingsWeek: 0, bookingsMonth: 0, revenueMonth: 0,
    popularCategory: "—", mostActiveStore: "—",
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storesLoading, setStoresLoading] = useState(false);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");

  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [grantingAdmin, setGrantingAdmin] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === "stores") fetchStores();
    if (activeTab === "customers") fetchCustomers();
    if (activeTab === "reports") fetchReports();
    if (activeTab === "bookings") fetchBookings();
  }, [activeTab]);

  const fetchStats = async () => {
    setStatsLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    const [storesRes, customersRes, todayRes, weekRes, monthRes, revenueRes, storeBookingsRes] = await Promise.all([
      supabase.from("stores").select("id", { count: "exact" }),
      supabase.from("profiles").select("id", { count: "exact" }).eq("role", "customer"),
      supabase.from("reservations").select("id", { count: "exact" }).eq("reservation_date", today),
      supabase.from("reservations").select("id", { count: "exact" }).gte("reservation_date", weekStart),
      supabase.from("reservations").select("id", { count: "exact" }).gte("reservation_date", monthStart),
      supabase.from("reservations").select("total_amount").eq("status", "completed").gte("reservation_date", monthStart),
      supabase.from("reservations").select("store_id, stores(name, category)").gte("reservation_date", monthStart),
    ]);

    const revenue = (revenueRes.data ?? []).reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0);

    const catCount: Record<string, number> = {};
    const storeCount: Record<string, { name: string; count: number }> = {};
    (storeBookingsRes.data ?? []).forEach((r: any) => {
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
      totalCustomers: customersRes.count ?? 0,
      bookingsToday: todayRes.count ?? 0,
      bookingsWeek: weekRes.count ?? 0,
      bookingsMonth: monthRes.count ?? 0,
      revenueMonth: revenue,
      popularCategory: popCat,
      mostActiveStore: activeStore,
    });
    setStatsLoading(false);
  };

  const fetchStores = async () => {
    setStoresLoading(true);
    const { data } = await supabase
      .from("stores")
      .select("id, name, category, rating, review_count, is_suspended, is_approved, created_at")
      .order("created_at", { ascending: false });
    if (data) {
      const bookingCounts = await supabase
        .from("reservations")
        .select("store_id")
        .in("store_id", data.map((s: any) => s.id));
      const countMap: Record<string, number> = {};
      (bookingCounts.data ?? []).forEach((r: any) => { countMap[r.store_id] = (countMap[r.store_id] ?? 0) + 1; });
      setStores(data.map((s: any) => ({ ...s, booking_count: countMap[s.id] ?? 0 })));
    }
    setStoresLoading(false);
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, is_suspended, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false });
    if (data) {
      const { data: authData } = await supabase.auth.admin?.listUsers?.() ?? { data: null };
      setCustomers(data.map((p: any) => ({ ...p, booking_count: 0 })));
    }
    setCustomersLoading(false);
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    const { data } = await supabase
      .from("store_reports")
      .select("*, stores(name)")
      .order("created_at", { ascending: false });
    if (data) {
      setReports(data.map((r: any) => ({
        ...r,
        store_name: r.stores?.name ?? "Store",
      })));
    }
    setReportsLoading(false);
  };

  const fetchBookings = async () => {
    setBookingsLoading(true);
    let q = supabase
      .from("reservations")
      .select("id, customer_id, store_id, reservation_date, start_time, status, payment_status, total_amount, stores(name, category)")
      .order("reservation_date", { ascending: false })
      .limit(200);
    if (bookingDateFilter) q = q.eq("reservation_date", bookingDateFilter);
    if (bookingStatusFilter) q = q.eq("status", bookingStatusFilter);
    const { data } = await q;
    if (data) {
      const customerIds = [...new Set(data.map((r: any) => r.customer_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", customerIds);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name ?? `Customer`; });
      setBookings(data.map((r: any) => ({
        ...r,
        customer_name: nameMap[r.customer_id] ?? "Customer",
        store_name: r.stores?.name ?? "Store",
        store_category: r.stores?.category ?? "",
      })));
    }
    setBookingsLoading(false);
  };

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
  };

  const suspendStoreFromReport = async (report: ReportRow) => {
    const { error: rErr } = await supabase.from("store_reports").update({ status: "actioned" }).eq("id", report.id);
    const { error: sErr } = await supabase.from("stores").update({ is_suspended: true }).eq("id", report.store_id);
    if (rErr || sErr) { toast.error("Failed to suspend store"); return; }
    setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: "actioned" } : r));
    toast.success("Store suspended and report actioned");
  };

  const grantAdmin = async () => {
    if (!adminEmailInput.trim()) return;
    setGrantingAdmin(true);
    const { data: found } = await supabase
      .from("profiles")
      .select("id")
      .ilike("id", "%")
      .limit(500);
    const { data: authCheck } = await supabase.auth.getUser();
    const email = adminEmailInput.trim().toLowerCase();
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .limit(1000);
    if (!usersData) { toast.error("Could not find user"); setGrantingAdmin(false); return; }
    toast.info("To grant admin access, run this SQL in Supabase:\nUPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = '" + email + "')");
    setGrantingAdmin(false);
    setAdminEmailInput("");
  };

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "stores", label: "Stores", icon: Store },
    { id: "customers", label: "Customers", icon: Users },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "bookings", label: "Bookings", icon: Calendar },
  ];

  const filteredStores = stores.filter((s) =>
    !storeSearch || s.name.toLowerCase().includes(storeSearch.toLowerCase())
  );
  const filteredCustomers = customers.filter((c) =>
    !customerSearch || (c.full_name ?? "").toLowerCase().includes(customerSearch.toLowerCase())
  );

  const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 p-4">
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-20 rounded-2xl booka-shimmer" />)}
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
              <StatCard label="Revenue (Month)" value={`J$${stats.revenueMonth.toLocaleString()}`} />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Insights</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  <span className="text-sm font-medium text-slate-700">Popular Category</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{stats.popularCategory}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-400" />
                  <span className="text-sm font-medium text-slate-700">Most Active Store</span>
                </div>
                <span className="text-sm font-bold text-slate-900 text-right max-w-[140px] truncate">{stats.mostActiveStore}</span>
              </div>
            </div>
          </div>

          {/* Grant admin */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Admin Access</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <p className="text-xs text-slate-500">Enter an email address to grant admin access</p>
              <div className="flex gap-2">
                <Input
                  placeholder="user@example.com"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  className="flex-1 h-10 rounded-xl text-sm"
                />
                <Button
                  onClick={grantAdmin}
                  disabled={grantingAdmin || !adminEmailInput.trim()}
                  size="sm"
                  className="rounded-xl px-3 h-10"
                >
                  <Shield size={14} className="mr-1.5" />
                  Grant
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStores = () => (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search stores…"
          value={storeSearch}
          onChange={(e) => setStoreSearch(e.target.value)}
          className="pl-9 rounded-xl h-10 text-sm"
        />
      </div>
      {storesLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl booka-shimmer" />)}
        </div>
      ) : filteredStores.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No stores found</p>
      ) : (
        filteredStores.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                  {s.is_suspended && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">SUSPENDED</span>
                  )}
                  {!s.is_approved && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">PENDING</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{s.category} · {s.booking_count} bookings · ★ {s.review_count > 0 ? s.rating.toFixed(1) : "New"}</p>
                <p className="text-[11px] text-slate-400">Joined {format(new Date(s.created_at), "MMM d, yyyy")}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => toggleStoreSuspend(s)}
                className={`flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 ${
                  s.is_suspended
                    ? "border-green-200 text-green-700 hover:bg-green-50"
                    : "border-red-200 text-red-600 hover:bg-red-50"
                }`}
              >
                <Ban size={12} />
                {s.is_suspended ? "Reinstate" : "Suspend"}
              </button>
              <button
                onClick={() => toggleStoreApprove(s)}
                className={`flex-1 h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 ${
                  s.is_approved
                    ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                    : "border-green-200 text-green-700 hover:bg-green-50"
                }`}
              >
                <CheckCircle2 size={12} />
                {s.is_approved ? "Revoke Approval" : "Approve"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderCustomers = () => (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search customers…"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          className="pl-9 rounded-xl h-10 text-sm"
        />
      </div>
      {customersLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl booka-shimmer" />)}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No customers found</p>
      ) : (
        filteredCustomers.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900 text-sm">{c.full_name || "Anonymous"}</p>
                  {c.is_suspended && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">SUSPENDED</span>
                  )}
                </div>
                {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                <p className="text-[11px] text-slate-400">Joined {format(new Date(c.created_at), "MMM d, yyyy")}</p>
              </div>
              <button
                onClick={() => toggleCustomerSuspend(c)}
                className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all active:scale-95 shrink-0 ${
                  c.is_suspended
                    ? "border-green-200 text-green-700 hover:bg-green-50"
                    : "border-red-200 text-red-600 hover:bg-red-50"
                }`}
              >
                <Ban size={11} />
                {c.is_suspended ? "Reinstate" : "Suspend"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderReports = () => (
    <div className="p-4 space-y-3">
      {reportsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl booka-shimmer" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <Flag size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">No reports yet</p>
        </div>
      ) : (
        reports.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 text-sm">{r.store_name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.status === "pending" ? "bg-amber-100 text-amber-700"
                    : r.status === "reviewed" ? "bg-slate-100 text-slate-500"
                    : "bg-red-100 text-red-600"
                  }`}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.reason}</p>
                <p className="text-[11px] text-slate-400 mt-1">{format(new Date(r.created_at), "MMM d, yyyy h:mm a")}</p>
              </div>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <button
                  onClick={() => dismissReport(r.id)}
                  className="flex-1 h-8 rounded-xl text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <X size={12} /> Dismiss
                </button>
                <button
                  onClick={() => suspendStoreFromReport(r)}
                  className="flex-1 h-8 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 active:scale-95 transition-all"
                >
                  <Ban size={12} /> Suspend Store
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
    arrived: "bg-purple-100 text-purple-700",
    in_progress: "bg-orange-100 text-orange-700",
    no_show: "bg-slate-100 text-slate-600",
  };

  const renderBookings = () => (
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        <Input
          type="date"
          value={bookingDateFilter}
          onChange={(e) => setBookingDateFilter(e.target.value)}
          className="flex-1 rounded-xl h-10 text-sm"
        />
        <select
          value={bookingStatusFilter}
          onChange={(e) => setBookingStatusFilter(e.target.value)}
          className="flex-1 rounded-xl h-10 text-sm border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="arrived">Arrived</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>
      <Button
        onClick={fetchBookings}
        variant="outline"
        size="sm"
        className="w-full rounded-xl h-9 text-xs"
      >
        Apply Filters
      </Button>
      {bookingsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl booka-shimmer" />)}
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No bookings found</p>
      ) : (
        bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{b.store_name}</p>
                <p className="text-xs text-slate-500">{b.customer_name} · {b.store_category}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColors[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                {b.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{b.reservation_date} · {b.start_time.slice(0, 5)}</p>
              {b.total_amount != null && (
                <p className="text-xs font-bold text-slate-900">J${b.total_amount}</p>
              )}
            </div>
            {b.payment_status && (
              <p className="text-[11px] text-slate-400">Payment: {b.payment_status}</p>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderContent = () => {
    if (activeTab === "overview") return renderOverview();
    if (activeTab === "stores") return renderStores();
    if (activeTab === "customers") return renderCustomers();
    if (activeTab === "reports") return renderReports();
    if (activeTab === "bookings") return renderBookings();
    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1e3a8a] px-4 pt-safe-top pt-4 pb-4 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
        >
          <X size={18} />
        </button>
        <div className="flex-1">
          <p className="text-white font-bold text-base leading-tight">Admin Dashboard</p>
          <p className="text-blue-200 text-[11px]">Booka Platform</p>
        </div>
        <button
          onClick={() => signOut()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto bg-white border-b border-slate-200 shrink-0 px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === item.id
                ? "border-[#1e3a8a] text-[#1e3a8a]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
