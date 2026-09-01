import { useCallback, useEffect, useState } from "react";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { CapacityMeter } from "../components/CapacityMeter";
import { toast } from "sonner";
import { BarChart3, LogOut, Package, Timer, Boxes, CheckCircle2, Siren } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const COLORS = ["#FF5C39", "#10B981", "#F59E0B", "#64748B", "#1F2937"];
const statusLabels = { expected: "Expected", arrived: "Awaiting pickup", picked_up: "Picked up" };
const hoursSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [capInput, setCapInput] = useState("");
  const [agingInput, setAgingInput] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([api.get("/admin/stats"), api.get("/deliveries")]);
      setStats(s.data);
      setDeliveries(d.data);
    } catch (e) {
      /* silent poll */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const updateCapacity = async () => {
    const cap = parseInt(capInput, 10);
    if (!cap || cap < 1) return toast.error("Enter a valid capacity");
    try {
      await api.put("/admin/capacity", { capacity: cap });
      toast.success(`Delivery room capacity set to ${cap} slots`);
      setCapInput("");
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const updateAging = async () => {
    const hours = parseInt(agingInput, 10);
    if (!hours || hours < 1) return toast.error("Enter valid hours");
    try {
      await api.put("/admin/aging", { hours });
      toast.success(`Aging reminder threshold set to ${hours}h`);
      setAgingInput("");
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!stats)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-primary pulse-dot" />
      </div>
    );

  const statusData = Object.entries(stats.by_status).map(([k, v]) => ({ name: statusLabels[k] || k, value: v }));
  const typeData = Object.entries(stats.by_type).map(([k, v]) => ({ name: k, value: v }));

  const kpis = [
    { label: "Total deliveries", value: stats.total, icon: Package },
    { label: "Awaiting pickup", value: stats.by_status.arrived || 0, icon: Boxes },
    { label: "Picked up", value: stats.by_status.picked_up || 0, icon: CheckCircle2 },
    { label: "Avg pickup time", value: `${stats.avg_pickup_minutes} min`, icon: Timer },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-[hsl(210,18%,9%)] flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm leading-none">Delivery Ops · Admin</p>
              <p className="text-[11px] text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <Button data-testid="logout-button" variant="ghost" size="sm" onClick={logout} className="rounded-full">
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" data-testid="admin-dashboard">
        {stats.escalated?.length > 0 && (
          <div data-testid="escalation-panel" className="rounded-md border-2 border-red-500 bg-red-50 p-5 space-y-3 fade-up">
            <p className="font-heading font-bold text-red-700 flex items-center gap-2">
              <Siren className="h-4 w-4" /> Escalations — packages ignoring reminders ({stats.escalated.length})
            </p>
            <p className="text-xs text-red-600">These packages received 3+ automatic reminders and are still uncollected. Ops should contact the learner directly.</p>
            {stats.escalated.map((e) => (
              <div key={e.id} data-testid={`escalation-row-${e.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white border border-red-200 px-4 py-2.5">
                <div>
                  <p className="font-semibold text-sm">{e.learner_name}</p>
                  <p className="font-mono-tactical text-xs text-muted-foreground uppercase">
                    {e.courier} · {e.item_type}{e.slot ? ` · Slot ${e.slot}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{e.reminder_count} reminders sent</p>
                  <p className="text-xs text-muted-foreground">stored {hoursSince(e.arrived_at)}h</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <div key={k.label} data-testid={`kpi-${k.label.toLowerCase().replace(/ /g, "-")}`} className="rounded-md border bg-card p-5 hover:-translate-y-1 hover:shadow-lg transition-transform duration-200 fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <k.icon className="h-4 w-4 text-primary mb-3" />
              <p className="font-heading font-bold text-2xl sm:text-3xl">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-md border bg-card p-5 lg:col-span-2 space-y-4">
            <p className="font-heading font-bold text-sm">Deliveries — last 7 days</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.per_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(60,6%,88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#FF5C39" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-md border bg-card p-5 space-y-5">
            <CapacityMeter occupied={stats.occupied} capacity={stats.capacity} />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Update room capacity</p>
              <div className="flex gap-2">
                <Input
                  data-testid="capacity-input"
                  type="number"
                  placeholder={String(stats.capacity)}
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                />
                <Button data-testid="capacity-save-button" onClick={updateCapacity} className="rounded-full font-semibold hover:text-white transition-colors">
                  Save
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Aging reminder threshold (hours)</p>
              <div className="flex gap-2">
                <Input
                  data-testid="aging-input"
                  type="number"
                  placeholder={String(stats.aging_hours)}
                  value={agingInput}
                  onChange={(e) => setAgingInput(e.target.value)}
                />
                <Button data-testid="aging-save-button" onClick={updateAging} className="rounded-full font-semibold hover:text-white transition-colors">
                  Save
                </Button>
              </div>
              {stats.aging_count > 0 && (
                <p data-testid="admin-aging-alert" className="text-xs font-semibold text-amber-600">
                  {stats.aging_count} package{stats.aging_count > 1 ? "s" : ""} stored &gt;{stats.aging_hours}h — auto-reminders active
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-md border bg-card p-5 space-y-3">
            <p className="font-heading font-bold text-sm">By status</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-md border bg-card p-5 space-y-3">
            <p className="font-heading font-bold text-sm">By item type</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={70} label={(e) => e.name}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <p className="font-heading font-bold text-sm p-5 pb-3">All deliveries</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="deliveries-table">
              <thead>
                <tr className="border-t border-b bg-secondary/50 text-left">
                  <th className="px-5 py-2.5 font-mono-tactical text-[11px] uppercase text-muted-foreground">Learner</th>
                  <th className="px-5 py-2.5 font-mono-tactical text-[11px] uppercase text-muted-foreground">Courier</th>
                  <th className="px-5 py-2.5 font-mono-tactical text-[11px] uppercase text-muted-foreground">Type</th>
                  <th className="px-5 py-2.5 font-mono-tactical text-[11px] uppercase text-muted-foreground">Storage</th>
                  <th className="px-5 py-2.5 font-mono-tactical text-[11px] uppercase text-muted-foreground">Status</th>
                  <th className="px-5 py-2.5 font-mono-tactical text-[11px] uppercase text-muted-foreground">Registered</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.slice(0, 30).map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{d.learner_name}</td>
                    <td className="px-5 py-3">{d.courier}</td>
                    <td className="px-5 py-3 capitalize">{d.item_type}</td>
                    <td className="px-5 py-3">{d.slot ? `Slot ${d.slot}` : d.storage === "counter" ? "Counter" : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={d.status === "picked_up" ? "secondary" : "default"} className={d.status === "arrived" ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                        {statusLabels[d.status] || d.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-mono-tactical text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
