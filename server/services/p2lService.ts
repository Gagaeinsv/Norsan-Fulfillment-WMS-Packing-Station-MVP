/**
 * Pick-to-Light Service — server/services/p2lService.ts
 *
 * Controls WS2812B LED strips via ESP32-WROOM-32 controller over HTTP.
 * Has mandatory offline/fallback mode: if the controller is unreachable,
 * the system works in mock mode without throwing errors.
 *
 * LED color conventions:
 *   GREEN  (#00FF00) → item needed, open order
 *   BLINK  (RED, 2×)→ wrong scan (error feedback)
 *   OFF             → item scanned / order complete
 */

import http from 'http';

// ─── Configuration ───────────────────────────────────────────────────────────
const ESP32_IP   = process.env.ESP32_IP   || '192.168.1.200'; // Default local IP
const ESP32_PORT = parseInt(process.env.ESP32_PORT || '80', 10);
const TIMEOUT_MS = parseInt(process.env.P2L_TIMEOUT_MS || '800', 10); // Fast fail

type LedColor = 'green' | 'red' | 'yellow' | 'off';

interface P2LCommand {
  tier: 'A' | 'B' | 'C' | 'D';
  ledIndex: number;
  color: LedColor;
  blink?: boolean;   // true = blink 2× then hold color (or off)
  blinkCount?: number;
}

// ─── Connectivity State ───────────────────────────────────────────────────────
let isControllerOnline = false;
let lastPingAttempt = 0;
const PING_INTERVAL_MS = 10_000; // Re-check controller every 10 s

async function checkControllerOnline(): Promise<boolean> {
  const now = Date.now();
  if (now - lastPingAttempt < PING_INTERVAL_MS) {
    return isControllerOnline;
  }
  lastPingAttempt = now;

  return new Promise(resolve => {
    const req = http.get(
      { hostname: ESP32_IP, port: ESP32_PORT, path: '/ping', timeout: TIMEOUT_MS },
      res => {
        isControllerOnline = res.statusCode === 200;
        resolve(isControllerOnline);
      }
    );
    req.on('timeout', () => { req.destroy(); isControllerOnline = false; resolve(false); });
    req.on('error', ()  => { isControllerOnline = false; resolve(false); });
  });
}

// ─── Core Send ────────────────────────────────────────────────────────────────
async function sendCommand(cmd: P2LCommand): Promise<{ sent: boolean; mock: boolean }> {
  const online = await checkControllerOnline();

  if (!online) {
    // OFFLINE MODE: log only, no error thrown
    console.log(`[P2L] MOCK (controller offline) → tier=${cmd.tier} led=${cmd.ledIndex} color=${cmd.color} blink=${cmd.blink}`);
    return { sent: false, mock: true };
  }

  const body = JSON.stringify(cmd);

  return new Promise(resolve => {
    const req = http.request(
      {
        hostname: ESP32_IP,
        port: ESP32_PORT,
        path: '/led',
        method: 'POST',
        timeout: TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`[P2L] Controller returned HTTP ${res.statusCode}: ${data}`);
          }
          resolve({ sent: res.statusCode === 200, mock: false });
        });
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ sent: false, mock: true }); });
    req.on('error', (e) => {
      console.error('[P2L] Send error:', e.message);
      isControllerOnline = false;
      resolve({ sent: false, mock: true });
    });
    req.write(body);
    req.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Light up all LEDs for items in the current order (GREEN).
 * Called when an order is opened on the packing station.
 */
export async function lightOrderItems(
  items: Array<{ tier?: 'A' | 'B' | 'C' | 'D'; ledIndex?: number }>
): Promise<void> {
  const cmds = items
    .filter(i => i.tier && i.ledIndex != null)
    .map(i => sendCommand({ tier: i.tier!, ledIndex: i.ledIndex!, color: 'green' }));

  await Promise.allSettled(cmds);
}

/**
 * Mark item as scanned: blink GREEN twice then turn off.
 */
export async function markItemScanned(tier: 'A' | 'B' | 'C' | 'D', ledIndex: number): Promise<void> {
  await sendCommand({ tier, ledIndex, color: 'off', blink: true, blinkCount: 2 });
}

/**
 * Error feedback: blink RED twice on the correct item LED.
 * Called when operator scanned the wrong barcode.
 */
export async function blinkError(tier: 'A' | 'B' | 'C' | 'D', ledIndex: number): Promise<void> {
  await sendCommand({ tier, ledIndex, color: 'red', blink: true, blinkCount: 2 });
}

/**
 * Turn off all active LEDs when order is completed.
 */
export async function clearAllLeds(
  items: Array<{ tier?: 'A' | 'B' | 'C' | 'D'; ledIndex?: number }>
): Promise<void> {
  const cmds = items
    .filter(i => i.tier && i.ledIndex != null)
    .map(i => sendCommand({ tier: i.tier!, ledIndex: i.ledIndex!, color: 'off' }));

  await Promise.allSettled(cmds);
}

/**
 * Returns current controller connectivity status.
 * Used by health endpoint.
 */
export function getP2lStatus(): { online: boolean; ip: string; port: number } {
  return { online: isControllerOnline, ip: ESP32_IP, port: ESP32_PORT };
}
