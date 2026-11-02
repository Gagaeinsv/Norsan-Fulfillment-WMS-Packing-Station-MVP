import { Order } from "../types/wms";
import { WMS_PHASE_CONFIG } from "../config/wmsPhaseConfig";
import { generateCode128SvgMarkup } from "./barcodeGenerator";
import { getProductLotInfo } from "./lotTraceabilityService";

/**
 * Service to generate ready-to-print Warehouse Picking Sheets / Packing Slips (Fogli di Prelievo & Distinte Ordine).
 * Printed by Team Lead / Supervisor for the Packers at Bolzano Hub.
 * Operator scans the prominent barcode on paper -> WMS opens the order and activates Pick-to-Light immediately.
 */

function generateSingleSlipHtml(order: Order): string {
  const barcodeSvg = generateCode128SvgMarkup(order.barcode || order.orderNumber, 64);

  const itemsHtml = order.items
    .map((item, idx) => {
      const shelfLot = getProductLotInfo(item.product);
      const lotStr = item.lotNumber || shelfLot.lotNumber;
      const expStr = item.expiryDate || shelfLot.expiryDate;
      const shelfLoc = item.product.shelfLocation || item.product.shelfCoordinate || "TAVOLO";

      return `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 10px 8px; font-weight: bold; font-family: monospace; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <span style="display: inline-block; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11pt; padding: 4px 10px; border-radius: 6px; font-family: monospace; letter-spacing: 0.5px;">
            ${shelfLoc}
          </span>
        </td>
        <td style="padding: 10px 8px;">
          <div style="font-weight: 900; font-size: 11pt; color: #0f172a;">${item.product.italianName || item.product.name}</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 3px;">
            SKU: <b style="color: #0f172a;">${item.product.sku}</b> &nbsp;|&nbsp; 
            EAN: <span style="font-family: monospace; font-weight: bold;">${item.product.ean}</span>
            ${
              WMS_PHASE_CONFIG.ENABLE_FEFO_LOT_TRACKING
                ? ` &nbsp;|&nbsp; <span style="color: #0369a1; font-weight: 800;">Lotto FEFO: ${lotStr} (Scad. ${expStr})</span>`
                : ""
            }
          </div>
        </td>
        <td style="padding: 10px 8px; text-align: center; font-size: 16pt; font-weight: 900; color: #0284c7;">
          ${item.quantityRequired}
        </td>
        <td style="padding: 10px 8px; text-align: center; width: 50px;">
          <div style="width: 22px; height: 22px; border: 2px solid #64748b; border-radius: 4px; margin: 0 auto;"></div>
        </td>
      </tr>
    `;
    })
    .join("");

  const flyersList = order.marketingFlyers && order.marketingFlyers.length > 0
    ? order.marketingFlyers.map((f) => `<span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: bold; margin-right: 6px;">[${f.shelfLocation}] ${f.title}</span>`).join(" ")
    : '<span style="color: #94a3b8; font-style: italic;">Nessun opuscolo richiesto</span>';

  const giftText = order.retentionGift && order.retentionGift !== "none"
    ? `<div style="margin-top: 6px; padding: 6px 10px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; color: #92400e; font-size: 9pt; font-weight: bold;">🎁 OMAGGIO CLIENTE: ${order.retentionGift === "branded_spoon" ? "Cucchiaino Dosatore NORSAN" : order.retentionGift === "card_discount_15" ? "Cartolina Sconto Retention 15%" : order.retentionGift}</div>`
    : "";

  const street = order.addressDetails?.street || order.customerAddress;
  const houseNum = order.addressDetails?.houseNumber ? `n. ${order.addressDetails.houseNumber}` : "";
  const fullStreet = [street, houseNum].filter(Boolean).join(" ");

  return `
    <div class="packing-slip-page" style="page-break-after: always; padding: 10mm 12mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; box-sizing: border-box;">
      <!-- Header with Barcode -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20pt; font-weight: 900; letter-spacing: 1px; color: #0f172a;">NORSAN</span>
            <span style="color: #94a3b8;">•</span>
            <span style="font-size: 11pt; font-weight: 800; color: #0284c7; text-transform: uppercase;">ZREEN NUTRACEUTICA</span>
          </div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 2px; font-family: monospace;">
            Hub di Spedizione Bolzano (BZ) • Distinta di Prelievo & Imballaggio
          </div>
          <div style="font-size: 13pt; font-weight: 900; margin-top: 6px; color: #0f172a;">
            Ordine: <span style="font-family: monospace; color: #0284c7;">${order.orderNumber}</span>
            <span style="font-size: 9pt; font-weight: normal; color: #64748b; margin-left: 8px;">(${order.source})</span>
          </div>
        </div>

        <!-- Prominent Code 128 Scan Barcode -->
        <div style="text-align: right; min-width: 260px;">
          <div style="font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0284c7; margin-bottom: 2px;">
            ▼ SCANSIONA CON PISTOLA OTTICA ▼
          </div>
          <div style="background: #ffffff; padding: 4px; border: 1px solid #cbd5e1; border-radius: 6px; display: inline-block;">
            ${barcodeSvg}
          </div>
          <div style="font-family: monospace; font-size: 11pt; font-weight: 900; letter-spacing: 2px; margin-top: 2px;">
            *${order.barcode || order.orderNumber}*
          </div>
        </div>
      </div>

      <!-- Order Metadata & Customer Box -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
        <div>
          <div style="font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #64748b;">Destinatario / Spedizione:</div>
          <div style="font-size: 13pt; font-weight: 900; color: #0f172a; margin-top: 2px;">${order.customerName}</div>
          <div style="font-size: 10pt; color: #334155; margin-top: 2px;">
            ${fullStreet} ${order.addressDetails?.addressAddition ? `<br><i>${order.addressDetails.addressAddition}</i>` : ""}
            <br>
            <b>${order.customerZip} ${order.customerCity} (${order.customerProvince || "IT"})</b> • ${order.customerCountry === "IT" ? "ITALIA" : order.customerCountry}
          </div>
        </div>

        <div style="border-left: 1px solid #cbd5e1; padding-left: 12px; font-size: 9.5pt;">
          <div style="margin-bottom: 4px;"><b>Corriere:</b> <span style="background: #fef08a; padding: 2px 6px; border-radius: 4px; font-weight: 800; color: #854d0e;">${order.courier}</span></div>
          <div style="margin-bottom: 4px;"><b>Scatola Consigliata:</b> <span style="font-family: monospace; font-weight: 800; color: #0284c7;">${order.boxRecommendation}</span> (${order.boxBranding === "neutral_unbranded" ? "Scatola Neutra Amazon" : "Logo NORSAN"})</div>
          <div><b>Data Ricezione:</b> ${new Date(order.createdAt).toLocaleDateString("it-IT")} ${new Date(order.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
          ${order.isSubscription ? `<div style="margin-top: 4px; color: #4338ca; font-weight: 800;">🔄 Ordine in Abbonamento (Ciclo #${order.subscriptionCycle || 1})</div>` : ""}
        </div>
      </div>

      <!-- Packing Instructions & Inclusions -->
      <div style="margin-bottom: 14px; font-size: 9.5pt; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
        <div style="font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Materiale Informativo & Opuscoli Obbligatori:</div>
        <div>${flyersList}</div>
        ${giftText}
        ${order.specialNotes ? `<div style="margin-top: 6px; padding: 4px 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-weight: bold; font-size: 9pt;">⚠️ NOTE SPECIALI: ${order.specialNotes}</div>` : ""}
      </div>

      <!-- Items Table -->
      <div style="margin-bottom: 14px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 8.5pt; text-transform: uppercase;">
              <th style="padding: 8px; width: 35px; text-align: center;">#</th>
              <th style="padding: 8px; width: 110px; text-align: center;">Corsia / Scaffale</th>
              <th style="padding: 8px;">Articolo</th>
              <th style="padding: 8px; width: 60px; text-align: center;">Q.tà</th>
              <th style="padding: 8px; width: 50px; text-align: center;">Spunta</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <!-- Operator Guidance Footer -->
      <div style="margin-top: auto; padding-top: 10px; border-top: 2px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; color: #64748b;">
        <div>
          <b>Istruzioni Operatore:</b> 1. Scansiona codice a barre in alto &nbsp;➔&nbsp; 2. Preleva e scansiona articoli illuminati &nbsp;➔&nbsp; 3. Stampa automatica etichetta DHL.
        </div>
        <div style="font-family: monospace; font-weight: bold;">
          Poka-Yoke 100% • Bolzano Hub
        </div>
      </div>
    </div>
  `;
}

/**
 * Print a single order packing slip (A4 format)
 */
export const printOrderPackingSlip = (order: Order) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Distinta di Spedizione - ${order.orderNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  ${generateSingleSlipHtml(order)}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Batch print picking sheets for all pending orders (Team Lead prints batch before shift)
 */
export const printBatchPackingSlips = (orders: Order[]) => {
  if (!orders || orders.length === 0) {
    alert("Nessun ordine presente per la stampa.");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.");
    return;
  }

  const allSlipsHtml = orders.map((o) => generateSingleSlipHtml(o)).join("\n");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Stampa Distinte Lotto (${orders.length} ordini)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .packing-slip-page {
      page-break-after: always;
      break-after: page;
    }
    .packing-slip-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  </style>
</head>
<body>
  ${allSlipsHtml}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
