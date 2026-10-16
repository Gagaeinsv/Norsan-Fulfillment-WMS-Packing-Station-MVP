/**
 * Standard Code 128-B Barcode SVG Generator
 * Produces 100% genuine, hardware-scanner-readable Code 128-B SVG markup.
 */

// Code 128 pattern table (values 0..106), each entry is 6 widths: bar, space, bar, space, bar, space (106 has 7)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export function encodeCode128B(text: string): number[] {
  const clean = (text || "ORD").replace(/[^\x20-\x7E]/g, "");
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < clean.length; i++) {
    const codeVal = clean.charCodeAt(i) - 32;
    codes.push(codeVal);
    checksum += codeVal * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP_CODE);
  return codes;
}

export function generateCode128SvgMarkup(
  text: string,
  height: number = 40,
  barModuleWidth: number = 1.6,
): string {
  const codes = encodeCode128B(text);
  const quietZone = 10 * barModuleWidth;

  let x = quietZone;
  const rects: string[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * barModuleWidth;
      if (i % 2 === 0) {
        rects.push(
          `<rect x="${x.toFixed(2)}" y="2" width="${w.toFixed(2)}" height="${height - 4}" fill="#000" />`,
        );
      }
      x += w;
    }
  }

  const totalWidth = Math.ceil(x + quietZone);
  return `<svg class="barcode-svg" viewBox="0 0 ${totalWidth} ${height}" width="${Math.min(250, totalWidth)}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${totalWidth}" height="${height}" fill="#fff" />${rects.join("")}</svg>`;
}

export function getCode128Bars(text: string): {
  bars: Array<{ x: number; width: number }>;
  totalModules: number;
} {
  const codes = encodeCode128B(text);
  const quietZone = 10;
  let x = quietZone;
  const bars: Array<{ x: number; width: number }> = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x, width: w });
      }
      x += w;
    }
  }

  return { bars, totalModules: x + quietZone };
}
