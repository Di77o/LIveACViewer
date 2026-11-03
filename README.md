# LiveAC Studio

Photograph a room, choose an LG indoor air conditioner, and preview where it could sit on your wall. The app runs in your browser and includes a six-design LG starter collection, manual placement, a four-corner wall plane for perspective, approximate sizing, and JPEG export. Optional AI can suggest a wall plane and an aesthetic position for you to review.

The simplest way to run the **full application on your PC** is Docker. You do not need to install Node.js for this option.

## Start on your PC with Docker

### 1. Install the prerequisites

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows or macOS, then start it. Use Linux containers on Windows. On Linux, install Docker Engine and the Docker Compose plugin.
- Install [Git](https://git-scm.com/downloads) if you want to use the clone/update commands below. Alternatively, open this repository on GitHub, choose **Code → Download ZIP**, extract it, and open a terminal in the extracted folder.

### 2. Download the project

In PowerShell, Terminal, or your Linux shell:

```sh
git clone https://github.com/Di77o/LIveACViewer.git
cd LIveACViewer
```

If you downloaded a ZIP, use the extracted project folder instead. It must contain `compose.yaml` and `Dockerfile`.

### 3. Build and start

```sh
docker compose up --build -d
```

The first build downloads Node.js and the locked dependencies. Later starts reuse the built image. Open this address in Google Chrome:

**http://localhost:3001**

You can now upload a room photo, mark the wall, place a unit, and save a preview. These tools work without an AI key.

### 4. Check, stop, or update

```sh
# Check whether the app is healthy
docker compose ps

# Read startup messages
docker compose logs --tail=100 liveac

# Stop and remove the app container
docker compose down

# After downloading newer code with Git
git pull
docker compose up --build -d
```

Docker binds the app to your PC only by default. The browser session holds your photo and current editing choices; **save a JPEG before closing or reloading**. The app does not store uploaded photos in a server database or persistent Docker volume.

## Use a wall plane for a better fit

A flat overlay cannot follow a photographed wall's perspective. The wall-plane tool maps a rectangle onto the four corners you identify in the photo, then projects the indoor unit onto that plane.

1. Take a clear photo that includes the wall's top and side edges. A reasonably straight-on photo makes editing easier.
2. Upload the photo and define the wall using its **top-left, top-right, bottom-right, then bottom-left** corners. Choose corners on the same flat wall, even if you need to estimate a partially hidden boundary.
3. Review and adjust the corners. If AI wall detection is connected, treat its detected corners as a starting point, not a survey.
4. Enter the approximate real wall dimensions. These help the app scale the selected unit on the plane.
5. Drag the unit, compare models, and save your preferred preview.

The recommended first approach is **manual corner confirmation with optional AI assistance**. It is predictable, works without cloud services, and lets you correct the common mistakes image models make around windows, mirrors, furniture and multiple walls. A single photo cannot establish true wall depth, hidden services, or installation feasibility. This is a 2D projective preview, not calibrated 3D or measured augmented reality.

For a later version, a guided camera capture with a known reference measurement would improve scale. Live AR can be useful on supported devices, but should remain optional because browser and iPhone support varies.

## Enable optional AI wall detection and placement

AI requires an OpenAI API key and an Internet connection. API use can incur provider charges. The website and Docker setup do not include a key.

Create a local settings file. On **Windows PowerShell**:

```powershell
Copy-Item .env.example .env
notepad .env
```

On **macOS/Linux**:

```sh
cp .env.example .env
# Open .env in your preferred text editor.
```

In that local file, set:

```dotenv
AC_OPENAI_API_KEY=your-own-key
AC_OPENAI_MODEL=gpt-4.1-mini
```

Keep the real key in `.env` on your PC or in secure hosting settings. `.env` is excluded from Git and the Docker build context. Never put the key in frontend code, a GitHub commit, screenshots or chat.

Apply the changed settings:

```sh
docker compose up -d --force-recreate
```

Compose reads `.env` and passes the selected settings to the API container. The app asks for consent before sending a room photo to OpenAI. Photos are resized and re-encoded in the browser, and the API neither stores nor logs them. The provider's own data-processing policies apply. You review AI results before applying them; AI never silently approves an installation.

`GET /api/health` reports `aiConfigured`, which means a key is present—not that the provider has accepted it. Without a usable key, the app keeps the manual tools available and reports that AI is unavailable.

## Docker settings and troubleshooting

- **Docker cannot connect to the daemon:** start Docker Desktop and wait until its engine is running. `docker version` should show both client and server information.
- **Port 3001 is already in use:** copy `.env.example` to `.env`, change `LIVEAC_PORT=3002`, then run `docker compose up -d`. Open `http://localhost:3002`.
- **The page does not load:** run `docker compose ps` and `docker compose logs --tail=100 liveac`. Confirm you are using the same local port selected in `.env`.
- **AI is unavailable:** check that `AC_OPENAI_API_KEY` is set locally, recreate the container, and review the app's error. An API billing, model-access or authentication problem requires correcting the provider configuration.
- **Updates do not appear:** run `git pull`, then `docker compose up --build -d`; refresh Chrome after the new container starts.

The image uses Node.js 24, a build stage and a nonroot runtime. Compose runs it with a read-only filesystem, a temporary `/tmp`, and a health check. Ordinary Docker Desktop builds need no special proxy settings. Managed cloud builds may supply a trusted proxy CA using the optional BuildKit `proxy_ca` secret; it is used only during verified dependency installation and is not copied into the image.

### Open it from an iPhone

`localhost` on an iPhone refers to the phone, not your PC. For an optional connection over a trusted home network, set `LIVEAC_BIND_ADDRESS=0.0.0.0` in your PC's `.env`, recreate the container, and use `http://YOUR-PC-LAN-IP:3001` on the phone. Your PC firewall must allow that local connection. Return the bind address to `127.0.0.1` when you only need PC access.

Use HTTPS hosting for reliable iPhone camera and share support; ordinary HTTP LAN access can have browser restrictions. You can still choose an existing photo where the browser permits it. Physical iPhone Safari camera/share behavior needs device testing.

## Run without Docker

Install Node.js **24.5 or newer** and npm:

```sh
npm ci
npm run dev
```

The development UI runs on port **5173** and proxies `/api` to port **3001**. Use the existing checkout; cloud tasks are already isolated and do not need a Git worktree.

For a production build:

```sh
npm run build
npm start
```

The Express server serves both `dist/` and `/api` on `PORT` (default 3001). Outside Compose, the server reads injected process variables and does not automatically load `.env`. To load a local file with Node 24:

```sh
node --env-file=.env --import tsx server/index.ts
```

Cloud startup scripts enable Node's environment-proxy support and preserve inherited CA trust. A managed environment can bind `AC_OPENAI_API_KEY` as a proxy-backed secret for `api.openai.com`; reuse that binding rather than copying a key into source files. Processes must restart in a fresh task. Publishing a cloud-environment snapshot and deploying a public website are separate operations.

## GitHub and free static hosting

A GitHub Pages workflow is included in `.github/workflows/deploy-pages.yml`. It builds the public static edition from `main` and deploys to the `github-pages` environment.

The current GitHub integration returned **HTTP 403** when asked to enable Pages automatically. A repository administrator can enable it in **Settings → Pages → Build and deployment → Source → GitHub Actions**, then open **Actions → Deploy LiveAC Studio to GitHub Pages → Run workflow**. No successful public deployment is claimed until the workflow completes and its reported site URL is checked.

GitHub Pages is free static hosting: photo editing, wall-plane projection and JPEG export work there, but the Node API cannot run on Pages. Optional AI needs the full Docker/Node version or a separately hosted API. The Sites connector did not expose callable deployment tools during implementation.

To build the static edition yourself:

```sh
npm run build:pages
```

This produces `exports/hosted/index.html` with images and fonts embedded, so it works under the repository subpath. No API key is embedded and photos are not automatically uploaded.

## Standalone HTML download

```sh
npm run build:local
```

Open the generated `exports/LiveAC-Studio.html` in ordinary desktop Chrome. It contains the app, fonts, sample room and product photos, and supports manual editing/export without a server or Internet connection. AI is explicitly unavailable in this edition. The downloadable ZIP also includes opening instructions in `START-HERE.txt`.

The managed cloud browser blocks direct `file://` navigation by administrator policy. The standalone test loads the exact generated HTML into an offline browser page instead; it does not bypass that policy. Run `node scripts/test-standalone.mjs` to check the embedded assets and local interactions.

## LG catalog, scale and sources

Six starter families are sourced from official LG regional pages and the 2026 RAC brochure. Five have Belgian product listings; ARTCOOL AI Matt Black is listed in the Netherlands, with Belgian availability explicitly unverified. This is not an exhaustive list of new Belgian SKUs or stock. Dimensions refer to the cited variants and may differ across capacity/SKU.

See `src/data/catalog.ts` and `public/models/SOURCES.md` for source links, dates, dimensions and market notes. Official product photos appear in the picker; wall overlays and exported previews use transparent **illustrative SVG front views**, not exact manufacturer renders.

A qualified installer must determine feasibility, manufacturer clearances, wall construction, pipe/drain routes, room suitability and the final position. The app provides visual planning support only.

Sample room photo: [Unsplash](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0). Fonts: DM Sans and Manrope, self-hosted through Fontsource under their included OFL licenses. LG product imagery and trademarks belong to their owners; LiveAC is independent.

## Development checks

```sh
npm run build
npm test
npm run test:e2e
```

Tests cover photo validation, API request/response handling with a mocked provider, missing AI configuration, plane geometry, placement and browser interactions. Browser tests use system Chromium at `/usr/bin/chromium`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use another installed Chromium. They start the development servers automatically unless those are already running.

Desktop and iPhone-sized Chromium viewports are covered. Mocked AI tests do not establish live provider readiness. Live OpenAI calls require a configured credential; physical iPhone camera/share behavior needs device testing. The app keeps uploaded photos in memory for the editing session and does not persist them in a database.
