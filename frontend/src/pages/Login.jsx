import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Package, ShieldCheck, GraduationCap, BarChart3 } from "lucide-react";

const roleHome = { learner: "/learner", guard: "/guard", admin: "/admin" };

const demos = [
  { label: "Learner", icon: GraduationCap, email: "aarav@rishihood.edu.in", password: "learner123" },
  { label: "Gate Guard", icon: ShieldCheck, email: "guard@rishihood.edu.in", password: "guard123" },
  { label: "Ops Admin", icon: BarChart3, email: "admin@rishihood.edu.in", password: "admin123" },
];

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (em, pw) => {
    setError("");
    setLoading(true);
    try {
      const user = await login(em, pw);
      navigate(roleHome[user.role]);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const doSignup = async () => {
    setError("");
    setLoading(true);
    try {
      await register({ name, email, password, phone });
      navigate("/learner");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[hsl(220,17%,7%)] text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1577705998148-6da4f3963bc8?w=1200&q=60)" }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">GateFlow · Rishihood</span>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="font-heading font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
            Deliveries at Gate&nbsp;2,<br />
            <span className="text-primary">without the wait.</span>
          </h1>
          <p className="text-white/70 max-w-md text-base">
            Register expected packages, get WhatsApp-style pings the moment they arrive, and collect with a single OTP. Effortless for learners, simple for security.
          </p>
        </div>
        <p className="relative z-10 font-mono-tactical text-xs text-white/40 uppercase">Gate No. 2 · Delivery Ops · Rishihood University</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-10 fade-up">
          <div className="space-y-2">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="font-heading font-bold">GateFlow · Rishihood</span>
            </div>
            <h2 className="font-heading font-bold tracking-tight text-2xl sm:text-3xl">
              {mode === "signup" ? "Create your account" : "Sign in"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "signup"
                ? "Sign up as a learner to track your Gate 2 deliveries."
                : "Use your campus account or a quick demo login below."}
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "signup") doSignup();
              else doLogin(email, password);
            }}
          >
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    data-testid="signup-name-input"
                    required
                    placeholder="Aarav Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (for WhatsApp updates)</Label>
                  <Input
                    id="phone"
                    data-testid="signup-phone-input"
                    placeholder="+91 98xxx xxx00"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                required
                placeholder="you@rishihood.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p data-testid="login-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-full h-11 font-semibold hover:text-white transition-colors"
            >
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              {mode === "signup" ? "Already have an account?" : "New learner on campus?"}{" "}
              <button
                type="button"
                data-testid="toggle-auth-mode"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signup" ? "Sign in" : "Create account"}
              </button>
            </p>
          </form>

          <div className="space-y-3">
            <p className="font-mono-tactical text-xs uppercase text-muted-foreground tracking-wider">Quick demo access</p>
            <div className="grid grid-cols-3 gap-3">
              {demos.map((d) => (
                <button
                  key={d.label}
                  data-testid={`demo-login-${d.label.toLowerCase().replace(" ", "-")}`}
                  onClick={() => doLogin(d.email, d.password)}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 hover:border-primary hover:-translate-y-0.5 transition-transform duration-200"
                >
                  <d.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
