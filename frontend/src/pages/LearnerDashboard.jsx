import { useCallback, useEffect, useState } from "react";
import api, { apiError, photoUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { StatusTimeline } from "../components/StatusTimeline";
import { WhatsAppDrawer } from "../components/WhatsAppDrawer";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Package, LogOut, Trash2, KeyRound, AlertTriangle } from "lucide-react";

const couriers = ["Amazon", "Flipkart", "Zomato", "Swiggy", "BlueDart", "Delhivery", "Myntra", "Other"];
const types = [
  { value: "parcel", label: "Parcel" },
  { value: "food", label: "Food / Perishable" },
  { value: "document", label: "Document" },
  { value: "fragile", label: "Fragile" },
];

const statusBadge = (d) => {
  if (d.status === "picked_up") return <Badge variant="secondary" data-testid="status-badge">Picked up</Badge>;
  if (d.status === "arrived" && d.storage === "counter")
    return <Badge className="bg-red-500 hover:bg-red-500 text-white" data-testid="status-badge">Collect now</Badge>;
  if (d.status === "arrived")
    return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white" data-testid="status-badge">Ready for pickup</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500 text-white" data-testid="status-badge">Expected</Badge>;
};

export default function LearnerDashboard() {
  const { user, logout } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({ courier: "", tracking_id: "", item_type: "parcel", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState("deliveries");
  const [waLive, setWaLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, n] = await Promise.all([api.get("/deliveries"), api.get("/notifications")]);
      setDeliveries(d.data);
      setNotifications(n.data);
    } catch (e) {
      /* silent poll */
    }
  }, []);

  useEffect(() => {
    refresh();
    api.get("/whatsapp/status").then(({ data }) => setWaLive(data.configured)).catch(() => {});
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.courier) return toast.error("Pick a courier");
    setSubmitting(true);
    try {
      await api.post("/deliveries", form);
      toast.success("Delivery registered! We'll ping you when it arrives at Gate 2.");
      setForm({ courier: "", tracking_id: "", item_type: "parcel", description: "" });
      setTab("deliveries");
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/deliveries/${id}`);
      toast.success("Expected delivery removed");
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const markRead = async () => {
    await api.post("/notifications/read").catch(() => {});
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  };

  const unread = notifications.filter((n) => !n.read).length;
  const active = deliveries.filter((d) => d.status !== "picked_up");
  const past = deliveries.filter((d) => d.status === "picked_up");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm leading-none">GateFlow</p>
              <p className="text-[11px] text-muted-foreground">Hi, {user.name.split(" ")[0]}</p>
            </div>
          </div>
          <Button data-testid="logout-button" variant="ghost" size="sm" onClick={logout} className="rounded-full">
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-6 pb-28">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full rounded-full h-11">
            <TabsTrigger data-testid="tab-my-deliveries" value="deliveries" className="rounded-full">My Deliveries</TabsTrigger>
            <TabsTrigger data-testid="tab-register" value="register" className="rounded-full">Register Expected</TabsTrigger>
          </TabsList>

          <TabsContent value="deliveries" className="mt-6 space-y-4">
            {active.length === 0 && past.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">No deliveries yet. Register one you're expecting!</p>
              </div>
            )}
            {active.map((d, i) => (
              <div
                key={d.id}
                data-testid={`delivery-card-${d.id}`}
                className="rounded-2xl border bg-card p-5 space-y-4 fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-bold">{d.courier}</p>
                    <p className="font-mono-tactical text-xs text-muted-foreground uppercase">
                      {d.item_type}{d.tracking_id ? ` · ${d.tracking_id}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(d)}
                    {d.status === "expected" && (
                      <button data-testid={`delete-delivery-${d.id}`} onClick={() => remove(d.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {d.status === "arrived" && d.storage === "counter" && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    This can't be stored — please collect it from the Gate 2 counter now.
                  </div>
                )}

                {d.photo_path && (
                  <img
                    data-testid={`package-photo-${d.id}`}
                    src={photoUrl(d.id)}
                    alt="Your package at Gate 2"
                    className="w-full max-h-52 object-cover rounded-xl border"
                  />
                )}

                {d.status === "arrived" && (
                  <div className="rounded-2xl bg-[hsl(210,18%,9%)] text-white p-5 text-center otp-reveal">
                    <p className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-widest text-white/60 mb-2">
                      <KeyRound className="h-3 w-3" /> Pickup code — show at Gate 2
                    </p>
                    <p data-testid="otp-code" className="font-mono-tactical text-5xl font-bold tracking-[0.2em] text-primary">
                      {d.otp}
                    </p>
                    <div className="mt-4 flex justify-center">
                      <div data-testid="pickup-qr-code" className="bg-white rounded-xl p-3">
                        <QRCodeSVG value={`GATEFLOW:${d.id}:${d.otp}`} size={128} />
                      </div>
                    </div>
                    <p className="text-[11px] text-white/50 mt-3">Flash the QR for an instant scan — or read out the code</p>
                    {d.slot && <p className="font-mono-tactical text-xs text-white/50 mt-2 uppercase">Delivery Room · Slot {d.slot}</p>}
                  </div>
                )}

                <StatusTimeline delivery={d} />
              </div>
            ))}

            {past.length > 0 && (
              <>
                <p className="font-mono-tactical text-xs uppercase tracking-wider text-muted-foreground pt-4">History</p>
                {past.map((d) => (
                  <div key={d.id} className="rounded-2xl border bg-card/60 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{d.courier} <span className="text-muted-foreground">· {d.item_type}</span></p>
                      <p className="font-mono-tactical text-[11px] text-muted-foreground">
                        Picked up {new Date(d.picked_up_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {statusBadge(d)}
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="register" className="mt-6">
            <form onSubmit={submit} className="rounded-2xl border bg-card p-6 space-y-5 fade-up">
              <div className="space-y-2">
                <Label>Courier / Source</Label>
                <Select value={form.courier} onValueChange={(v) => setForm({ ...form, courier: v })}>
                  <SelectTrigger data-testid="register-courier-select">
                    <SelectValue placeholder="Who's delivering?" />
                  </SelectTrigger>
                  <SelectContent>
                    {couriers.map((c) => (
                      <SelectItem key={c} value={c} data-testid={`courier-option-${c.toLowerCase()}`}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Item type</Label>
                <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger data-testid="register-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.value} value={t.value} data-testid={`type-option-${t.value}`}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.item_type === "food" && (
                  <p className="text-xs text-amber-600">Food can't be stored — you'll be asked to collect it immediately on arrival.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking">Tracking ID (optional)</Label>
                <Input
                  id="tracking"
                  data-testid="register-tracking-input"
                  placeholder="e.g. TRK123456"
                  value={form.tracking_id}
                  onChange={(e) => setForm({ ...form, tracking_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Notes (optional)</Label>
                <Input
                  id="desc"
                  data-testid="register-description-input"
                  placeholder="e.g. Blue package, handle with care"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <Button
                data-testid="register-delivery-submit"
                type="submit"
                disabled={submitting}
                className="w-full rounded-full h-11 font-semibold hover:text-white transition-colors"
              >
                {submitting ? "Registering..." : "Register Delivery"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </main>

      <WhatsAppDrawer notifications={notifications} unread={unread} onOpen={markRead} live={waLive} />
    </div>
  );
}
