# Random Wallpaper Server

A simple, self-hosted HTTP service that serves **random wallpaper images** from a local directory tree, with on-the-fly resizing and format conversion.

---

## Features

- **Random image routing** — pick a random image from the entire `images/` tree, or narrow it down to a specific subfolder.
- **Nested folder support** — e.g. `/nature/forest` returns a random image from `images/nature/forest/`.
- **On-the-fly resizing** — resize via query parameters (`w`, `h`, `fit`, `format`) using Sharp (Node) or Pillow (Python test server).
- **Format conversion** — output as JPEG, PNG, WebP, AVIF, and more.
- **Fast path** — when no resize parameters are provided, the original file is streamed directly without any image processing.
- **In-memory file cache** — file listings are cached to avoid re-scanning the filesystem on every request (TTL configurable via `CACHE_TTL_MS`).
- **Path traversal protection** — requests cannot escape the `images/` root folder.
- **Configurable via environment variables** — port, image root path, cache TTL.
- **Docker & Docker Compose** — ship and deploy with a single command.
- **Lightweight Python test version** — a minimal Flask+Pillow server for quick local testing on Windows without Node.js.

---

## Project Structure

```
random-wallpaper-server/
├── server.js                  # Node.js / Express main server (production)
├── download_test_images.py    # Helper: download free test images from picsum.photos
├── package.json
├── Dockerfile
├── docker-compose.yml
└── images/
    ├── landscape/
    ├── nature/
    └── ...                    # Add your own folders here
```

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Place your images under ./images/, e.g.:
#    images/landscape/photo1.jpg
#    images/nature/forest/image2.png

# 2. Build and start
docker-compose up -d

# 3. Open in browser or curl
curl http://localhost:3000/ -o random.jpg
```

---

### Option B — Manual Node.js

```bash
# 1. Install dependencies
npm install

# 2. Drop your images into ./images/

# 3. Start the server
node server.js
# or
npm start

# Server listens on http://localhost:3000
```

---

## API Usage

All endpoints return an image file with `Content-Type` set to the output format.

### Get a random image from the entire library

```bash
curl http://localhost:3000/ -o random.jpg
```

### Get a random image from a specific folder

```bash
curl http://localhost:3000/landscape -o random.jpg
```

### Get a random image from a nested subfolder

```bash
curl http://localhost:3000/nature/forest -o random.jpg
```

### Resize: specify width only (height auto-calculated)

```bash
curl "http://localhost:3000/landscape?w=800" -o random.jpg
```

### Resize: specify width and height

```bash
curl "http://localhost:3000/nature?w=800&h=600" -o random.jpg
```

### Resize: change the fit mode

Supported modes: `cover` (default), `contain`, `fill`, `inside`, `outside`

```bash
curl "http://localhost:3000/nature?w=800&h=600&fit=contain" -o random.jpg
```

### Convert format (e.g. to PNG)

```bash
curl "http://localhost:3000/landscape?w=800&format=png" -o random.png
```

### Resize + fit + format combined

```bash
curl "http://localhost:3000/abstract?w=1920&h=1080&fit=cover&format=webp" -o wallpaper.webp
```

### List: list folders and images

```bash
curl "http://localhost:3000/list"
```

---

## Environment Variables

### Node.js / Docker version (`server.js`)

| Variable           | Default      | Description                                                                 |
|--------------------|--------------|-----------------------------------------------------------------------------|
| `PORT`             | `3000`       | TCP port the server listens on                                              |
| `IMAGES_ROOT`      | `./images`   | Root directory containing image subfolders                                  |
| `CACHE_TTL_MS`     | `60000`      | Time-to-live for the in-memory file listing cache, in milliseconds (default 1 min) |

---

## Populating Test Images

If you need sample images to test the server without populating the `images/` folder manually, run the included downloader:

```bash
pip install requests
python download_test_images.py
```

This fetches random royalty-free images from [picsum.photos](https://picsum.photos) and saves them into:

```
images/
├── landscape/   (5 images)
├── nature/      (5 images)
└── abstract/    (3 images)
```

No API key is required.

---

## Notes & Limitations

- **Cache TTL** — File listings are cached in memory for `CACHE_TTL_MS` to avoid repeated filesystem scans. If you frequently add or remove images, set this to a lower value or restart the server.
- **Path traversal protection** — The server resolves and validates all paths to ensure they stay within the configured `images/` root. Attempts to escape via `../` are rejected with a `400` response.
- **Max resize dimension** — Individual width and height are capped at **4000 px** to prevent resource exhaustion. Requests exceeding this limit are clamped to the cap.
- **Fast path** — When no resize parameters (`w`, `h`) are present in the query string, the original image file is streamed directly without any image-processing pipeline, making the response significantly faster.
- **Supported input formats** — `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif`.

---

## License

MIT License

*(c) kanzuke*
