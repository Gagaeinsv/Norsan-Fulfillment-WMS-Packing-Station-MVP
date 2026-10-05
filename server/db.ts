import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.resolve(process.cwd(), "server/data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const isTest = process.env.NODE_ENV === "test";
const dbPath = isTest ? ":memory:" : path.join(dbDir, "wms.sqlite");
export const db = new Database(dbPath);

// Initialize Tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      italian_name TEXT NOT NULL,
      ean TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL, -- 'NORSAN' | 'ZREEN'
      volume TEXT NOT NULL,
      package_type TEXT NOT NULL,
      weight_grams INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      fragile INTEGER NOT NULL DEFAULT 0,
      instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouse_slots (
      slot_code TEXT PRIMARY KEY, -- 'S1-A'..'S3-J', 'D1-A'..'D3-J'
      side TEXT NOT NULL,         -- 'S' (Sinistra) | 'D' (Destra)
      tier INTEGER NOT NULL,      -- 1 (Basso), 2 (Medio/Golden Zone), 3 (Alto)
      position_index INTEGER NOT NULL, -- 1..10
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS product_slotting (
      slot_code TEXT PRIMARY KEY,
      product_id TEXT,
      FOREIGN KEY (slot_code) REFERENCES warehouse_slots(slot_code),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS marketing_flyers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      italian_title TEXT NOT NULL,
      slot_code TEXT NOT NULL,
      brand TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boxes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      max_weight INTEGER NOT NULL,
      branding TEXT NOT NULL, -- 'norsan_logo' | 'zreen_logo' | 'neutral_unbranded'
      branding_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      barcode TEXT NOT NULL,
      source TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      customer_city TEXT NOT NULL,
      customer_zip TEXT NOT NULL,
      customer_province TEXT NOT NULL,
      customer_country TEXT NOT NULL,
      courier TEXT NOT NULL,
      tracking_number TEXT NOT NULL,
      priority TEXT NOT NULL,
      box_recommendation TEXT NOT NULL,
      box_branding TEXT NOT NULL,
      status TEXT NOT NULL,
      special_notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity_required INTEGER NOT NULL,
      quantity_scanned INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS scan_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_code TEXT NOT NULL,
      raw_code TEXT NOT NULL,
      result_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      order_id TEXT,
      product_id TEXT,
      timestamp INTEGER NOT NULL
    );
  `);

  // Repopulate 10 slots per shelf level (A through J)
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const countSlots = db
    .prepare("SELECT COUNT(*) as count FROM warehouse_slots")
    .get() as { count: number };

  if (countSlots.count < 60) {
    db.exec("PRAGMA foreign_keys = OFF;");
    db.prepare("DELETE FROM product_slotting").run();
    db.prepare("DELETE FROM warehouse_slots").run();
    db.exec("PRAGMA foreign_keys = ON;");
    const insertSlot = db.prepare(
      "INSERT INTO warehouse_slots (slot_code, side, tier, position_index, description) VALUES (?, ?, ?, ?, ?)",
    );

    // Left Rack (S - Sinistra: 3 tiers x 10 positions = 30 slots)
    for (let tier = 1; tier <= 3; tier++) {
      letters.forEach((letter, idx) => {
        const slotCode = `S${tier}-${letter}`;
        const desc = `Scaffale S • Piano ${tier} • Posizione ${idx + 1} (${letter})`;
        insertSlot.run(slotCode, "S", tier, idx + 1, desc);
      });
    }

    // Right Rack (D - Destra: 3 tiers x 10 positions = 30 slots)
    for (let tier = 1; tier <= 3; tier++) {
      letters.forEach((letter, idx) => {
        const slotCode = `D${tier}-${letter}`;
        const desc =
          slotCode === "D3-J"
            ? "Scaffale D • Piano 3 • Posizione J (Opuscoli & Volantini)"
            : `Scaffale D • Piano ${tier} • Posizione ${idx + 1} (${letter})`;
        insertSlot.run(slotCode, "D", tier, idx + 1, desc);
      });
    }
  }

  // Seed Products if empty
  const countProducts = db
    .prepare("SELECT COUNT(*) as count FROM products")
    .get() as { count: number };
  if (countProducts.count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, sku, name, italian_name, ean, category, brand, volume,
        package_type, weight_grams, image_url, fragile, instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // --- NORSAN PRODUCTS ---
    insertProduct.run(
      "nor-01",
      "NOR-TOT-200-LEM",
      "NORSAN Omega-3 Total (Limone)",
      "Omega-3 Total Olio di Pesce Naturale gusto Limone",
      "4260368140018",
      "oil",
      "NORSAN",
      "200 ml",
      "glass_bottle",
      420,
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80",
      1,
      "Flacone in vetro scuro. Proteggere con pluriball.",
    );
    insertProduct.run(
      "nor-02",
      "NOR-TOT-200-NAT",
      "NORSAN Omega-3 Total (Naturale)",
      "Omega-3 Total Olio di Pesce Naturale senza aroma",
      "4260368140025",
      "oil",
      "NORSAN",
      "200 ml",
      "glass_bottle",
      420,
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80",
      1,
      "Flacone in vetro. Formula naturale pura.",
    );
    insertProduct.run(
      "nor-03",
      "NOR-ARK-200-LEM",
      "NORSAN Omega-3 Arktis (Limone)",
      "Omega-3 Arktis Olio di Fegato di Merluzzo",
      "4260368140032",
      "oil",
      "NORSAN",
      "200 ml",
      "glass_bottle",
      425,
      "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=300&auto=format&fit=crop&q=80",
      1,
      "Olio di merluzzo artico selvaggio.",
    );
    insertProduct.run(
      "nor-04",
      "NOR-VEG-100-LEM",
      "NORSAN Omega-3 Vegan",
      "Omega-3 Vegan Olio Algale 100% Vegetale",
      "4260368140049",
      "oil",
      "NORSAN",
      "100 ml",
      "glass_bottle",
      260,
      "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&auto=format&fit=crop&q=80",
      1,
      "Olio algale puro concentrato.",
    );
    insertProduct.run(
      "nor-05",
      "NOR-VEG-CAP-80",
      "NORSAN Omega-3 Vegan Capsule",
      "Omega-3 Vegan 80 Capsule vegetali di olio algale",
      "4260368140056",
      "capsules",
      "NORSAN",
      "80 capsule",
      "blister_box",
      140,
      "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=80",
      0,
      "Capsule 100% vegetali in tapioca.",
    );
    insertProduct.run(
      "nor-06",
      "NOR-TOT-CAP-120",
      "NORSAN Omega-3 Total Capsule",
      "Omega-3 Total 120 Capsule Olio di Pesce",
      "4260368140063",
      "capsules",
      "NORSAN",
      "120 capsule",
      "blister_box",
      195,
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&auto=format&fit=crop&q=80",
      0,
      "Capsule softgel di olio di pesce.",
    );
    insertProduct.run(
      "nor-07",
      "NOR-ARK-CAP-120",
      "NORSAN Omega-3 Arktis Capsule",
      "Omega-3 Arktis 120 Capsule Olio di Merluzzo",
      "4260368140070",
      "capsules",
      "NORSAN",
      "120 capsule",
      "blister_box",
      190,
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&auto=format&fit=crop&q=80",
      0,
      "Capsule di olio di merluzzo.",
    );
    insertProduct.run(
      "nor-08",
      "NOR-KID-OIL-150",
      "NORSAN Omega-3 KIDS Olio (Arancia)",
      "Omega-3 KIDS Olio Gusto Arancia per Bambini",
      "4260368140087",
      "kids",
      "NORSAN",
      "150 ml",
      "glass_bottle",
      340,
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80",
      1,
      "Linea Kids. Include misurino dosatore.",
    );
    insertProduct.run(
      "nor-09",
      "NOR-KID-JEL-45",
      "NORSAN Omega-3 KIDS Jelly",
      "Omega-3 KIDS 45 Caramelle Gommose Gusto Fragola",
      "4260368140094",
      "kids",
      "NORSAN",
      "45 jelly drops",
      "blister_box",
      160,
      "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=300&auto=format&fit=crop&q=80",
      0,
      "Caramelle gommose senza zuccheri aggiunti.",
    );
    insertProduct.run(
      "nor-10",
      "NOR-VIT-D3K2-20",
      "NORSAN Vitamina D3+K2 Gocce",
      "Vitamina D3+K2 Gocce in Olio di Cocco MCT",
      "4260368140100",
      "vitamins",
      "NORSAN",
      "20 ml (600 gocce)",
      "dropper",
      90,
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300&auto=format&fit=crop&q=80",
      1,
      "Flaconcino contagocce in vetro.",
    );

    // --- ZREEN NUTRACEUTICA OFFICIAL PRODUCTS ---
    insertProduct.run(
      "zre-01",
      "ZRE-COL-300-JAR",
      "ZREEN Collagene Idrolizzato & Elastina",
      "ZREEN Collagene Idrolizzato con Acido Ialuronico 300g",
      "4260368140220",
      "collagen",
      "ZREEN",
      "300 g barattolo",
      "jar_powder",
      360,
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80",
      0,
      "Barattolo polvere. Logo ZREEN.",
    );
    insertProduct.run(
      "zre-02",
      "ZRE-ASH-60-CAP",
      "ZREEN Ashwagandha KSM-66",
      "ZREEN Ashwagandha Estratto Puro KSM-66 (60 capsule)",
      "4260368140213",
      "nutraceutical",
      "ZREEN",
      "60 capsule",
      "blister_box",
      110,
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&auto=format&fit=crop&q=80",
      0,
      "Estratto radice KSM-66.",
    );
    insertProduct.run(
      "zre-03",
      "ZRE-INO-120-CAP",
      "ZREEN Myo-Inositolo & D-Chiro",
      "ZREEN Myo-Inositolo con Folato e Vitamina B6 (120 capsule)",
      "4260368140237",
      "nutraceutical",
      "ZREEN",
      "120 capsule",
      "blister_box",
      180,
      "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=80",
      0,
      "Rapporto fisiologico 40:1.",
    );
    insertProduct.run(
      "zre-04",
      "ZRE-BAC-60-CAP",
      "ZREEN BactaMix Probiotico",
      "ZREEN BactaMix 10 Ceppi Probiotici Attivi (60 capsule)",
      "4260368140244",
      "nutraceutical",
      "ZREEN",
      "60 capsule",
      "blister_box",
      115,
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&auto=format&fit=crop&q=80",
      0,
      "Benessere intestinale e flora batterica.",
    );
    insertProduct.run(
      "zre-05",
      "ZRE-MUM-60-CAP",
      "ZREEN Mumijo (Shilajit)",
      "ZREEN Mumijo Estratto Puro Himalaya con Acido Fulvico",
      "4260368140251",
      "nutraceutical",
      "ZREEN",
      "60 capsule",
      "blister_box",
      120,
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&auto=format&fit=crop&q=80",
      0,
      "Shilajit purificato di alta montagna.",
    );
    insertProduct.run(
      "zre-06",
      "ZRE-VIT-AZ-90",
      "ZREEN Vitamin Mix A-Z",
      "ZREEN Complesso Multivitaminico e Multiminerale Completo",
      "4260368140268",
      "vitamins",
      "ZREEN",
      "90 compresse",
      "blister_box",
      160,
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80",
      0,
      "Formula bilanciata per fabbisogno giornaliero.",
    );
    insertProduct.run(
      "zre-07",
      "ZRE-HTP-60-CAP",
      "ZREEN HTP-150 (5-HTP)",
      "ZREEN 5-HTP da Griffonia Simplicifolia con Vitamina B6",
      "4260368140275",
      "nutraceutical",
      "ZREEN",
      "60 capsule",
      "blister_box",
      110,
      "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=80",
      0,
      "Sonno, tono dell umore e rilassamento.",
    );
    insertProduct.run(
      "zre-08",
      "ZRE-FER-60-CAP",
      "ZREEN Ferro Vegano & Vitamina C",
      "ZREEN Ferro Bisglicinato con Acerola Naturale",
      "4260368140282",
      "nutraceutical",
      "ZREEN",
      "60 capsule",
      "blister_box",
      115,
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&auto=format&fit=crop&q=80",
      0,
      "Alta biodisponibilita e tollerabilita gastrica.",
    );
  }

  // Seed product slotting across 10-slot layout
  const countSlotting = db
    .prepare("SELECT COUNT(*) as count FROM product_slotting")
    .get() as { count: number };
  if (countSlotting.count === 0) {
    const assign = db.prepare(
      "INSERT INTO product_slotting (slot_code, product_id) VALUES (?, ?)",
    );

    // Left Shelf (S - Oils & Powders: 10 per tier)
    assign.run("S2-A", "nor-01"); // Total Limone 200ml (Fast-mover)
    assign.run("S2-B", "nor-02"); // Total Naturale 200ml
    assign.run("S2-C", "zre-01"); // ZREEN Collagene 300g
    assign.run("S2-D", "zre-06"); // ZREEN Vitamin Mix A-Z
    assign.run("S3-A", "nor-03"); // Arktis Limone 200ml
    assign.run("S3-B", "nor-08"); // KIDS Olio 150ml
    assign.run("S1-A", "nor-04"); // Vegan 100ml
    assign.run("S1-B", "zre-04"); // ZREEN BactaMix

    // Right Shelf (D - Capsules & Drops: 10 per tier)
    assign.run("D2-A", "nor-06"); // Total Capsule 120
    assign.run("D2-B", "nor-07"); // Arktis Capsule 120
    assign.run("D2-C", "zre-02"); // ZREEN Ashwagandha KSM-66
    assign.run("D2-D", "zre-03"); // ZREEN Myo-Inositolo
    assign.run("D3-A", "nor-10"); // Vitamina D3+K2 Gocce
    assign.run("D3-B", "zre-05"); // ZREEN Mumijo (Shilajit)
    assign.run("D1-A", "nor-05"); // Vegan Capsule 80
    assign.run("D1-B", "nor-09"); // KIDS Jelly
    assign.run("D1-C", "zre-07"); // ZREEN HTP-150
    assign.run("D1-D", "zre-08"); // ZREEN Ferro Vegano
  }

  // Seed Marketing Flyers
  const countFlyers = db
    .prepare("SELECT COUNT(*) as count FROM marketing_flyers")
    .get() as { count: number };
  if (countFlyers.count === 0) {
    const insertFlyer = db.prepare(
      "INSERT INTO marketing_flyers (id, code, title, italian_title, slot_code, brand) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insertFlyer.run(
      "fly-01",
      "FLY-NOR-ITA",
      "Guida Completa Omega-3 NORSAN 2026",
      "Opuscolo NORSAN: Benefici e Dosaggio",
      "D3-C",
      "NORSAN",
    );
    insertFlyer.run(
      "fly-02",
      "FLY-KIDS",
      "Opuscolo NORSAN Kids + Adesivi",
      "Guida Nutrizione Bambini",
      "D3-C",
      "NORSAN",
    );
    insertFlyer.run(
      "fly-03",
      "FLY-ZRE-NUTRA",
      "Brochure ZREEN Nutraceutica & Longevità",
      "Opuscolo ZREEN: Collagene & Ashwagandha",
      "D3-C",
      "ZREEN",
    );
    insertFlyer.run(
      "fly-04",
      "FLY-AMAZON-REVIEW",
      "Cartolina Ringraziamento Neutra (Amazon)",
      "Cartolina Assistenza Clienti",
      "D3-C",
      "AMAZON_WHITE_LABEL",
    );
    insertFlyer.run(
      "fly-05",
      "FLY-WELCOME-SUB",
      "Guida all'uso quotidiano dell'olio Omega-3",
      "Benvenuto Abbonamento: Guida all'uso quotidiano",
      "D3-C",
      "NORSAN",
    );
    insertFlyer.run(
      "fly-06",
      "FLY-RETEST",
      "Promemoria Secondo Test Omegametrix",
      "Misura di nuovo i tuoi acidi grassi",
      "D3-C",
      "NORSAN",
    );
  }

  // Seed Boxes (9 standard warehouse box types)
  const countBoxes = db
    .prepare("SELECT COUNT(*) as count FROM boxes")
    .get() as { count: number };
  if (countBoxes.count < 9) {
    const insertBox = db.prepare(
      "INSERT OR REPLACE INTO boxes (id, name, barcode, max_weight, branding, branding_label) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insertBox.run(
      "BOX-NOR-S",
      "Scatola S • Logo NORSAN (1-2 flaconi)",
      "BOX-NOR-S",
      800,
      "norsan_logo",
      "LOGO NORSAN",
    );
    insertBox.run(
      "BOX-NOR-M",
      "Scatola M • Logo NORSAN (2-4 flaconi)",
      "BOX-NOR-M",
      2200,
      "norsan_logo",
      "LOGO NORSAN",
    );
    insertBox.run(
      "BOX-NOR-L",
      "Scatola L • Logo NORSAN (Fino a 8 flaconi)",
      "BOX-NOR-L",
      5000,
      "norsan_logo",
      "LOGO NORSAN",
    );
    insertBox.run(
      "BOX-ZRE-S",
      "Scatola S • Logo ZREEN (1-2 integratori)",
      "BOX-ZRE-S",
      800,
      "zreen_logo",
      "LOGO ZREEN (DOCCIARIA)",
    );
    insertBox.run(
      "BOX-ZRE-M",
      "Scatola M • Logo ZREEN (2-4 integratori)",
      "BOX-ZRE-M",
      2200,
      "zreen_logo",
      "LOGO ZREEN (DOCCIARIA)",
    );
    insertBox.run(
      "BOX-ZRE-L",
      "Scatola L • Logo ZREEN (Grande)",
      "BOX-ZRE-L",
      5000,
      "zreen_logo",
      "LOGO ZREEN (DOCCIARIA)",
    );
    insertBox.run(
      "BOX-AMZ-S",
      "Scatola S • NEUTRA SENZA LOGO (Amazon)",
      "BOX-AMZ-S",
      800,
      "neutral_unbranded",
      "NEUTRA SENZA LOGO (AMAZON)",
    );
    insertBox.run(
      "BOX-AMZ-M",
      "Scatola M • NEUTRA SENZA LOGO (Amazon Standard)",
      "BOX-AMZ-M",
      2200,
      "neutral_unbranded",
      "NEUTRA SENZA LOGO (AMAZON)",
    );
    insertBox.run(
      "BOX-AMZ-L",
      "Scatola L • NEUTRA SENZA LOGO (Amazon Grande)",
      "BOX-AMZ-L",
      5000,
      "neutral_unbranded",
      "NEUTRA SENZA LOGO (AMAZON)",
    );
  }
}
