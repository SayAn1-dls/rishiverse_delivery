export const CapacityMeter = ({ occupied, capacity }) => {
  const pct = capacity ? Math.round((occupied / capacity) * 100) : 0;
  const color = pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div data-testid="capacity-meter" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono-tactical text-xs uppercase tracking-wider text-muted-foreground">Delivery Room</span>
        <span className="font-mono-tactical text-sm font-semibold">
          {occupied} / {capacity} slots full
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-transform duration-500 origin-left`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};
