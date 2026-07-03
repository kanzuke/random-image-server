const express = require('express');
const path = require('path');
const sharp = require('sharp');
const { glob } = require('glob');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const IMAGES_ROOT = process.env.IMAGES_ROOT || path.join(__dirname, 'images');

// Extensions d'images supportées
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const EXT_PATTERN = `**/*.{${IMAGE_EXTENSIONS.join(',')}}`;

// Cache simple pour éviter de re-scanner le filesystem à chaque requête
const cache = {
  data: new Map(),
  ttl: parseInt(process.env.CACHE_TTL_MS || '60000', 10), // 1 min par défaut
};

async function listImages(subfolder = '') {
  const cacheKey = subfolder || '__root__';
  const now = Date.now();
  const cached = cache.data.get(cacheKey);

  if (cached && (now - cached.timestamp) < cache.ttl) {
    return cached.files;
  }

  const targetDir = path.join(IMAGES_ROOT, subfolder);

  // Sécurité : empêcher de sortir du dossier IMAGES_ROOT (path traversal)
  const resolvedTarget = path.resolve(targetDir);
  const resolvedRoot = path.resolve(IMAGES_ROOT);
  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error('INVALID_PATH');
  }

  if (!fs.existsSync(resolvedTarget)) {
    throw new Error('FOLDER_NOT_FOUND');
  }

  const files = await glob(EXT_PATTERN, {
    cwd: resolvedTarget,
    nocase: true,
    absolute: true,
  });

  cache.data.set(cacheKey, { files, timestamp: now });
  return files;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseResizeParams(query) {
  const width = query.w || query.width;
  const height = query.h || query.height;

  const parsedWidth = width ? parseInt(width, 10) : null;
  const parsedHeight = height ? parseInt(height, 10) : null;

  // Limites de sécurité pour éviter les abus (ex: /image?w=999999999)
  const MAX_DIMENSION = 4000;

  return {
    width: parsedWidth && parsedWidth > 0 && parsedWidth <= MAX_DIMENSION ? parsedWidth : null,
    height: parsedHeight && parsedHeight > 0 && parsedHeight <= MAX_DIMENSION ? parsedHeight : null,
  };
}

async function serveRandomImage(req, res, subfolder) {
  try {
    const files = await listImages(subfolder);

    if (files.length === 0) {
      return res.status(404).json({ error: 'No images found in this folder' });
    }

    const chosenFile = pickRandom(files);
    const { width, height } = parseResizeParams(req.query);

    // Format de sortie (optionnel, via ?format=webp par ex.)
    const format = req.query.format;

    if (!width && !height && !format) {
      // Pas de transformation demandée -> on stream le fichier directement (rapide)
      return res.sendFile(chosenFile);
    }

    // Transformation à la volée avec sharp
    let pipeline = sharp(chosenFile).resize(width, height, {
      fit: req.query.fit || 'cover', // cover, contain, fill, inside, outside
      withoutEnlargement: req.query.enlarge !== 'true',
    });

    if (format && ['jpeg', 'jpg', 'png', 'webp', 'avif'].includes(format)) {
      pipeline = pipeline.toFormat(format === 'jpg' ? 'jpeg' : format);
      res.type(format === 'jpg' ? 'jpeg' : format);
    } else {
      // Garde le format d'origine
      const ext = path.extname(chosenFile).slice(1).toLowerCase();
      res.type(ext === 'jpg' ? 'jpeg' : ext);
    }

    const buffer = await pipeline.toBuffer();
    res.send(buffer);

  } catch (err) {
    if (err.message === 'FOLDER_NOT_FOUND') {
      return res.status(404).json({ error: `Folder '${subfolder}' not found` });
    }
    if (err.message === 'INVALID_PATH') {
      return res.status(400).json({ error: 'Invalid path' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Fonction récursive pour parcourir l'arborescence
function walkDirectory(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const relativePath = path.relative(baseDir, dir);

  const images = entries
    .filter((e) => e.isFile() && IMAGE_EXTENSIONS.includes(path.extname(e.name).toLowerCase().slice(1)))
    .map((e) => e.name)
    .sort();

  const subfolders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const node = {
    path: relativePath || "/",
    images,
    imageCount: images.length,
    children: [],
  };

  for (const sub of subfolders) {
    node.children.push(walkDirectory(path.join(dir, sub), baseDir));
  }

  return node;
}

// Génère le HTML récursivement sous forme de listes imbriquées
function renderTree(node) {
  let html = `<li><strong>${node.path}</strong> <span class="count">(${node.imageCount} image${node.imageCount !== 1 ? "s" : ""})</span>`;

  if (node.images.length > 0) {
    html += `<ul class="images">`;
    for (const img of node.images) {
      html += `<li>${img}</li>`;
    }
    html += `</ul>`;
  }

  if (node.children.length > 0) {
    html += `<ul class="folders">`;
    for (const child of node.children) {
      html += renderTree(child);
    }
    html += `</ul>`;
  }

  html += `</li>`;
  return html;
}

// GET /list ou /list?folder=landscape
app.get("/list", (req, res) => {
  const subfolder = req.query.folder || "";
  const targetDir = path.resolve(IMAGES_ROOT, subfolder);

  if (!targetDir.startsWith(IMAGES_ROOT)) {
    return res.status(400).send("Invalid path");
  }

  if (!fs.existsSync(targetDir)) {
    return res.status(404).send(`Folder '${subfolder}' not found`);
  }

  const tree = walkDirectory(targetDir);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Wallpaper Library</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 700px;
      margin: 40px auto;
      padding: 0 20px;
      color: #222;
      background: #fafafa;
    }
    h1 {
      font-size: 1.4rem;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
    }
    ul {
      list-style: none;
      padding-left: 1.2rem;
    }
    ul.folders > li {
      margin-top: 6px;
    }
    ul.images li {
      color: #555;
      font-size: 0.9rem;
    }
    .count {
      color: #888;
      font-weight: normal;
      font-size: 0.85rem;
    }
    strong {
      color: #000;
    }
  </style>
</head>
<body>
  <h1>📁 Wallpaper Library</h1>
  <ul>
    ${renderTree(tree)}
  </ul>
</body>
</html>
  `.trim();

  res.type("html").send(html);
});


// Route racine : image aléatoire dans TOUT l'arbre
app.get('/', (req, res) => serveRandomImage(req, res, ''));

// Route pour un sous-dossier spécifique (supporte aussi les sous-sous-dossiers)
// ex: /landscape, /landscape/mountains, etc.
app.get(/^\/(.+)$/, (req, res) => {
  const subfolder = req.params[0];
  // On ignore les requêtes de favicon et autres bruits classiques du navigateur
  if (subfolder === 'favicon.ico') return res.status(404).end();
  serveRandomImage(req, res, subfolder);
});

// Endpoint santé (utile pour Docker healthcheck)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Random wallpaper server running on port ${PORT}`);
  console.log(`Serving images from: ${IMAGES_ROOT}`);
});
