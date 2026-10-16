/**
 * Italian Address Parser & Normalizer for Logistics & Courier APIs
 *
 * Solves the classic DACH/German middleware issue (e.g. JTL / Billbee / Sendcloud "Adressfehler beheben")
 * where Italian addresses with street type (Via/Corso/Viale), house number, and apartment/floor
 * (e.g. "Via Giuseppe Di Vittorio 22 \n 2 piano") fail to split automatically into:
 * - Straße (street)
 * - Hausnummer (houseNumber)
 * - Adresszusatz (addressAddition)
 */

export interface ParsedItalianAddress {
  street: string; // e.g. "Via Giuseppe Di Vittorio"
  houseNumber: string; // e.g. "22", "14/A", "SNC"
  addressAddition: string; // e.g. "2 piano", "Scala B, Int. 4"
  status: "valid" | "warning" | "error";
  validationError?: string;
  rawInput?: string;
}

export interface FullAddressBlockResult extends ParsedItalianAddress {
  customerName: string;
  zip: string;
  city: string;
  province: string;
  country: string;
}

const STREET_PREFIXES = [
  "via",
  "v.",
  "corso",
  "c.so",
  "viale",
  "v.le",
  "piazza",
  "p.zza",
  "piazzale",
  "p.zle",
  "largo",
  "vicolo",
  "vic.",
  "strada",
  "str.",
  "strada provinciale",
  "sp",
  "strada statale",
  "ss",
  "contrada",
  "c.da",
  "borgo",
  "circonvallazione",
  "vico",
  "lungomare",
  "traversa",
  "frazione",
  "fraz.",
  "localita",
  "loc.",
];

const ADDITION_MARKERS = [
  "piano terra",
  "piano rialzato",
  "piano",
  "p.",
  "p°",
  "scala",
  "sc.",
  "interno",
  "int.",
  "palazzo",
  "pal.",
  "palazzina",
  "citofono",
  "campanello",
  "suonare",
  "presso",
  "c/o",
  "co",
  "c.o.",
  "edificio",
  "edif.",
];

function cleanLine(str: string): string {
  if (!str) return "";
  return str.trim().replace(/[ \t]+/g, " ");
}

/**
 * Parses an Italian street line (or multi-line address text) into structured components:
 * street name, house number, and floor/staircase/addition.
 */
export function parseItalianAddress(addressLine: string): ParsedItalianAddress {
  if (!addressLine) {
    return {
      street: "",
      houseNumber: "",
      addressAddition: "",
      status: "error",
      validationError: "Indirizzo vuoto",
      rawInput: addressLine,
    };
  }

  // 1. Separate lines if multi-line
  const lines = addressLine.split(/[\r\n]+/).map(cleanLine).filter(Boolean);
  if (lines.length === 0) {
    return {
      street: "",
      houseNumber: "",
      addressAddition: "",
      status: "error",
      validationError: "Indirizzo vuoto",
      rawInput: addressLine,
    };
  }

  let mainLine = lines[0];
  const additionParts: string[] = [];

  // Subsequent lines are explicit additions (e.g. "2 piano")
  if (lines.length > 1) {
    additionParts.push(...lines.slice(1));
  }

  // 2. Identify and separate address addition from mainLine if present after comma
  // Example: "Corso Buenos Aires 42, 3 piano"
  if (mainLine.includes(",")) {
    const commaSplit = mainLine.split(",");
    const potentialStreet = commaSplit[0].trim();
    const potentialRest = commaSplit.slice(1).join(", ").trim();

    const hasAddition = ADDITION_MARKERS.some((m) => {
      const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const suffix = m.endsWith(".") ? "(?:$|\\s|\\d)" : "\\b";
      return new RegExp(`(?:^|\\s|,)${escaped}${suffix}`, "i").test(
        potentialRest,
      );
    });
    if (
      hasAddition ||
      /^\s*(?:piano|int|scala|sc\.|p\.)/i.test(potentialRest)
    ) {
      mainLine = potentialStreet;
      additionParts.unshift(potentialRest);
    }
  }

  // Check if mainLine ends with a civico followed by an addition marker without comma:
  // "Viale dei Mille 18 piano terra" or "Via Roma 10 scala B" or "Via Verdi 5 int. 2"
  const civicoPlusAdditionRegex =
    /\s+(\d+[\s\/-]?[a-zA-Z0-9]*|snc|s\.n\.c\.)\s+((?:(?:[1-9]\d?[°\^]?\s+)?piano\b|scala\b|interno\b|int\b|citofono\b|presso\b|c\/o\b).*)$/i;
  const civicoAdditionMatch = mainLine.match(civicoPlusAdditionRegex);

  let street = "";
  let houseNumber = "";

  if (civicoAdditionMatch) {
    houseNumber = cleanLine(civicoAdditionMatch[1]);
    additionParts.unshift(cleanLine(civicoAdditionMatch[2]));
    street = cleanLine(mainLine.substring(0, civicoAdditionMatch.index));
  } else {
    // Check if mainLine has standalone addition marker at the end, e.g. "Via Roma 10 - 2 piano"
    for (const marker of ADDITION_MARKERS) {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const suffix = marker.endsWith(".") ? "(?:$|\\s|\\d)" : "\\b";
      const inlineAdditionRegex = new RegExp(
        `\\s+(?:-|–)?\\s*(${escaped}${suffix}.*)$`,
        "i",
      );
      const match = mainLine.match(inlineAdditionRegex);
      if (match) {
        additionParts.unshift(match[1].trim());
        mainLine = mainLine.substring(0, match.index).trim();
        break;
      }
    }

    // 3. Extract House Number (Numero Civico) from mainLine
    // Pattern A: explicitly prefixed with n., n°, civico
    const civicoPrefixRegex =
      /\b(?:n°|n\.|numero|civico|num\.)\s*([0-9]+(?:\s*[/-]\s*[a-zA-Z0-9]+|\s+[a-zA-Z]\b|\s+bis\b|\s+ter\b)?|snc|s\.n\.c\.)\s*$/i;
    const civicoPrefixMatch = mainLine.match(civicoPrefixRegex);

    if (civicoPrefixMatch) {
      houseNumber = cleanLine(civicoPrefixMatch[1]);
      street = cleanLine(mainLine.substring(0, civicoPrefixMatch.index));
    } else {
      // Pattern B: number at the end of the line, e.g. " 22", " 22/A", " 22 A", " 22-B", " 22 bis", " snc"
      const endNumberRegex =
        /\s+([0-9]+(?:\s*[/\\-]\s*[a-zA-Z0-9]+|\s+[a-zA-Z]\b|\s+bis\b|\s+ter\b)?|snc|s\.n\.c\.)\s*$/i;
      const endMatch = mainLine.match(endNumberRegex);

      if (endMatch) {
        const isProvincialeOnly =
          /^(?:strada\s+provinciale|strada\s+statale|sp|ss)\s+\d+$/i.test(
            mainLine.trim()
          );
        if (isProvincialeOnly) {
          street = mainLine.trim();
          houseNumber = "";
        } else {
          houseNumber = cleanLine(endMatch[1]);
          street = cleanLine(mainLine.substring(0, endMatch.index));
        }
      } else {
        street = mainLine.trim();
        houseNumber = "";
      }
    }
  }

  // Clean trailing commas or slashes from street
  street = street.replace(/[,;/-]+$/, "").trim();

  // Normalize snc
  if (/^s\.?n\.?c\.?$/i.test(houseNumber)) {
    houseNumber = "SNC";
  }

  const finalAddition = cleanLine(additionParts.join(", "))
    .replace(/^[,;/-]+|[,;/-]+$/g, "")
    .trim();

  // Validation
  let status: "valid" | "warning" | "error" = "valid";
  let validationError: string | undefined = undefined;

  if (!street) {
    status = "error";
    validationError = "Nome via mancante (Straße fehlt)";
  } else if (!houseNumber) {
    status = "warning";
    validationError =
      "Numero civico mancante (Hausnummer fehlt - inserire o indicare SNC)";
  }

  return {
    street,
    houseNumber,
    addressAddition: finalAddition,
    status,
    validationError,
    rawInput: addressLine,
  };
}

/**
 * Parses a full raw multi-line address block (e.g. from Amazon / Selly modal / clipboard):
 *
 * Simone Marchini
 * Via Giuseppe Di Vittorio 22
 * 2 piano
 * 50065 Pontassieve
 * Firenze, IT
 */
export function parseFullAddressBlock(
  rawBlock: string
): FullAddressBlockResult | null {
  if (!rawBlock) return null;
  const lines = rawBlock.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (lines.length === 0) return null;

  let name = "";
  let country = "IT";
  let province = "";
  let zip = "";
  let city = "";
  const addressLines: string[] = [];

  let startIndex = 0;
  const firstLineIsStreet = STREET_PREFIXES.some((p) =>
    new RegExp(`^${p}\\b`, "i").test(lines[0])
  );
  if (!firstLineIsStreet && lines.length > 1) {
    name = lines[0];
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (/^(?:italia|italy|it)$/i.test(line)) {
      country = "IT";
      continue;
    }

    const cityCountryMatch = line.match(
      /^([a-zA-Z\s'-]+),\s*(IT|ITALIA|ITALY|DE|AT|CH)$/i
    );
    if (cityCountryMatch) {
      const c = cityCountryMatch[2].toUpperCase();
      country = c === "ITALIA" || c === "ITALY" ? "IT" : c;
      const provOrCity = cityCountryMatch[1].trim();
      if (!province && provOrCity.length <= 3) {
        province = provOrCity.toUpperCase();
      } else if (!province) {
        province = provOrCity;
      }
      continue;
    }

    const zipCityMatch = line.match(/^(\d{5})\s+(.+)$/);
    if (zipCityMatch) {
      zip = zipCityMatch[1];
      city = zipCityMatch[2].trim();
      continue;
    }

    if (/^\d{5}$/.test(line)) {
      zip = line;
      continue;
    }

    addressLines.push(line);
  }

  const parsedAddress = parseItalianAddress(addressLines.join("\n"));

  return {
    customerName: name,
    ...parsedAddress,
    zip,
    city,
    province,
    country,
  };
}
