import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import AuthPage from "@/pages/AuthPage";
import RoleSelectPage from "@/pages/RoleSelectPage";
import CustomerHome from "@/pages/CustomerHome";
import StoreDashboard from "@/pages/StoreDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, profile, loading } = useAuth();
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (!profile) return <RoleSelectPage />;

  if (showAdmin && profile.is_admin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />;
  }

  if (showDashboard) {
    return <StoreDashboard onBack={() => setShowDashboard(false)} />;
  }

  return (
    <>
      {/* Admin-only Test Mode banner — payment bypass is active in this build */}
      {profile.is_admin && (
        <div
          data-testid="banner-test-mode"
          className="fixed top-0 inset-x-0 z-[1000] text-center text-[11px] font-semibold py-1 px-2 bg-amber-300 text-amber-950 shadow-md pointer-events-none"
          style={{ paddingTop: "max(env(safe-area-inset-top), 4px)" }}
        >
          🧪 Test Mode — Payment bypass is active
        </div>
      )}
      <Routes>
        <Route
          path="/admin"
          element={
            profile.is_admin
              ? <AdminDashboard onBack={() => {}} />
              : <Navigate to="/" replace />
          }
        />
        <Route
          path="/"
          element={
            <CustomerHome
              onSwitchToDashboard={profile.role === "store" ? () => setShowDashboard(true) : undefined}
              onSwitchToAdmin={profile.is_admin ? () => setShowAdmin(true) : undefined}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
