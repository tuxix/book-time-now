import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  onBack: () => void;
  onSaved?: (name: string, phone: string, avatarUrl: string | null) => void;
}

const EditProfileScreen = ({ onBack, onSaved }: Props) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "");
          setPhone(data.phone ?? "");
          setAvatarUrl(data.avatar_url ?? null);
        }
        setLoading(false);
      });
  }, [user]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from("customer-avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error("Upload failed — " + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("customer-avatars").getPublicUrl(path);
    const url = urlData.publicUrl + `?t=${Date.now()}`;
    setAvatarUrl(url);
    setUploading(false);
    toast.success("Photo updated");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim(), avatar_url: avatarUrl })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error("Could not save changes"); return; }
    toast.success("Profile updated");
    onSaved?.(fullName.trim(), phone.trim(), avatarUrl);
    onBack();
  };

  const initials = (fullName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="absolute inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-4 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-secondary active:scale-90 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-foreground">Edit Profile</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <div className="w-24 h-24 rounded-full booka-shimmer mx-auto" />
            <div className="h-12 rounded-xl booka-shimmer" />
            <div className="h-12 rounded-xl booka-shimmer" />
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <button
                className="relative group"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-full booka-gradient flex items-center justify-center text-white text-2xl font-bold"
                    style={{ boxShadow: "0 0 0 4px hsl(213 82% 48% / 0.15)" }}
                  >
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 size={22} className="text-white animate-spin" />
                  ) : (
                    <Camera size={22} className="text-white" />
                  )}
                </div>
              </button>
              <p className="text-xs text-muted-foreground">Tap to change photo</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</label>
                <Input
                  data-testid="input-full-name"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl h-12 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                <Input
                  data-testid="input-phone"
                  placeholder="+1 876-000-0000"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl h-12 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
                <Input
                  value={user?.email ?? ""}
                  disabled
                  className="rounded-xl h-12 text-sm bg-secondary text-muted-foreground"
                />
                <p className="text-[11px] text-muted-foreground px-1">Email cannot be changed here</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save button */}
      <div className="px-5 pb-6 pt-3 border-t border-border shrink-0">
        <Button
          data-testid="button-save-profile"
          onClick={handleSave}
          disabled={saving || loading || uploading}
          className="w-full h-12 rounded-xl font-semibold"
        >
          {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving…</> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default EditProfileScreen;
