import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  ArrowLeft, User, Mail, Lock, Trash2, Bell, Sun, Moon, MapPin,
  Shield, HelpCircle, Bug, Star, Info, ChevronRight, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
  onEditProfile: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-2">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-5 pt-5 pb-2">{title}</p>
    <div className="bg-card mx-4 rounded-2xl overflow-hidden border border-border">
      {children}
    </div>
  </div>
);

const Row = ({
  icon: Icon, label, sublabel, onPress, danger = false, right, iconColor,
}: {
  icon: React.ElementType; label: string; sublabel?: string; onPress?: () => void;
  danger?: boolean; right?: React.ReactNode; iconColor?: string;
}) => (
  <button
    onClick={onPress}
    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98] border-b border-border/50 last:border-0"
  >
    <Icon size={18} className={iconColor ?? (danger ? "text-red-500" : "text-muted-foreground")} />
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium ${danger ? "text-red-500" : "text-foreground"}`}>{label}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
    </div>
    {right ?? <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
  </button>
);

const SettingsScreen = ({ onBack, onEditProfile }: Props) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [changeEmailDialog, setChangeEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [changePasswordDialog, setChangePasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your new email for a confirmation link");
    setChangeEmailDialog(false);
    setNewEmail("");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated successfully");
    setChangePasswordDialog(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    toast.info("Please contact support to delete your account.");
    setDeleteDialog(false);
  };

  return (
    <div className="absolute inset-x-0 top-0 bg-background flex flex-col slide-in-right" style={{ bottom: 56, zIndex: 300, overflowY: "auto" }}>
      {/* Header */}
      <div className="shrink-0 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-secondary active:scale-95 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-foreground">Settings</h1>
      </div>

      {/* ── Account ── */}
      <Section title="Account">
        <Row icon={User} label="Edit Profile" sublabel="Name, phone, photo" onPress={onEditProfile} />
        <Row icon={Mail} label="Change Email" sublabel={user?.email ?? undefined} onPress={() => setChangeEmailDialog(true)} />
        <Row icon={Lock} label="Change Password" onPress={() => setChangePasswordDialog(true)} />
        <Row icon={Trash2} label="Delete Account" danger onPress={() => setDeleteDialog(true)} right={<></>} />
      </Section>

      {/* ── Appearance ── */}
      <Section title="Appearance">
        <Row
          icon={theme === "dark" ? Moon : Sun}
          iconColor={theme === "dark" ? "text-amber-400" : "text-slate-500"}
          label={theme === "dark" ? "Dark Mode" : "Light Mode"}
          sublabel="Tap to switch"
          onPress={toggleTheme}
          right={
            <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${theme === "dark" ? "bg-primary" : "bg-secondary border border-border"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${theme === "dark" ? "left-[22px]" : "left-0.5"}`} />
            </div>
          }
        />
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications">
        <Row icon={Bell} label="Booking Confirmations" sublabel="Get notified when bookings are confirmed" right={<span className="text-xs text-muted-foreground">System</span>} onPress={() => toast.info("Manage in your device notification settings")} />
        <Row icon={Bell} label="Status Updates" sublabel="Arrived, in progress, completed" right={<span className="text-xs text-muted-foreground">System</span>} onPress={() => toast.info("Manage in your device notification settings")} />
        <Row icon={Bell} label="Messages" sublabel="New messages from stores" right={<span className="text-xs text-muted-foreground">System</span>} onPress={() => toast.info("Manage in your device notification settings")} />
      </Section>

      {/* ── Location ── */}
      <Section title="Location">
        <Row icon={MapPin} label="Location Permission" sublabel="Used to find nearby stores" onPress={() => toast.info("Open your browser or device settings to manage location access")} />
      </Section>

      {/* ── Privacy ── */}
      <Section title="Privacy">
        <Row icon={Shield} label="Privacy Policy" onPress={() => toast.info("Privacy policy coming soon")} right={<ExternalLink size={14} className="text-muted-foreground" />} />
        <Row icon={Shield} label="Terms of Service" onPress={() => toast.info("Terms of service coming soon")} right={<ExternalLink size={14} className="text-muted-foreground" />} />
      </Section>

      {/* ── Support ── */}
      <Section title="Support">
        <Row icon={HelpCircle} label="Help & FAQ" onPress={() => toast.info("Help centre coming soon")} />
        <Row icon={Bug} label="Report a Bug" sublabel="Let us know what went wrong" onPress={() => toast.info("Bug reporting coming soon")} />
        <Row icon={Star} label="Rate the App" onPress={() => toast.info("Thank you! Rating link coming soon")} />
      </Section>

      {/* ── About ── */}
      <Section title="About">
        <Row icon={Info} label="App Version" sublabel="Booka v1.0.0" onPress={() => {}} right={<span className="text-xs text-muted-foreground">v1.0.0</span>} />
        <Row icon={Info} label="What's New" onPress={() => toast.info("Changelog coming soon")} />
      </Section>

      <div className="pb-8" />

      {/* Change Email dialog */}
      {changeEmailDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => !savingEmail && setChangeEmailDialog(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-foreground text-base">Change Email</p>
            <p className="text-sm text-muted-foreground">Current: {user?.email}</p>
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" type="email" className="rounded-xl" autoFocus />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setChangeEmailDialog(false)} className="flex-1 rounded-xl" disabled={savingEmail}>Cancel</Button>
              <Button onClick={handleChangeEmail} disabled={savingEmail || !newEmail.trim()} className="flex-1 rounded-xl">
                {savingEmail ? "Saving…" : "Update Email"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password dialog */}
      {changePasswordDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => !savingPassword && setChangePasswordDialog(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-foreground text-base">Change Password</p>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" type="password" className="rounded-xl" autoFocus />
            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" type="password" className="rounded-xl" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setChangePasswordDialog(false)} className="flex-1 rounded-xl" disabled={savingPassword}>Cancel</Button>
              <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword} className="flex-1 rounded-xl">
                {savingPassword ? "Saving…" : "Update Password"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account dialog */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6" onClick={() => setDeleteDialog(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-red-600 text-base">Delete Account</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone. All your data including bookings and reviews will be permanently deleted.</p>
            <p className="text-sm text-foreground font-medium">Type DELETE to confirm:</p>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="rounded-xl" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteDialog(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE"} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white border-0">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
