import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.join(__dirname, "web");

// Simple, zero-dependency .env loader (runs even without node --env-file)
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn("Could not read .env file:", err.message);
  }
}

loadEnv();

const PORT = Number(process.env.PORT) || 8780;
const HOST = "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

// In-memory cache for TMDB responses (1 hour TTL)
const tmdbCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300"
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { ok: false, error: message });
}

async function handleTMDBMovie(movieId, res) {
  const apiKey = (process.env.TMDB_API_KEY || "").trim();
  const token = (process.env.TMDB_READ_ACCESS_TOKEN || "").trim();

  if (!apiKey && !token) {
    return sendJson(res, 200, {
      ok: false,
      configured: false,
      message: "TMDB API credentials are not set in .env. Falling back to default artwork."
    });
  }

  // Check cache
  const cached = tmdbCache.get(movieId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return sendJson(res, 200, { ok: true, configured: true, ...cached.data });
  }

  try {
    const url = new URL(`https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}`);
    url.searchParams.set("append_to_response", "credits,videos");
    if (!token && apiKey) {
      url.searchParams.set("api_key", apiKey);
    }

    const headers = { Accept: "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
      const errText = await response.text();
      return sendError(res, response.status, `TMDB API error (${response.status}): ${errText}`);
    }

    const json = await response.json();

    // Select best trailer: Official YouTube Trailer > Teaser > Any YouTube video
    let trailer = null;
    if (json.videos && Array.isArray(json.videos.results)) {
      const ytVideos = json.videos.results.filter(v => v.site === "YouTube");
      const officialTrailer = ytVideos.find(v => v.type === "Trailer" && v.official) ||
                              ytVideos.find(v => v.type === "Trailer") ||
                              ytVideos.find(v => v.type === "Teaser") ||
                              ytVideos[0];
      if (officialTrailer) {
        trailer = {
          name: officialTrailer.name,
          key: officialTrailer.key,
          embedUrl: `https://www.youtube-nocookie.com/embed/${officialTrailer.key}?autoplay=1&rel=0`
        };
      }
    }

    // Top 4 cast members with profile images
    const cast = (json.credits?.cast || []).slice(0, 4).map(member => ({
      id: member.id,
      name: member.name,
      character: member.character,
      profileUrl: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : null
    }));

    const movieData = {
      tmdbId: json.id,
      title: json.title,
      tagline: json.tagline,
      overview: json.overview,
      releaseDate: json.release_date,
      posterUrl: json.poster_path ? `https://image.tmdb.org/t/p/w500${json.poster_path}` : null,
      backdropUrl: json.backdrop_path ? `https://image.tmdb.org/t/p/w1280${json.backdrop_path}` : null,
      runtime: json.runtime,
      voteAverage: json.vote_average,
      cast,
      trailer
    };

    tmdbCache.set(movieId, { data: movieData, timestamp: Date.now() });
    return sendJson(res, 200, { ok: true, configured: true, ...movieData });
  } catch (err) {
    return sendError(res, 502, `Failed to query TMDB: ${err.message}`);
  }
}

function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method Not Allowed");
  }

  const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  // Prevent directory traversal
  const safePath = path.normalize(path.join(WEB_ROOT, pathname));
  if (!safePath.startsWith(WEB_ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end("Forbidden");
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found");
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });

    if (req.method === "HEAD") return res.end();

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = parsedUrl.pathname;

  // TMDB Proxy route: /api/tmdb/movie/:id
  if (pathname.startsWith("/api/tmdb/movie/")) {
    const movieId = pathname.replace("/api/tmdb/movie/", "").trim();
    if (!movieId) return sendError(res, 400, "Missing TMDB movie ID");
    return handleTMDBMovie(movieId, res);
  }

  // Health/status route
  if (pathname === "/api/tmdb/status") {
    const apiKey = Boolean((process.env.TMDB_API_KEY || "").trim());
    const token = Boolean((process.env.TMDB_READ_ACCESS_TOKEN || "").trim());
    return sendJson(res, 200, {
      ok: true,
      configured: apiKey || token
    });
  }

  // Static site delivery
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🎬 CineVerse Cinema Server running at:`);
  console.log(`   http://${HOST}:${PORT}/index.html`);
  console.log(`======================================================\n`);
  const configured = Boolean((process.env.TMDB_API_KEY || "").trim() || (process.env.TMDB_READ_ACCESS_TOKEN || "").trim());
  if (configured) {
    console.log(`✔ TMDB API credentials detected. Real posters & trailers enabled.`);
  } else {
    console.log(`ℹ TMDB credentials not set in .env yet.`);
    console.log(`  The site is running with built-in fallback artwork.`);
    console.log(`  Add your TMDB_API_KEY to .env to see real posters & trailers.`);
  }
});

