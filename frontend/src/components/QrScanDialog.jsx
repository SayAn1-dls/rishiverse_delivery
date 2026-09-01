import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ScanLine } from "lucide-react";

export const QrScanDialog = ({ open, onOpenChange, onCode }) => {
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef(null);
  const firedRef = useRef(false);

  const fire = (text) => {
    if (firedRef.current) return;
    firedRef.current = true;
    Promise.resolve(onCode(text)).finally(() => {
      firedRef.current = false;
    });
  };

  useEffect(() => {
    if (!open) return;
    setCameraError("");
    setManual("");
    firedRef.current = false;
    const timer = setTimeout(() => {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      scanner
        .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, fire, () => {})
        .catch(() =>
          setCameraError("Camera unavailable here — type or paste the code shown under the learner's QR instead.")
        );
    }, 300);
    return () => {
      clearTimeout(timer);
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="qr-scan-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" /> Scan pickup QR
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div id="qr-reader" data-testid="qr-reader-view" className="rounded-lg overflow-hidden bg-black/90 min-h-[200px]" />
          {cameraError && <p className="text-xs text-amber-600">{cameraError}</p>}
          <p className="text-xs text-muted-foreground">Point the camera at the QR on the learner's phone, or enter the code manually:</p>
          <div className="flex gap-2">
            <Input
              data-testid="qr-manual-input"
              placeholder="GATEFLOW:..."
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="font-mono-tactical text-xs"
            />
            <Button
              data-testid="qr-manual-submit"
              disabled={!manual.trim()}
              onClick={() => fire(manual.trim())}
              className="rounded-full font-semibold hover:text-white transition-colors"
            >
              Verify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
