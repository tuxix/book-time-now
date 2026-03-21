import { User, Settings, HelpCircle, LogOut, ChevronRight, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfileScreen = () => {
  const navigate = useNavigate();

  const menuItems = [
    { icon: User, label: "Edit Profile" },
    { icon: Settings, label: "Settings" },
    { icon: HelpCircle, label: "Help & Support" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-4 fade-in">
          <div className="w-16 h-16 rounded-full booka-gradient flex items-center justify-center text-primary-foreground text-xl font-bold">
            JD
          </div>
          <div>
            <h1 className="text-xl font-bold">Jordan Davis</h1>
            <p className="text-sm text-muted-foreground">+1 876-555-0199</p>
          </div>
        </div>
      </div>

      {/* Switch to provider */}
      <div className="px-5 mb-4">
        <button
          onClick={() => navigate("/provider")}
          className="w-full flex items-center gap-3 p-4 bg-booka-light rounded-2xl transition-all duration-200 active:scale-[0.98] slide-up"
        >
          <Briefcase size={20} className="text-primary" />
          <span className="text-sm font-semibold text-primary">Switch to Business Dashboard</span>
          <ChevronRight size={18} className="text-primary ml-auto" />
        </button>
      </div>

      <div className="px-5 space-y-1">
        {menuItems.map((item, i) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 hover:bg-secondary active:scale-[0.98] slide-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
          >
            <item.icon size={20} className="text-muted-foreground" />
            <span className="text-sm font-medium">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground ml-auto" />
          </button>
        ))}

        <button className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 hover:bg-destructive/5 active:scale-[0.98]">
          <LogOut size={20} className="text-destructive" />
          <span className="text-sm font-medium text-destructive">Log Out</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
