import { Order } from "../types/wms";
import { generateCode128SvgMarkup } from "./barcodeGenerator";
import { getProductLotInfo } from "./lotTraceabilityService";

/**
 * Service to print authentic DHL thermal shipping labels (100mm x 150mm / A6 format).
 * Triggered IMMEDIATELY upon scanning the paper packing slip / distinta barcode.
 * Supports single and multi-collo (each parcel gets a distinct piece barcode and sequence number).
 */

function generateSingleDhlHtml(
  order: Order,
  colloIdx: number,
  totalColli: number,
): string {
  const isFragile = order.items.some((i) => i.product.fragile);
  const totalUnits = order.items.reduce(
    (s, i) => s + (i.quantityScanned || i.quantityRequired),
    0,
  );

  const totalWeightKg = (
    (order.items.reduce(
      (s, i) => s + i.product.weightGrams * (i.quantityRequired || 1),
      0,
    ) +
      180 * totalColli) /
    1000
  ).toFixed(2);

  const colloWeightKg = (parseFloat(totalWeightKg) / totalColli).toFixed(2);

  // Dedicated tracking number per piece if multi-collo
  const baseTracking = order.trackingNumber || `JJD${order.orderNumber.replace(/[^0-9]/g, "").padStart(10, "0")}`;
  const trackingText =
    totalColli > 1
      ? `${baseTracking}-${String(colloIdx + 1).padStart(2, "0")}`
      : baseTracking;

  const barcodeSvg = generateCode128SvgMarkup(trackingText, 52, 1.7);

  const street = order.addressDetails?.street || order.customerAddress;
  const houseNum = order.addressDetails?.houseNumber ? `n. ${order.addressDetails.houseNumber}` : "";
  const fullStreet = [street, houseNum].filter(Boolean).join(" ");

  const fefoSummary = order.items
    .map((i) => {
      const lot = getProductLotInfo(i.product);
      return `${i.product.sku}: ${i.lotNumber || lot.lotNumber} (${i.expiryDate || lot.expiryDate})`;
    })
    .join(" • ");

  return `
    <div class="dhl-label-page" style="page-break-after: always; break-after: page; width: 96mm; min-height: 142mm; margin: 0 auto; padding: 2mm; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #000; background: #fff; border: 2px solid #000;">
      <!-- DHL Header -->
      <div style="background: #ffcc00; padding: 6px 8px; border-bottom: 3px solid #d40511; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <span style="font-size: 24pt; font-weight: 900; font-style: italic; color: #d40511; letter-spacing: -1.5px; line-height: 1;">DHL</span>
          <span style="font-size: 9pt; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.5px;">${order.courier || "EXPRESS"}</span>
        </div>
        <div style="background: #000; color: #ffcc00; font-family: monospace; font-size: 8pt; font-weight: 900; padding: 3px 6px; border-radius: 3px;">
          DOMESTIC EXPRESS
        </div>
      </div>

      <!-- Routing Code & Collo Weight -->
      <div style="padding: 6px 4px; border-bottom: 2px solid #000; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #475569;">Routing Code:</div>
          <div style="font-size: 15pt; font-weight: 900; font-family: monospace; letter-spacing: 1px;">
            ${order.customerCountry || "IT"}-${order.customerProvince || "REG"}-${order.customerZip}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #475569;">Collo / Peso:</div>
          <div style="font-size: 10pt; font-weight: 900; font-family: monospace;">
            ${totalColli > 1 ? `Collo ${colloIdx + 1}/${totalColli} • ${colloWeightKg} kg` : `1 collo • ${totalWeightKg} kg`}
          </div>
        </div>
      </div>

      <!-- Shipper & Receiver -->
      <div style="padding: 6px 4px; border-bottom: 2px solid #000; display: grid; grid-template-columns: 1.1fr 1.3fr; gap: 8px; font-size: 7.5pt; line-height: 1.25;">
        <!-- Shipper (From) -->
        <div style="border-right: 1px solid #cbd5e1; padding-right: 6px;">
          <div style="font-size: 6pt; font-weight: 800; text-transform: uppercase; color: #64748b;">Mittente (Shipper):</div>
          <div style="font-weight: 900; font-size: 8.5pt; color: #0f172a; margin-top: 1px;">NORSAN S.r.l.</div>
          <div style="color: #334155; margin-top: 1px;">
            Via Macello 30 / Schlachthofstraße<br>
            39100 Bolzano (BZ) - ITALY<br>
            Tel: +39 0471 123456
          </div>
        </div>

        <!-- Consignee (To) -->
        <div>
          <div style="font-size: 6pt; font-weight: 800; text-transform: uppercase; color: #64748b;">Destinatario (To):</div>
          <div style="font-weight: 900; font-size: 10.5pt; color: #000; margin-top: 1px;">${order.customerName}</div>
          <div style="color: #1e293b; margin-top: 1px; font-size: 8pt;">
            ${fullStreet} ${order.addressDetails?.addressAddition ? `<br><i>${order.addressDetails.addressAddition}</i>` : ""}
            <br>
            <b>${order.customerZip} ${order.customerCity} (${order.customerProvince || "IT"})</b>
            <br>
            ${order.customerCountry === "IT" ? "ITALIA" : order.customerCountry}
          </div>
        </div>
      </div>

      <!-- Barcode & Tracking Number -->
      <div style="padding: 6px 4px 4px 4px; text-align: center; border-bottom: 1px dashed #64748b;">
        <div style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #475569; display: flex; justify-content: center; gap: 6px; align-items: center;">
          <span>Waybill / Tracking Number DHL</span>
          ${totalColli > 1 ? `<span style="background: #0284c7; color: #fff; padding: 1px 4px; border-radius: 3px; font-size: 6.5pt; font-weight: 900;">PEZZO ${colloIdx + 1}/${totalColli}</span>` : ""}
        </div>
        <div style="font-family: monospace; font-size: 10pt; font-weight: 900; letter-spacing: 1.5px; background: #f1f5f9; padding: 2px 4px; border-radius: 3px; margin: 2px 0;">
          ${trackingText}
        </div>
        <div style="padding: 4px 0; display: flex; justify-content: center;">
          ${barcodeSvg}
        </div>
      </div>

      <!-- Footer & FEFO Lot Traceability -->
      <div style="padding: 4px; font-size: 7pt; color: #1e293b; line-height: 1.3;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800;">
          <div>
            ${isFragile ? `<span style="color: #dc2626; font-weight: 900;">⚠️ VETRO / FRAGILE</span>` : `<span style="color: #16a34a;">STANDARD</span>`}
          </div>
          <div style="font-family: monospace;">
            Rif. Ordine: <b>${order.orderNumber}</b> (${totalUnits} pz)${totalColli > 1 ? ` [${colloIdx + 1}/${totalColli}]` : ""}
          </div>
        </div>

        <div style="margin-top: 3px; font-size: 6pt; font-family: monospace; color: #475569; background: #f8fafc; padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 3px; word-break: break-all;">
          <b>FEFO Trace:</b> ${fefoSummary}
        </div>
      </div>
    </div>
  `;
}

/**
 * Print DHL Thermal Shipping Label(s) for an order immediately.
 * Opens print preview formatted for 100mm x 150mm thermal paper.
 * If onlyColloIndex (0-based) is provided, prints ONLY that specific parcel label
 * (e.g. when adding an extra box via +COLLO without re-printing box 1).
 */
export function printDhlThermalLabel(
  order: Order,
  packageCount?: number,
  onlyColloIndex?: number,
): void {
  const colli = Math.max(1, packageCount ?? order.packageCount ?? 1);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    console.warn("[DHL Print] Popup blocked by browser. Trying fallback.");
    // Fallback: trigger standard window.print if popup is blocked
    window.print();
    return;
  }

  const pagesHtml =
    typeof onlyColloIndex === "number" &&
    onlyColloIndex >= 0 &&
    onlyColloIndex < colli
      ? generateSingleDhlHtml(order, onlyColloIndex, colli)
      : Array.from({ length: colli })
          .map((_, idx) => generateSingleDhlHtml(order, idx, colli))
          .join("\n");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>DHL Shipping Label - ${order.orderNumber}</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .dhl-label-page {
      page-break-after: always;
      break-after: page;
    }
    .dhl-label-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  </style>
</head>
<body>
  ${pagesHtml}
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
}
