import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "./ui/sheet";
import { MessageCircle, CheckCheck, Package } from "lucide-react";

export const WhatsAppDrawer = ({ notifications, unread, onOpen, live }) => {
  const [open, setOpen] = useState(false);

  const renderMsg = (text) =>
    text.split(/(\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("*") && part.endsWith("*") ? (
        <strong key={i}>{part.slice(1, -1)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) onOpen();
      }}
    >
      <SheetTrigger asChild>
        <button
          data-testid="whatsapp-drawer-button"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform duration-200"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span
              data-testid="whatsapp-unread-badge"
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center"
            >
              {unread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-[#EFEAE2]">
        <SheetTitle className="sr-only">WhatsApp notifications</SheetTitle>
        <div className="bg-[#075E54] text-white px-5 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">GateFlow · Gate 2 Deliveries</p>
            <p className="text-xs text-white/70">{live ? "WhatsApp Business · live via Twilio" : "WhatsApp Business (simulated)"}</p>
          </div>
        </div>
        <div data-testid="whatsapp-message-list" className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-10">
              No messages yet. Register a delivery to get updates here.
            </p>
          )}
          {notifications.map((n) => (
            <div key={n.id} className="flex justify-start fade-up">
              <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderMsg(n.message)}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
