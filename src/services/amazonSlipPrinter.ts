import { Order } from "../types/wms";
import { generateCode128SvgMarkup } from "./barcodeGenerator";

/**
 * Service to generate ready-to-print Amazon FBM / Marketplace Packing Slips (Bolle di Consegna)
 * Formatted exactly for A4 warehouse printing and scanning.
 */
export const printAmazonPackingSlip = (order: Order) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.");
    return;
  }

  const itemsHtml = order.items
    .map(
      (item, idx) => `
    <tr style="border-bottom: 1px solid #cbd5e1;">
      <td style="padding: 10px 8px; font-weight: bold; font-family: monospace;">${idx + 1}</td>
      <td style="padding: 10px 8px;">
        <div style="font-weight: 800; font-size: 11pt; color: #0f172a;">${item.product.italianName || item.product.name}</div>
        <div style="font-size: 9pt; color: #64748b; margin-top: 2px;">
          SKU: <b>${item.product.sku}</b> &nbsp;|&nbsp; EAN: <span style="font-family: monospace;">${item.product.ean}</span>
        </div>
      </td>
      <td style="padding: 10px 8px; text-align: center;">
        <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 9.5pt; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
          ${item.product.shelfLocation || item.product.shelfCoordinate || "TAVOLO"}
        </span>
      </td>
      <td style="padding: 10px 8px; text-align: center; font-size: 14pt; font-weight: 900; color: #005b97;">
        ${item.quantityRequired}
      </td>
      <td style="padding: 10px 8px; text-align: center; width: 60px;">
        <div style="width: 22px; height: 22px; border: 2px solid #94a3b8; border-radius: 4px; margin: 0 auto;"></div>
      </td>
    </tr>
  `
    )
    .join("");

  const street = order.addressDetails?.street || order.customerAddress;
  const houseNum = order.addressDetails?.houseNumber ? `civico ${order.addressDetails.houseNumber}` : "";
  const addition = order.addressDetails?.addressAddition ? `(${order.addressDetails.addressAddition})` : "";
  const fullAddressLine = [street, houseNum, addition].filter(Boolean).join(" ");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Bolla Ordine Amazon - ${order.orderNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10pt;
      line-height: 1.4;
    }
    .header-box {
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .barcode-block {
      text-align: right;
    }
    .barcode-svg {
      display: inline-block;
      height: 44px;
      margin-bottom: 2px;
    }
    .grid-2 {
      display: table;
      width: 100%;
      table-layout: fixed;
      margin-bottom: 16px;
    }
    .col-2 {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 10px;
    }
    .col-2:last-child {
      padding-right: 0;
      padding-left: 10px;
    }
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .info-card h4 {
      margin: 0 0 6px 0;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      padding: 8px;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    .instructions-box {
      border: 2px dashed #f59e0b;
      background: #fffbeb;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 16px;
    }
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div style="font-size: 16pt; font-weight: 900; color: #000; letter-spacing: -0.5px;">
        DISTINTA DI PRELIEVO &amp; SPEDIZIONE
      </div>
      <div style="font-size: 10.5pt; font-weight: 700; color: #0284c7; margin-top: 2px;">
        Canale: ${order.source} &nbsp;•&nbsp; Corriere: ${order.courier}
      </div>
      <div style="font-size: 8.5pt; color: #64748b; margin-top: 3px;">
        NORSAN Hub Bolzano · Stazione di Imballaggio WMS
      </div>
    </div>
    <div class="barcode-block">
      <div style="font-family: monospace; font-size: 15pt; font-weight: 900; letter-spacing: 1.5px; color: #000;">
        ${order.orderNumber}
      </div>
      <div style="margin-top: 4px;">
        <!-- Genuine Code 128-B scannable barcode -->
        ${generateCode128SvgMarkup(order.orderNumber, 40)}
      </div>
      <div style="font-size: 7.5pt; color: #64748b; text-transform: uppercase;">
        Scansiona codice per aprire su WMS
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="col-2">
      <div class="info-card">
        <h4>Destinatario Spedizione</h4>
        <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${order.customerName}</div>
        <div style="font-size: 9.5pt; margin-top: 3px; color: #1e293b;">${fullAddressLine}</div>
        <div style="font-size: 10pt; font-weight: 800; color: #0f172a; margin-top: 2px;">
          ${order.customerZip} ${order.customerCity} (${order.customerProvince || "IT"})
        </div>
        <div style="font-size: 8.5pt; color: #475569; margin-top: 2px;">
          Paese: <b>${order.customerCountry || "IT"}</b>
        </div>
      </div>
    </div>
    <div class="col-2">
      <div class="info-card">
        <h4>Dettagli Logistici &amp; Confezionamento</h4>
        <div style="margin-bottom: 4px;">
          <span style="font-size: 8.5pt; color: #64748b;">Tipo Imballaggio:</span>
          <div style="font-size: 10pt; font-weight: 800; color: #0f172a;">
            📦 ${order.boxRecommendation} (${order.boxBranding === "neutral_unbranded" ? "Scatola Neutra Amazon SENZA Logo" : order.boxBranding})
          </div>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="font-size: 8.5pt; color: #64748b;">Data Ricezione:</span>
          <div style="font-size: 9pt; font-weight: 700;">
            ${new Date(order.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div>
          <span style="font-size: 8.5pt; color: #64748b;">Tracking Previsto:</span>
          <div style="font-family: monospace; font-size: 9.5pt; font-weight: 800;">
            ${order.trackingNumber || "Da generare al completamento"}
          </div>
        </div>
      </div>
    </div>
  </div>

  ${
    order.boxBranding === "neutral_unbranded" || order.source.includes("Amazon")
      ? `<div class="instructions-box">
          <div style="font-weight: 900; color: #92400e; font-size: 9pt; text-transform: uppercase;">
            ⚠️ Regola Amazon FBM Obbligatoria:
          </div>
          <div style="font-size: 8.5pt; color: #78350f; margin-top: 2px;">
            Utilizzare <b>esclusivamente scatola neutra priva di loghi</b> NORSAN o ZREEN. Non inserire volantini o materiale promozionale esterno al programma Amazon.
          </div>
        </div>`
      : ""
  }

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Descrizione Articolo</th>
        <th style="text-align: center; width: 110px;">Scaffale</th>
        <th style="text-align: center; width: 70px;">Q.tà</th>
        <th style="text-align: center; width: 60px;">Check</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div style="margin-top: 20px; font-size: 8.5pt; color: #475569; border-left: 3px solid #005b97; padding-left: 8px;">
    <b>Istruzioni per l'operatore:</b> Prelevare gli articoli indicati dalla posizione segnalata. Al banco imballaggio, scansionare il codice a barre in alto o i singoli EAN per conferma.
  </div>

  <div class="footer" style="margin-top: 40px;">
    <div>NORSAN S.r.l. · Bolzano Fulfillment Center</div>
    <div>Documento Generato da Norsan WMS · Rimpiazzo Modulo Esterno</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Batch print multiple Amazon / E-Commerce orders in a single consolidated document
 */
export const printBatchAmazonPackingSlips = (orders: Order[]) => {
  if (orders.length === 0) {
    alert("Nessun ordine selezionato per la stampa.");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.");
    return;
  }

  const pagesHtml = orders
    .map((order, orderIdx) => {
      const itemsHtml = order.items
        .map(
          (item, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 9px 8px; font-weight: bold; font-family: monospace;">${idx + 1}</td>
          <td style="padding: 9px 8px;">
            <div style="font-weight: 800; font-size: 11pt; color: #0f172a;">${item.product.italianName || item.product.name}</div>
            <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">
              SKU: <b>${item.product.sku}</b> &nbsp;|&nbsp; EAN: <span style="font-family: monospace;">${item.product.ean}</span>
            </div>
          </td>
          <td style="padding: 9px 8px; text-align: center;">
            <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 9pt; padding: 2px 7px; border-radius: 4px; border: 1px solid #bae6fd;">
              ${item.product.shelfLocation || item.product.shelfCoordinate || "TAVOLO"}
            </span>
          </td>
          <td style="padding: 9px 8px; text-align: center; font-size: 13pt; font-weight: 900; color: #005b97;">
            ${item.quantityRequired}
          </td>
          <td style="padding: 9px 8px; text-align: center; width: 50px;">
            <div style="width: 20px; height: 20px; border: 2px solid #94a3b8; border-radius: 4px; margin: 0 auto;"></div>
          </td>
        </tr>
      `
        )
        .join("");

      const street = order.addressDetails?.street || order.customerAddress;
      const houseNum = order.addressDetails?.houseNumber ? `civico ${order.addressDetails.houseNumber}` : "";
      const addition = order.addressDetails?.addressAddition ? `(${order.addressDetails.addressAddition})` : "";
      const fullAddressLine = [street, houseNum, addition].filter(Boolean).join(" ");

      return `
      <div class="sheet ${orderIdx < orders.length - 1 ? "page-break" : ""}">
        <div class="header-box">
          <div>
            <div style="font-size: 15pt; font-weight: 900; color: #000; letter-spacing: -0.5px;">
              DISTINTA DI PRELIEVO &amp; SPEDIZIONE
            </div>
            <div style="font-size: 10pt; font-weight: 700; color: #0284c7; margin-top: 2px;">
              Canale: ${order.source} &nbsp;•&nbsp; Corriere: ${order.courier}
            </div>
            <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">
              NORSAN Hub Bolzano · Ordine ${orderIdx + 1} di ${orders.length}
            </div>
          </div>
          <div class="barcode-block">
            <div style="font-family: monospace; font-size: 14pt; font-weight: 900; letter-spacing: 1.5px; color: #000;">
              ${order.orderNumber}
            </div>
            <div style="margin-top: 3px;">
              ${generateCode128SvgMarkup(order.orderNumber, 38)}
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="col-2">
            <div class="info-card">
              <h4>Destinatario Spedizione</h4>
              <div style="font-size: 10.5pt; font-weight: 900; color: #0f172a;">${order.customerName}</div>
              <div style="font-size: 9pt; margin-top: 2px; color: #1e293b;">${fullAddressLine}</div>
              <div style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin-top: 2px;">
                ${order.customerZip} ${order.customerCity} (${order.customerProvince || "IT"})
              </div>
            </div>
          </div>
          <div class="col-2">
            <div class="info-card">
              <h4>Dettagli Logistici</h4>
              <div style="font-size: 9.5pt; font-weight: 800; color: #0f172a;">
                📦 ${order.boxRecommendation} (${order.boxBranding === "neutral_unbranded" ? "Scatola Neutra Senza Logo" : order.boxBranding})
              </div>
              <div style="font-size: 8.5pt; color: #64748b; margin-top: 4px;">
                Tracking: <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${order.trackingNumber || "Da generare"}</span>
              </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Descrizione Articolo</th>
              <th style="text-align: center; width: 100px;">Scaffale</th>
              <th style="text-align: center; width: 65px;">Q.tà</th>
              <th style="text-align: center; width: 50px;">Check</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>NORSAN S.r.l. · Bolzano Fulfillment Center</div>
          <div>Pagina ${orderIdx + 1} di ${orders.length}</div>
        </div>
      </div>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Stampa Distinte Ordini (${orders.length} ordini)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm 10mm 14mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.5pt;
    }
    .sheet {
      page-break-after: always;
      break-after: page;
      padding-bottom: 10px;
    }
    .sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .header-box {
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .barcode-block { text-align: right; }
    .barcode-svg { display: inline-block; height: 38px; }
    .grid-2 {
      display: table;
      width: 100%;
      table-layout: fixed;
      margin-bottom: 12px;
    }
    .col-2 {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 8px;
    }
    .col-2:last-child { padding-right: 0; padding-left: 8px; }
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .info-card h4 {
      margin: 0 0 4px 0;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th {
      background: #f1f5f9;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      padding: 6px 8px;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      font-size: 7.5pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
