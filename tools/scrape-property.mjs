#!/usr/bin/env node
/**
 * ALQUIMIA — Property Scraper
 *
 * Scrapes a PortalInmobiliario listing, downloads images,
 * uses Claude API to analyze/label images and structure data,
 * then creates a new property in the site's JSON.
 *
 * Usage: node tools/scrape-property.mjs <URL>
 * Requires: ANTHROPIC_API_KEY env variable
 */

import puppeteer from 'puppeteer-core';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// --- CONFIG ---
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: Set ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

const url = process.argv[2];
if (!url || (!url.includes('portalinmobiliario.com') && !url.includes('mercadolibre.cl'))) {
  console.error('Usage: node tools/scrape-property.mjs <url>\n  Supports: portalinmobiliario.com, mercadolibre.cl');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// --- HELPERS ---
function slugify(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function log(msg) {
  console.log(`\x1b[36m[ALQUIMIA]\x1b[0m ${msg}`);
}

// --- STEP 1: SCRAPE PAGE (interactive) ---
async function scrapePage(url) {
  log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1440,900',
      url  // Open URL directly as argument
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  // Get the page that Chrome opened with the URL
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('portalinmobiliario')) || pages[pages.length - 1];

  // Intercept ALL image network requests
  const capturedImageUrls = new Set();
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('mlstatic.com') && u.includes('D_NQ_NP') && !u.includes('2X_') && res.status() === 200) {
      capturedImageUrls.add(u);
    }
  });

  // Monitor new pages too (modal might open in same tab but just in case)
  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const newPage = await target.page();
      newPage.on('response', (res) => {
        const u = res.url();
        if (u.includes('mlstatic.com') && u.includes('D_NQ_NP') && !u.includes('2X_') && res.status() === 200) {
          capturedImageUrls.add(u);
        }
      });
    }
  });

  // Show live counter in terminal
  const counterInterval = setInterval(() => {
    process.stdout.write(`\r\x1b[36m[ALQUIMIA]\x1b[0m Imagenes capturadas: ${capturedImageUrls.size}  `);
  }, 1000);

  console.log('\n\x1b[33m╔════════════════════════════════════════════════════════════╗');
  console.log('║  INSTRUCCIONES:                                            ║');
  console.log('║                                                            ║');
  console.log('║  Se abrio Chrome con la propiedad.                         ║');
  console.log('║                                                            ║');
  console.log('║  1. Haz click en la foto principal para abrir la galeria   ║');
  console.log('║  2. Navega por TODAS las fotos (flechas del teclado)       ║');
  console.log('║  3. Cuando hayas pasado por todas, vuelve a la terminal    ║');
  console.log('║                                                            ║');
  console.log('║  El contador de imagenes se actualiza en tiempo real.      ║');
  console.log('║                                                            ║');
  console.log('║  Presiona ENTER cuando hayas terminado...                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\x1b[0m\n');

  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', resolve);
  });
  process.stdin.pause();
  clearInterval(counterInterval);
  console.log('');

  // Now extract property data from the page
  log('Extracting property data...');
  let propertyData;
  try {
    // Get current active page (might have changed)
    const currentPages = await browser.pages();
    const activePage = currentPages.find(p => p.url().includes('portalinmobiliario')) || currentPages[currentPages.length - 1];

    propertyData = await activePage.evaluate(() => {
      const getText = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent.trim() : '';
      };
      const getAll = (sel) => [...document.querySelectorAll(sel)].map(el => el.textContent.trim());

      const title = getText('h1');
      const priceEl = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction');
      const priceCurrency = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__currency-symbol');
      const price = priceEl ? priceEl.textContent.trim() : '';
      const currency = priceCurrency ? priceCurrency.textContent.trim() : '';
      const location = getText('.ui-pdp-media__title');

      const specs = {};
      document.querySelectorAll('.ui-pdp-specs__table tr, .ui-vip-specs__table tr, .andes-table__row').forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) specs[cells[0].textContent.trim()] = cells[1].textContent.trim();
      });
      document.querySelectorAll('.ui-pdp-highlighted-specs-res__icon-label').forEach(el => {
        const parts = el.textContent.trim().split(':').map(s => s.trim());
        if (parts.length === 2) specs[parts[0]] = parts[1];
      });

      const desc = getText('.ui-pdp-description__content');
      const features = getAll('.ui-pdp-list__item span');
      const seller = getText('.ui-pdp-seller__header__title');
      const fullPageText = document.body.innerText.substring(0, 15000);

      return { title, price, currency, location, specs, desc, features, seller, fullPageText };
    });
  } catch (e) {
    log(`Warning: Could not extract data from page (${e.message}). Using URL text as fallback.`);
    propertyData = { title: '', price: '', currency: '', location: '', specs: {}, desc: '', features: [], seller: '', fullPageText: url };
  }

  // Collect images from DOM too
  try {
    const currentPages = await browser.pages();
    const activePage = currentPages.find(p => p.url().includes('portalinmobiliario')) || currentPages[currentPages.length - 1];
    const domImages = await activePage.evaluate(() => {
      const urls = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || '';
        if (src.includes('mlstatic.com') && src.includes('D_NQ_NP')) urls.push(src);
      });
      return urls;
    });
    domImages.forEach(u => capturedImageUrls.add(u));
  } catch {}

  await browser.close();

  // Process captured image URLs
  let imageUrls = [...capturedImageUrls];

  // Upgrade to full resolution (-F suffix)
  imageUrls = imageUrls.map(u => {
    return u.replace(/-O\.webp/, '-F.webp')
            .replace(/-V\.webp/, '-F.webp')
            .replace(/-D\.webp/, '-F.webp');
  });

  // Deduplicate by base image ID
  const seen = new Set();
  imageUrls = imageUrls.filter(u => {
    const match = u.match(/D_NQ_NP_(\d+-MLC\d+_\d+)/);
    const id = match ? match[1] : u;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  log(`Found ${imageUrls.length} unique images`);

  await browser.close();
  return { ...propertyData, imageUrls };
}

// --- STEP 3: DOWNLOAD IMAGES ---
async function downloadImages(imageUrls, slug) {
  const imgDir = path.join(ROOT, 'img', 'propiedades', slug);
  fs.mkdirSync(imgDir, { recursive: true });

  log(`Downloading ${imageUrls.length} images to ${imgDir}...`);
  const downloaded = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const ext = imageUrls[i].includes('.webp') ? 'webp' : 'jpg';
    const fname = `foto-${String(i + 1).padStart(2, '0')}.${ext}`;
    const dest = path.join(imgDir, fname);

    try {
      await download(imageUrls[i], dest);
      const stats = fs.statSync(dest);
      if (stats.size > 1000) {
        downloaded.push({ path: `img/propiedades/${slug}/${fname}`, originalUrl: imageUrls[i], index: i });
        log(`  Downloaded ${fname} (${Math.round(stats.size / 1024)}KB)`);
      } else {
        fs.unlinkSync(dest);
      }
    } catch (e) {
      log(`  Failed: ${fname} - ${e.message}`);
    }
  }

  return downloaded;
}

// --- STEP 4: ANALYZE IMAGES WITH CLAUDE ---
async function analyzeImages(downloaded, slug) {
  log('Analyzing images with Claude Vision...');

  const imageAnalysis = [];
  const discarded = [];

  for (const img of downloaded) {
    const fullPath = path.join(ROOT, img.path);
    const imageData = fs.readFileSync(fullPath);
    const base64 = imageData.toString('base64');
    const mediaType = img.path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 250,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: `Analyze this image from a real estate listing. Determine if it is a VALID property photo.

VALID: interior rooms (living, kitchen, bedroom, bathroom, hallway, closet), exterior views (facade, building, terrace, balcony, garden, pool, parking), panoramic/city views from the property, building amenities (gym, rooftop, lobby, laundry room, playground).

INVALID: logos, watermarks, brand images, maps, floor plans, screenshots, icons, placeholder images, agent photos, marketing banners, QR codes, text-only images, blurry/unrecognizable images.

Respond with ONLY a JSON object:
{"isProperty": true/false, "label": "short Spanish label (e.g. Living comedor, Cocina, Dormitorio principal, Baño, Terraza, Fachada, Vista, Gimnasio)", "type": "interior|exterior|amenity|view", "quality": 1-10, "isHero": true/false (true ONLY for the single best cover photo showing the main space or facade), "reason": "brief reason if rejected"}` }
          ]
        }]
      });

      const text = response.content[0].text;
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');

      if (json.isProperty === false) {
        // Discard non-property images
        log(`  ${img.path.split('/').pop()}: DESCARTADA — ${json.reason || 'no es foto de propiedad'}`);
        discarded.push(img);
        // Delete the file
        fs.unlinkSync(fullPath);
      } else {
        imageAnalysis.push({ ...img, ...json });
        log(`  ${img.path.split('/').pop()}: ${json.label || 'unknown'} (${json.type}, quality: ${json.quality || '?'})`);
      }
    } catch (e) {
      // If analysis fails, keep the image with defaults
      imageAnalysis.push({ ...img, label: `Foto ${img.index + 1}`, type: 'interior', quality: 5, isHero: false, isProperty: true });
      log(`  ${img.path.split('/').pop()}: analisis fallo, conservada por defecto`);
    }
  }

  if (discarded.length > 0) {
    log(`Descartadas ${discarded.length} imagenes que no son de propiedad`);
  }
  log(`Imagenes validas: ${imageAnalysis.length}`);

  return imageAnalysis;
}

// --- STEP 5: STRUCTURE DATA WITH CLAUDE ---
async function structureProperty(scraped, imageAnalysis, slug) {
  log('Structuring property data with Claude...');

  // Sort images: hero first, then by quality
  const sorted = [...imageAnalysis].sort((a, b) => {
    if (a.isHero && !b.isHero) return -1;
    if (!a.isHero && b.isHero) return 1;
    return (b.quality || 5) - (a.quality || 5);
  });

  const hero = sorted[0];
  const thumbnails = sorted.slice(1, 6);
  const gallery = sorted.slice(1);

  const imageInfo = sorted.map(img => `${img.path}: ${img.label} (${img.type}, quality ${img.quality})`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a real estate data structurer for "Alquimia Propiedades" in Chile.

Given this scraped data from PortalInmobiliario, create a complete property JSON object.

SCRAPED DATA:
Title: ${scraped.title}
Price: ${scraped.currency} ${scraped.price}
Location: ${scraped.location}
Specs: ${JSON.stringify(scraped.specs)}
Description: ${scraped.desc}
Features: ${JSON.stringify(scraped.features)}
Seller: ${scraped.seller}

FULL PAGE TEXT (for any missing data):
${scraped.fullPageText.substring(0, 5000)}

IMAGES:
${imageInfo}

Return ONLY a valid JSON object with this EXACT structure (fill in all fields from the data, use reasonable defaults for missing data):
{
  "id": "${slug}",
  "slug": "${slug}",
  "titulo": "short attractive title in Spanish",
  "direccion": "full address",
  "comuna": "comuna name",
  "precio": number (in CLP or UF value),
  "precio_formato": "formatted price string",
  "moneda": "CLP" or "UF",
  "gastos_comunes": "amount/mes or empty",
  "operacion": "Venta" or "Arriendo",
  "tipo": "Departamento" or "Casa" or "Oficina",
  "estado": "Nuevo ingreso",
  "dormitorios": number,
  "banos": number,
  "superficie_util": number,
  "superficie_total": number,
  "terraza": number or null,
  "piso": "string like '5 de 12'",
  "estacionamientos": number,
  "orientacion": "string or empty",
  "highlight": "compelling 2-3 sentence summary highlighting the best features, written in marketing tone",
  "descripcion": "full property description, well written",
  "caracteristicas": ["array of 10-14 key features as short strings"],
  "tags": [{"texto": "tag text", "icono": "emoji", "tipo": "default or gold"}],
  "ficha_tecnica": [{"campo": "field name", "valor": "value"}],
  "servicios_edificio": [{"icono": "emoji", "nombre": "service name"}],
  "transporte": [{"tipo": "metro or bus", "nombre": "stop name", "distancia": "X m", "tiempo": "X min"}],
  "imagenes": {
    "hero": "${hero?.path || ''}",
    "thumbnails": ${JSON.stringify(thumbnails.map(t => t.path))},
    "galeria": ${JSON.stringify(gallery.map(g => ({ src: g.path, label: g.label })))}
  },
  "agente": {
    "nombre": "Keyla Tobar",
    "telefono": "+56985298224",
    "whatsapp": "+56985298224",
    "email": "contacto@alquimiapropiedades.com"
  }
}`
    }]
  });

  const text = response.content[0].text;
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
  return json;
}

// --- STEP 6: SAVE TO PROPIEDADES.JSON ---
function saveProperty(property) {
  const jsonPath = path.join(ROOT, 'data', 'propiedades.json');
  const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Check if already exists
  const idx = existing.findIndex(p => p.id === property.id);
  if (idx >= 0) {
    existing[idx] = property;
    log(`Updated existing property: ${property.id}`);
  } else {
    existing.push(property);
    log(`Added new property: ${property.id}`);
  }

  fs.writeFileSync(jsonPath, JSON.stringify(existing, null, 2));
  log(`Saved to ${jsonPath} (${existing.length} total properties)`);
}

// --- MAIN ---
async function main() {
  console.log('\n\x1b[33m╔══════════════════════════════════════════╗');
  console.log('║   ALQUIMIA — Property Scraper            ║');
  console.log('╚══════════════════════════════════════════╝\x1b[0m\n');

  log(`URL: ${url}`);

  // Step 1: Scrape
  const scraped = await scrapePage(url);
  log(`Title: ${scraped.title}`);
  log(`Price: ${scraped.currency} ${scraped.price}`);
  log(`Images found: ${scraped.imageUrls.length}`);

  if (scraped.imageUrls.length === 0) {
    log('WARNING: No images found. The listing may use a different gallery structure.');
  }

  // Generate slug
  const slug = slugify(scraped.title || 'propiedad').substring(0, 50);
  log(`Slug: ${slug}`);

  // Step 2: Download images
  const downloaded = await downloadImages(scraped.imageUrls, slug);
  log(`Successfully downloaded: ${downloaded.length} images`);

  if (downloaded.length === 0) {
    log('ERROR: No images could be downloaded. Aborting.');
    process.exit(1);
  }

  // Step 3: Analyze images with Claude Vision
  const imageAnalysis = await analyzeImages(downloaded, slug);

  // Step 4: Structure the property data
  const property = await structureProperty(scraped, imageAnalysis, slug);

  // Step 5: Save
  saveProperty(property);

  console.log('\n\x1b[32m✓ Property created successfully!\x1b[0m');
  console.log(`  ID: ${property.id}`);
  console.log(`  Title: ${property.titulo}`);
  console.log(`  Price: ${property.precio_formato}`);
  console.log(`  Images: ${downloaded.length}`);
  console.log(`  View: propiedad.html?id=${property.id}\n`);
}

main().catch(e => {
  console.error('\x1b[31mERROR:\x1b[0m', e.message);
  process.exit(1);
});
