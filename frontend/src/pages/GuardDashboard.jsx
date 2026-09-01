import { useCallback, useEffect, useState } from "react";
import api, { apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { CapacityMeter } from "../components/CapacityMeter";
import { QrScanDialog } from "../components/QrScanDialog";
import { photoUrl } from "../lib/api";
import { toast } from "sonner";
import { ShieldCheck, LogOut, PackagePlus, KeyRound, Clock, Inbox, ScanLine, Camera, AlarmClock, ClipboardList } from "lucide-react";

export default function GuardDashboard() {
  const { user, logout } = useAuth();
  const [expected, setExpected] = useState([]);
  const [awaiting, setAwaiting] = useState([]);
  const [room, setRoom] = useState({ capacity: 0, occupied: 0 });
  const [learners, setLearners] = useState([]);

  const [arriveTarget, setArriveTarget] = useState(null);
  const [storage, setStorage] = useState("room");
  const [pickupTarget, setPickupTarget] = useState(null);
  const [otpInput, setOtpInput] = useState("");
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [arrivePhoto, setArrivePhoto] = useState(null);
  const [walkinPhoto, setWalkinPhoto] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState(null);

  const openSummary = async () => {
    try {
      const { data } = await api.get("/guard/shift-summary");
      setSummary(data);
      setSummaryOpen(true);
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const [walkin, setWalkin] = useState({ learner_id: "", courier: "", tracking_id: "", item_type: "parcel", storage: "room" });

  const refresh = useCallback(async () => {
    try {
      const [e, a, r, l] = await Promise.all([
        api.get("/deliveries?status=expected"),
        api.get("/deliveries?status=arrived"),
        api.get("/room/status"),
        api.get("/users/learners"),
      ]);
      setExpected(e.data);
      setAwaiting(a.data);
      setRoom(r.data);
      setLearners(l.data);
    } catch (e) {
      /* silent poll */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const openArrive = (d) => {
    setArriveTarget(d);
    setArrivePhoto(null);
    setStorage(d.item_type === "food" ? "counter" : "room");
  };

  const uploadPhoto = async (deliveryId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post(`/deliveries/${deliveryId}/photo`, fd).catch(() => toast.warning("Photo upload failed — package logged without photo"));
  };

  const confirmArrive = async () => {
    try {
      const { data } = await api.post(`/deliveries/${arriveTarget.id}/arrive`, { storage });
      if (arrivePhoto) await uploadPhoto(arriveTarget.id, arrivePhoto);
      toast.success(
        storage === "room"
          ? `Logged! Stored in Slot ${data.slot}. Learner notified on WhatsApp.`
          : "Logged as collect-immediately. Learner notified on WhatsApp."
      );
      setArriveTarget(null);
      setArrivePhoto(null);
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const confirmPickup = async () => {
    try {
      await api.post(`/deliveries/${pickupTarget.id}/pickup`, { otp: otpInput });
      toast.success("OTP verified — package handed over!");
      setPickupTarget(null);
      setOtpInput("");
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const submitWalkin = async () => {
    if (!walkin.learner_id || !walkin.courier) return toast.error("Select learner and courier");
    try {
      const { data } = await api.post("/deliveries/walkin", walkin);
      if (walkinPhoto) await uploadPhoto(data.id, walkinPhoto);
      toast.success(data.slot ? `Walk-in logged — Slot ${data.slot}. Learner notified.` : "Walk-in logged as collect-immediately. Learner notified.");
      setWalkinOpen(false);
      setWalkinPhoto(null);
      setWalkin({ learner_id: "", courier: "", tracking_id: "", item_type: "parcel", storage: "room" });
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const handleScan = useCallback(async (code) => {
    try {
      const { data } = await api.post("/deliveries/pickup/scan", { code });
      toast.success(`Verified — ${data.learner_name}'s ${data.item_type} handed over!`);
      setScanOpen(false);
      refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [refresh]);

  const urgent = awaiting.filter((d) => d.storage === "counter");
  const stored = awaiting.filter((d) => d.storage === "room");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[hsl(210,18%,9%)] flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm leading-none">Gate No. 2 · Guard Console</p>
              <p className="text-[11px] text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="shift-summary-button" variant="outline" size="sm" onClick={openSummary} className="rounded-full">
              <ClipboardList className="h-4 w-4 mr-1" /> Shift Summary
            </Button>
            <Button data-testid="logout-button" variant="ghost" size="sm" onClick={logout} className="rounded-full">
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-md border-2 border-[hsl(210,18%,9%)] bg-card p-5 md:col-span-2 space-y-3">
            <CapacityMeter occupied={room.occupied} capacity={room.capacity} />
            {room.aging_count > 0 && (
              <p data-testid="aging-alert" className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                <AlarmClock className="h-3.5 w-3.5" /> {room.aging_count} package{room.aging_count > 1 ? "s" : ""} stored &gt;{room.aging_hours}h — learners are being reminded automatically
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              data-testid="scan-qr-button"
              onClick={() => setScanOpen(true)}
              className="flex-1 min-h-[36px] rounded-md text-base font-bold hover:text-white transition-colors"
            >
              <ScanLine className="h-5 w-5 mr-2" /> Scan Pickup QR
            </Button>
            <Dialog open={walkinOpen} onOpenChange={setWalkinOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="log-walkin-button" className="flex-1 min-h-[36px] rounded-md text-base font-bold border-2 border-[hsl(210,18%,9%)] transition-colors">
                  <PackagePlus className="h-5 w-5 mr-2" /> Log Walk-in Package
                </Button>
              </DialogTrigger>
            <DialogContent data-testid="walkin-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading">Log unexpected package</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Learner</Label>
                  <Select value={walkin.learner_id} onValueChange={(v) => setWalkin({ ...walkin, learner_id: v })}>
                    <SelectTrigger data-testid="walkin-learner-select"><SelectValue placeholder="Search learner" /></SelectTrigger>
                    <SelectContent>
                      {learners.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name} · {l.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Courier</Label>
                    <Input data-testid="walkin-courier-input" placeholder="e.g. Amazon" value={walkin.courier} onChange={(e) => setWalkin({ ...walkin, courier: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={walkin.item_type} onValueChange={(v) => setWalkin({ ...walkin, item_type: v, storage: v === "food" ? "counter" : walkin.storage })}>
                      <SelectTrigger data-testid="walkin-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["parcel", "food", "document", "fragile"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <StorageChoice value={walkin.storage} onChange={(v) => setWalkin({ ...walkin, storage: v })} room={room} />
                <PhotoPicker file={walkinPhoto} onFile={setWalkinPhoto} testId="walkin-photo-input" />
                <Button data-testid="walkin-submit-button" onClick={submitWalkin} className="w-full rounded-full font-semibold hover:text-white transition-colors">
                  Log & Notify Learner
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {urgent.length > 0 && (
          <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 space-y-3">
            <p className="font-heading font-bold text-red-700 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Collect-immediately queue ({urgent.length})
            </p>
            {urgent.map((d) => (
              <DeliveryRow key={d.id} d={d} onPickup={() => setPickupTarget(d)} urgent agingHours={room.aging_hours} />
            ))}
          </div>
        )}

        <Tabs defaultValue="expected">
          <TabsList className="rounded-full h-11">
            <TabsTrigger data-testid="tab-expected" value="expected" className="rounded-full px-6">
              Expected ({expected.length})
            </TabsTrigger>
            <TabsTrigger data-testid="tab-awaiting" value="awaiting" className="rounded-full px-6">
              In Delivery Room ({stored.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expected" className="mt-4 space-y-3">
            {expected.length === 0 && <Empty text="No expected deliveries right now." />}
            {expected.map((d, i) => (
              <div key={d.id} data-testid={`expected-row-${d.id}`} className="rounded-md border bg-card p-4 flex flex-wrap items-center justify-between gap-3 fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div>
                  <p className="font-semibold text-sm">{d.learner_name}</p>
                  <p className="font-mono-tactical text-xs text-muted-foreground uppercase">
                    {d.courier} · {d.item_type}{d.tracking_id ? ` · ${d.tracking_id}` : ""}
                  </p>
                  {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
                </div>
                <Button data-testid={`mark-arrived-${d.id}`} size="sm" onClick={() => openArrive(d)} className="rounded-full font-semibold hover:text-white transition-colors">
                  Mark Arrived
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="awaiting" className="mt-4 space-y-3">
            {stored.length === 0 && <Empty text="Delivery room is empty." />}
            {stored.map((d) => (
              <DeliveryRow key={d.id} d={d} onPickup={() => setPickupTarget(d)} agingHours={room.aging_hours} />
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!arriveTarget} onOpenChange={(v) => !v && setArriveTarget(null)}>
        <DialogContent data-testid="arrive-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Log arrival — {arriveTarget?.courier} for {arriveTarget?.learner_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {arriveTarget?.item_type === "food" && (
              <p className="text-sm text-red-600 font-medium">Food/perishable — collect-immediately recommended.</p>
            )}
            <StorageChoice value={storage} onChange={setStorage} room={room} />
            <PhotoPicker file={arrivePhoto} onFile={setArrivePhoto} testId="arrive-photo-input" />
            <Button data-testid="confirm-arrive-button" onClick={confirmArrive} className="w-full rounded-full font-semibold hover:text-white transition-colors">
              Confirm Arrival & Notify
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pickupTarget} onOpenChange={(v) => { if (!v) { setPickupTarget(null); setOtpInput(""); } }}>
        <DialogContent data-testid="pickup-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Verify pickup — {pickupTarget?.learner_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask the learner for the 6-digit code from their WhatsApp message.
            </p>
            <Input
              data-testid="pickup-otp-input"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="font-mono-tactical text-2xl tracking-[0.3em] text-center h-14"
            />
            <Button
              data-testid="confirm-pickup-button"
              onClick={confirmPickup}
              disabled={otpInput.length !== 6}
              className="w-full rounded-full font-semibold hover:text-white transition-colors"
            >
              Verify & Hand Over
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <QrScanDialog open={scanOpen} onOpenChange={setScanOpen} onCode={handleScan} />

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent data-testid="shift-summary-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Shift summary —{" "}
              {summary && new Date(summary.date).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
            </DialogTitle>
          </DialogHeader>
          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border p-3">
                  <p data-testid="summary-received" className="font-heading font-bold text-2xl">{summary.received}</p>
                  <p className="text-xs text-muted-foreground">Received today</p>
                  {summary.walk_ins > 0 && <p className="text-[10px] text-muted-foreground">incl. {summary.walk_ins} walk-in</p>}
                </div>
                <div className="rounded-md border p-3">
                  <p data-testid="summary-handed-over" className="font-heading font-bold text-2xl text-emerald-600">{summary.handed_over}</p>
                  <p className="text-xs text-muted-foreground">Handed over</p>
                </div>
                <div className="rounded-md border p-3">
                  <p data-testid="summary-waiting" className="font-heading font-bold text-2xl text-amber-600">{summary.waiting}</p>
                  <p className="text-xs text-muted-foreground">Still waiting</p>
                </div>
              </div>
              <div className="rounded-md bg-secondary/60 p-3 text-sm space-y-1">
                <p>In delivery room: <strong>{summary.waiting_room}</strong> · At counter: <strong>{summary.waiting_counter}</strong></p>
                <p>Avg pickup time today: <strong>{summary.avg_pickup_minutes} min</strong></p>
              </div>
              {summary.waiting_list.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono-tactical text-xs uppercase tracking-wider text-muted-foreground">Still waiting</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {summary.waiting_list.map((w) => (
                      <p key={w.id} className="text-sm">
                        {w.learner_name} — {w.courier} · {w.item_type} {w.slot ? `(Slot ${w.slot})` : "(Counter)"}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const StorageChoice = ({ value, onChange, room }) => (
  <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 gap-3">
    <label className={`rounded-md border-2 p-3 cursor-pointer transition-colors ${value === "room" ? "border-primary bg-primary/5" : "border-border"}`}>
      <RadioGroupItem value="room" className="sr-only" data-testid="storage-room-option" />
      <p className="font-semibold text-sm">Delivery Room</p>
      <p className="text-xs text-muted-foreground">{room.capacity - room.occupied} slots free</p>
    </label>
    <label className={`rounded-md border-2 p-3 cursor-pointer transition-colors ${value === "counter" ? "border-red-500 bg-red-50" : "border-border"}`}>
      <RadioGroupItem value="counter" className="sr-only" data-testid="storage-counter-option" />
      <p className="font-semibold text-sm">Collect Immediately</p>
      <p className="text-xs text-muted-foreground">Food / no storage</p>
    </label>
  </RadioGroup>
);

const PhotoPicker = ({ file, onFile, testId }) => (
  <div className="space-y-2">
    <Label>Package photo (optional)</Label>
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-4 py-2 text-sm font-medium cursor-pointer hover:border-primary transition-colors">
        <Camera className="h-4 w-4 text-primary" />
        {file ? "Retake photo" : "Snap photo"}
        <input data-testid={testId} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </label>
      {file && <img data-testid={`${testId}-preview`} src={URL.createObjectURL(file)} alt="preview" className="h-12 w-12 rounded-md object-cover border" />}
    </div>
  </div>
);

const hoursSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);

const DeliveryRow = ({ d, onPickup, urgent, agingHours }) => {
  const hrs = d.arrived_at ? hoursSince(d.arrived_at) : 0;
  const aging = !urgent && agingHours && d.storage === "room" && hrs >= agingHours;
  return (
    <div data-testid={`awaiting-row-${d.id}`} className={`rounded-md border bg-card p-4 flex flex-wrap items-center justify-between gap-3 ${urgent ? "border-red-300" : aging ? "border-2 border-amber-400 bg-amber-50" : ""}`}>
      <div className="flex items-center gap-3">
        {d.photo_path && <img data-testid={`package-photo-thumb-${d.id}`} src={photoUrl(d.id)} alt="package" className="h-12 w-12 rounded-md object-cover border" />}
        <div>
          <p className="font-semibold text-sm">{d.learner_name}</p>
          <p className="font-mono-tactical text-xs text-muted-foreground uppercase">
            {d.courier} · {d.item_type}{d.slot ? ` · Slot ${d.slot}` : " · Counter"} · {hrs}h stored
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {aging && (
          <Badge data-testid={`aging-badge-${d.id}`} className="bg-amber-500 hover:bg-amber-500 text-white">
            <AlarmClock className="h-3 w-3 mr-1" /> Aging
          </Badge>
        )}
        {d.walk_in && <Badge variant="outline">Walk-in</Badge>}
        <Button data-testid={`verify-pickup-${d.id}`} size="sm" variant={urgent ? "destructive" : "default"} onClick={onPickup} className="rounded-full font-semibold hover:text-white transition-colors">
          Verify Pickup
        </Button>
      </div>
    </div>
  );
};

const Empty = ({ text }) => (
  <div className="text-center py-10 space-y-2">
    <Inbox className="h-8 w-8 mx-auto text-muted-foreground/40" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);
