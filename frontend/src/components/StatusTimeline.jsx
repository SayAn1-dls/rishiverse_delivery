import { CheckCircle2, Circle } from "lucide-react";

export const StatusTimeline = ({ delivery }) => {
  const steps = [
    { label: "Registered", done: true, time: delivery.created_at },
    { label: "Arrived at Gate 2", done: !!delivery.arrived_at, time: delivery.arrived_at },
    {
      label:
        delivery.storage === "counter"
          ? "At counter — collect now"
          : delivery.slot
          ? `Stored · Slot ${delivery.slot}`
          : "Awaiting storage",
      done: !!delivery.arrived_at,
      time: delivery.arrived_at,
    },
    { label: "Picked up", done: !!delivery.picked_up_at, time: delivery.picked_up_at },
  ];

  return (
    <div data-testid="tracking-timeline" className="space-y-0">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            {i < steps.length - 1 && (
              <div className={`w-px flex-1 min-h-[16px] ${s.done ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
          <div className="pb-4">
            <p className={`text-sm font-medium leading-none ${s.done ? "" : "text-muted-foreground"}`}>{s.label}</p>
            {s.time && s.done && (
              <p className="font-mono-tactical text-[10px] text-muted-foreground mt-1">
                {new Date(s.time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
