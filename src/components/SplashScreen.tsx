import { useEffect, useState } from "react";
import bookaLogo from "@/assets/booka-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 100);
    const t2 = setTimeout(() => setPhase("exit"), 2000);
    const t3 = setTimeout(onComplete, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 booka-gradient flex flex-col items-center justify-center">
      <div
        className="transition-all duration-700 ease-out"
        style={{
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transform: phase === "enter" ? "scale(0.8) translateY(20px)" : phase === "exit" ? "scale(1.1)" : "scale(1) translateY(0)",
        }}
      >
        <img src={bookaLogo} alt="Booka" className="w-48 h-48 object-contain drop-shadow-2xl" />
      </div>
      <div
        className="mt-6 flex gap-1.5 transition-opacity duration-500"
        style={{ opacity: phase === "exit" ? 0 : phase === "enter" ? 0 : 1 }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary-foreground/60"
            style={{
              animation: "float 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SplashScreen;
