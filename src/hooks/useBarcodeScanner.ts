import { useEffect, useRef, useCallback } from "react";

interface UseBarcodeScannerOptions {
  onScan: (barcode: string, quantity?: number) => void;
  minChars?: number;
  maxKeyInterval?: number; // max ms between keystrokes for hardware scanner (default 50ms)
  disabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minChars = 3,
  maxKeyInterval = 60,
  disabled = false,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  // Store onScan in ref to keep a stable event listener and avoid re-binding on every render
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const processBarcode = useCallback(
    (code: string, qty: number = 1) => {
      const trimmed = code.trim();
      if (trimmed.length >= minChars) {
        onScanRef.current(trimmed, qty);
      }
    },
    [minChars],
  );

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a modal textarea or active input
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        !target.classList.contains("scanner-friendly")
      ) {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Handle Enter (termination character sent by 99% of barcode scanners)
      if (e.key === "Enter") {
        // Clear pending timeout to prevent race condition with next scan
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (bufferRef.current.length >= minChars) {
          e.preventDefault();
          const finalCode = bufferRef.current;
          bufferRef.current = "";
          processBarcode(finalCode, 1);
        }
        return;
      }

      // Ignore single modifier keys
      if (e.key.length > 1 && e.key !== "Backspace") {
        return;
      }

      // If too much time passed between characters, reset buffer (unless it was empty)
      if (elapsed > maxKeyInterval && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // Append printable character
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Auto-clear buffer if no Enter is pressed within 300ms
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          // If scanner does not send Enter, but sent at least 6 fast characters, process it
          if (bufferRef.current.length >= 6) {
            processBarcode(bufferRef.current, 1);
          }
          bufferRef.current = "";
          timeoutRef.current = null;
        }, 250);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [disabled, maxKeyInterval, minChars, processBarcode]);

  // Programmatic simulation method (for UI tester buttons)
  const triggerManualScan = useCallback(
    (code: string, quantity: number = 1) => {
      processBarcode(code, quantity);
    },
    [processBarcode],
  );

  return { triggerManualScan };
}
