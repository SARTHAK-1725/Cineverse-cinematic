const STORAGE_KEY = "cineverse-demo-v1";
const SEAT_ROWS = ["A", "B", "C", "D", "E"];
const SEATS_PER_ROW = 8;
const RECLINER_ROWS = ["E"];
const RECLINER_SURCHARGE = 180;
const MOVIE_TONES = ["teal", "rose", "blue", "violet", "gold", "green"];
const NAV_LINKS = [
  { id: "movies", href: "index.html#now-showing", label: "Movies" },
  { id: "cinemas", href: "cinemas.html", label: "Cinemas" },
  { id: "ai-finder", href: "lounge.html#mood-picks", label: "AI Movie Finder" },
  { id: "group-booking", href: "lounge.html#group-booking", label: "Group Booking" },
  { id: "rewards", href: "bookings.html#rewards", label: "Rewards" },
  { id: "bookings", href: "bookings.html#history", label: "My Bookings" }
];

const movieGrid = document.querySelector("#movie-grid");
const movieCount = document.querySelector("#movie-count");
const moviePoster = document.querySelector("#movie-poster");
const movieMeta = document.querySelector("#movie-meta");
const movieDescription = document.querySelector("#movie-description");
const moviePrice = document.querySelector("#movie-price");
const seatGrid = document.querySelector("#seat-grid");
const seatCount = document.querySelector("#seat-count");
const customerInput = document.querySelector("#customer-name");
const bookButton = document.querySelector("#book-button");
const statusMessage = document.querySelector("#status-message");
const historyBody = document.querySelector("#history-body");
const bookingPanel = document.querySelector(".booking-panel");
const selectedSeats = new Set();

let state;
let selectedMovieId = MOVIES[0].id;
let selectedCinemaId = CINEMAS[0].id;
let selectedFormat = "2D";
let selectedShowtime = FEATURE_SHOWTIMES[2];
let selectedOfferId = "";
let featuredMovieIndex = 0;
let storageAvailable = true;
let searchQuery = "";
let genreFilter = "all";

function pageName() {
  return document.body.dataset.page || "home";
}

function emptyState() {
  return {
    bookings: sampleBookings(),
    users: [],
    session: null,
    wallet: { points: 120, credit: 0, ledger: [{ label: "Welcome bonus", points: 120, at: new Date().toISOString() }] },
    groupRequests: [],
    privateRequests: [],
    planner: null
  };
}

function sampleBookings() {
  const now = Date.now();
  return [
    { id: "CV-1048", movieId: "last-light", cinemaId: "raj-mandir", format: "2D", showtime: "7:45 pm", customer: "Maya Chen", seats: ["A2", "A3"], total: 640, offerId: "", createdAt: new Date(now - 172800000).toISOString(), showAt: new Date(now + 86400000).toISOString() },
    { id: "CV-1047", movieId: "paper-moons", cinemaId: "pvr-wtp", format: "3D", showtime: "5:30 pm", customer: "Arjun Rao", seats: ["C5"], total: 378, offerId: "", createdAt: new Date(now - 86400000).toISOString(), showAt: new Date(now + 3600000 * 30).toISOString() },
    { id: "CV-1046", movieId: "quiet-orbit", cinemaId: "pvr-wtp", format: "IMAX", showtime: "9:50 pm", customer: "Noah Williams", seats: ["E1", "E2"], total: 1428, offerId: "", createdAt: new Date(now - 18000000).toISOString(), showAt: new Date(now + 3600000 * 6).toISOString() }
  ];
}

function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      const initialState = emptyState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      storageAvailable = true;
      return initialState;
    }
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.bookings)) throw new Error("Saved demo data is invalid.");
    storageAvailable = true;
    return {
      ...emptyState(),
      ...parsed,
      wallet: parsed.wallet || emptyState().wallet
    };
  } catch (error) {
    storageAvailable = false;
    return emptyState();
  }
}

function saveState(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    state = nextState;
    storageAvailable = true;
    return true;
  } catch (error) {
    storageAvailable = false;
    showStatus("Browser storage is unavailable. This change was not saved.", true);
    if (movieGrid) updateSummary();
    return false;
  }
}

function currentMovie() {
  return MOVIES.find(movie => movie.id === selectedMovieId) || MOVIES[0];
}

function currentCinema() {
  return CINEMAS.find(cinema => cinema.id === selectedCinemaId) || CINEMAS[0];
}

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.round(amount)));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function showStatus(message, isError = false) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function parseShowtime(label) {
  const match = label.match(/(\d+):(\d+)\s*(am|pm)/i);
  if (!match) return 19;
  let hours = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hours += 12;
  return hours + Number(match[2]) / 60;
}

function dynamicMultiplier(showtime = selectedShowtime) {
  const hour = parseShowtime(showtime);
  const weekend = [0, 6].includes(new Date().getDay());
  let factor = 1;
  if (hour >= 18) factor += 0.12;
  if (weekend) factor += 0.08;
  return factor;
}

function formatBasePrice(movie, format) {
  const info = FORMAT_INFO[format] || FORMAT_INFO["2D"];
  return Math.round(movie.price * info.multiplier);
}

function seatUnitPrice(seatName, movie = currentMovie()) {
  const recliner = RECLINER_ROWS.includes(seatName.charAt(0)) ? RECLINER_SURCHARGE : 0;
  return Math.round((formatBasePrice(movie, selectedFormat) + recliner) * dynamicMultiplier());
}

function seatsTotal(seats, movie = currentMovie()) {
  return seats.reduce((sum, seat) => sum + seatUnitPrice(seat, movie), 0);
}

function applyOffer(total, seats, offerId) {
  const offer = OFFERS.find(item => item.id === offerId);
  if (!offer) return { total, discount: 0, offer };
  if (total < offer.min) return { total, discount: 0, offer };
  if (offer.minSeats && seats.length < offer.minSeats) return { total, discount: 0, offer };
  if (offer.firstOnly && state.bookings.some(booking => booking.customer === (state.session?.name || customerInput?.value.trim()))) {
    return { total, discount: 0, offer };
  }
  return { total: Math.max(0, total - offer.amount), discount: offer.amount, offer };
}

function showKey() {
  return `${selectedMovieId}|${selectedCinemaId}|${selectedFormat}|${selectedShowtime}`;
}

function bookedSeatsFor(key = showKey(), bookings = state.bookings) {
  const booked = new Set();
  for (const booking of bookings) {
    const bookingKey = `${booking.movieId}|${booking.cinemaId || ""}|${booking.format || "2D"}|${booking.showtime || ""}`;
    if (bookingKey === key || (!booking.cinemaId && booking.movieId === selectedMovieId)) {
      booking.seats.forEach(seat => booked.add(seat));
    }
  }
  return booked;
}

function isNavLinkActive(link, activePage) {
  if (activePage === "home" && link.id === "movies") return true;
  if (activePage === "cinemas" && link.id === "cinemas") return true;
  if (activePage === "lounge") {
    if (window.location.hash === "#group-booking") return link.id === "group-booking";
    return link.id === "ai-finder";
  }
  if (activePage === "bookings") {
    if (window.location.hash === "#rewards") return link.id === "rewards";
    return link.id === "bookings";
  }
  return false;
}

function updateNavBookingCount() {
  const badge = document.querySelector("#nav-booking-count");
  if (badge) badge.textContent = String(state.bookings.length);
  const walletBadge = document.querySelector("#nav-points");
  if (walletBadge) walletBadge.textContent = `${state.wallet.points} pts`;
  const sessionSpan = document.querySelector("#nav-session span");
  if (sessionSpan) {
    sessionSpan.textContent = state.session ? state.session.name.split(" ")[0] : "Sign in";
  } else {
    const sessionLabel = document.querySelector("#nav-session");
    if (sessionLabel) sessionLabel.textContent = state.session ? state.session.name.split(" ")[0] : "Sign in";
  }
}

function mountChrome() {
  const header = document.querySelector("#app-header");
  const footer = document.querySelector("#app-footer");
  const active = pageName();
  if (header) {
    header.innerHTML = `
      <a class="wordmark" href="index.html" aria-label="CineVerse home">
        <span class="mark">C</span>
        <span class="brand-text">CINEVERSE <small>CINEMATIC</small></span>
      </a>
      <nav id="primary-nav" class="primary-nav" aria-label="Primary navigation">
        ${NAV_LINKS.map(link => `<a href="${link.href}" class="nav-item ${isNavLinkActive(link, active) ? 'active' : ''}" ${isNavLinkActive(link, active) ? 'aria-current="page"' : ''}>${link.label}</a>`).join("")}
      </nav>
      <div class="header-actions">
        <a class="rewards-pill" href="bookings.html#rewards" title="Rewards wallet balance">
          <span class="rewards-icon" aria-hidden="true">✦</span>
          <span id="nav-points" class="rewards-points-text">${state ? state.wallet.points : 120} pts</span>
        </a>
        <a class="ghost-link session-pill" href="account.html" id="nav-session" aria-label="User account">
          <svg class="session-icon" aria-hidden="true" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3"/><path d="M2.5 14a5.5 5.5 0 0 1 11 0"/></svg>
          <span>${state && state.session ? state.session.name.split(" ")[0] : "Sign in"}</span>
        </a>
        <a class="history-link" href="bookings.html#history" ${active === "bookings" ? 'aria-current="page"' : ""} aria-label="View bookings">
          <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2a1.5 1.5 0 0 0 0 3v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a1.5 1.5 0 0 0 0-3V5z"/></svg>
          <span class="history-text">Tickets</span>
          <span id="nav-booking-count" class="booking-count">${state ? state.bookings.length : 0}</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Toggle navigation menu">
          <span class="nav-toggle-icon"></span>
        </button>
      </div>`;
    header.querySelector(".nav-toggle")?.addEventListener("click", event => {
      const open = header.classList.toggle("nav-open");
      event.currentTarget.setAttribute("aria-expanded", String(open));
    });
  }
  if (footer) {
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="wordmark" href="index.html"><span class="mark">C</span><span class="brand-text">CINEVERSE <small>CINEMATIC EXPERIENCE</small></span></a>
            <p class="footer-desc">Experience luxury cinema booking with a premium dark aesthetic. Precision auditorium seat selection, AI-powered movie curation, and seamless ticket management.</p>
          </div>
          <div class="footer-links-grid">
            <div class="footer-nav-col">
              <span class="footer-col-title">EXPLORE</span>
              <a href="index.html#now-showing">Now Showing</a>
              <a href="cinemas.html">Cinemas</a>
              <a href="lounge.html#mood-picks">AI Movie Finder</a>
              <a href="lounge.html#group-booking">Group Booking</a>
            </div>
            <div class="footer-nav-col">
              <span class="footer-col-title">MEMBERSHIP</span>
              <a href="bookings.html#rewards">Rewards Wallet</a>
              <a href="bookings.html#history">My Bookings</a>
              <a href="account.html">Account & Sign In</a>
              <a href="support.html">Concierge & FAQs</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span class="footer-copy">© CineVerse Jaipur · Cinematic Ticket Booking Simulator</span>
          <span class="footer-disclaimer">Local browser simulation. No real payments processed.</span>
        </div>
      </div>`;
  }
}

function filteredMovies() {
  return MOVIES.filter(movie => {
    const haystack = `${movie.title} ${movie.genre} ${movie.description}`.toLowerCase();
    const matchesSearch = haystack.includes(searchQuery.trim().toLowerCase());
    const matchesGenre = genreFilter === "all" || movie.genre === genreFilter;
    return matchesSearch && matchesGenre;
  });
}

const tmdbMediaCache = new Map();

async function fetchTMDBMedia(tmdbId) {
  if (!tmdbId) return null;
  if (tmdbMediaCache.has(tmdbId)) return tmdbMediaCache.get(tmdbId);
  try {
    const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ok && data.configured) {
      tmdbMediaCache.set(tmdbId, data);
      return data;
    }
  } catch {
    // If server is not running or offline, gracefully return null
  }
  return null;
}

function attachPosterImage(container, posterUrl) {
  if (!container || !posterUrl) return;
  let img = container.querySelector(".poster-image");
  if (!img) {
    img = document.createElement("img");
    img.className = "poster-image";
    img.loading = "lazy";
    img.alt = "Movie poster";
    container.appendChild(img);
  }
  img.onload = () => {
    img.classList.add("loaded");
    container.classList.add("has-real-poster");
  };
  img.onerror = () => {
    img.remove();
    container.classList.remove("has-real-poster");
  };
  img.src = posterUrl;
}

function makePoster(movie, index, className) {
  const poster = document.createElement("span");
  poster.className = className;
  poster.dataset.tone = movie.tone || MOVIE_TONES[index % MOVIE_TONES.length];
  poster.setAttribute("aria-hidden", "true");
  const halo = document.createElement("span");
  halo.className = "poster-ambient-glow";
  const kicker = document.createElement("span");
  kicker.className = "poster-kicker";
  kicker.innerHTML = `<span class="score-star">★</span> <span class="score-val">${movie.score.toFixed(1)}</span> <span class="rating-pill">${movie.rating}</span>`;
  const letter = document.createElement("span");
  letter.className = "poster-letter";
  letter.textContent = movie.title.charAt(0).toUpperCase();
  const indexLabel = document.createElement("span");
  indexLabel.className = "poster-index";
  indexLabel.textContent = movie.formats.join(" · ");
  poster.append(halo, kicker, letter, indexLabel);

  if (movie.tmdbId) {
    fetchTMDBMedia(movie.tmdbId).then(data => {
      if (data && data.posterUrl) {
        attachPosterImage(poster, data.posterUrl);
      }
    });
  }

  return poster;
}

function toYouTubeEmbedUrl(videoUrl) {
  if (!videoUrl) return "";
  const value = videoUrl.trim();
  if (!value) return "";

  const embedMatch = value.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/i);
  if (embedMatch) return `https://www.youtube-nocookie.com/embed/${embedMatch[1]}?rel=0&modestbranding=1`;

  const watchMatch = value.match(/(?:youtube\.com\/watch\?[^\s]*v=|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (watchMatch) return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}?rel=0&modestbranding=1`;

  return "";
}

async function openTrailerDialog(movie) {
  const dialog = document.querySelector("#trailer-dialog");
  const title = document.querySelector("#trailer-title");
  const copy = document.querySelector("#trailer-copy");
  const stage = document.querySelector("#trailer-stage");

  if (!dialog || !title || !copy || !stage || !movie) return;

  title.textContent = movie.title;
  stage.dataset.tone = movie.tone || "teal";
  stage.replaceChildren();
  stage.classList.remove("has-video");

  let embedUrl = toYouTubeEmbedUrl(movie.trailerUrl);
  let trailerCopy = "Official trailer unavailable for this movie right now.";

  if (!embedUrl && movie.tmdbId) {
    const data = await fetchTMDBMedia(movie.tmdbId);
    const trailer = data?.trailer;
    if (trailer?.embedUrl) {
      embedUrl = trailer.embedUrl;
    } else if (trailer?.key) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${trailer.key}?rel=0&modestbranding=1`;
    }
  }

  if (embedUrl) {
    stage.classList.add("has-video");
    const iframe = document.createElement("iframe");
    iframe.className = "trailer-iframe";
    iframe.src = embedUrl;
    iframe.title = `${movie.title} trailer`;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    stage.appendChild(iframe);
    trailerCopy = `${movie.title} · Official trailer`;
  } else {
    const emptyState = document.createElement("div");
    emptyState.className = "trailer-empty-state";
    emptyState.innerHTML = `<strong>${movie.title}</strong><p>Trailer not available right now. This demo keeps the experience working without a broken video.</p>`;
    stage.appendChild(emptyState);
  }

  copy.textContent = trailerCopy;
  dialog.showModal();
}

function renderFeaturedFilm() {
  const movie = MOVIES[featuredMovieIndex];
  const title = document.querySelector("#featured-title");
  if (!title) return;
  title.textContent = movie.title;
  document.querySelector("#featured-meta").innerHTML = `<span class="hero-genre-pill">${movie.genre}</span> <span class="hero-dot">·</span> <span>${movie.duration}</span> <span class="hero-dot">·</span> <span class="hero-cert-pill">${movie.rating}</span> <span class="hero-dot">·</span> <span class="hero-score-badge">★ ${movie.score.toFixed(1)}</span>`;
  document.querySelector("#featured-description").textContent = movie.description;
  document.querySelector("#featured-counter").textContent = `${String(featuredMovieIndex + 1).padStart(2, "0")} / ${String(MOVIES.length).padStart(2, "0")}`;
  const poster = document.querySelector("#featured-poster");
  poster.dataset.tone = movie.tone;
  poster.classList.remove("has-real-poster");
  const existingImg = poster.querySelector(".poster-image");
  if (existingImg) existingImg.remove();
  document.querySelector("#featured-poster-letter").textContent = movie.title.charAt(0).toUpperCase();
  document.querySelector("#featured-poster-index").textContent = movie.formats[0];

  const hero = document.querySelector("#feature-hero") || document.querySelector(".feature-hero");

  if (movie.tmdbId) {
    fetchTMDBMedia(movie.tmdbId).then(data => {
      if (!data) return;
      if (MOVIES[featuredMovieIndex].id !== movie.id) return;
      if (data.posterUrl) {
        attachPosterImage(poster, data.posterUrl);
      }
      if (data.backdropUrl && hero) {
        hero.style.backgroundImage = `radial-gradient(ellipse 65% 85% at 85% 50%, rgba(124, 58, 237, 0.35), transparent 75%), linear-gradient(to right, rgba(7, 7, 10, 0.96) 0%, rgba(7, 7, 10, 0.78) 50%, rgba(7, 7, 10, 0.45) 100%), url("${data.backdropUrl}")`;
      }
    });
  } else if (hero) {
    hero.style.backgroundImage = "";
  }
}

function selectMovie(movieId, syncHero = true) {
  const index = MOVIES.findIndex(movie => movie.id === movieId);
  if (index === -1) return;
  selectedMovieId = movieId;
  if (syncHero) {
    featuredMovieIndex = index;
    renderFeaturedFilm();
  }
  selectedSeats.clear();
  syncFormatToMovie();
  renderMovies();
  renderMovieDetails();
  renderBookingOptions();
  renderSeats();
  updateSummary();
  showStatus("");
}

function renderMovies() {
  if (!movieGrid) return;
  const list = filteredMovies();
  movieCount.textContent = `${list.length} FILMS`;
  movieGrid.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty-copy";
    empty.textContent = "No films match that search. Clear filters to see the full catalogue.";
    movieGrid.append(empty);
    return;
  }
  if (!list.some(movie => movie.id === selectedMovieId)) {
    selectedMovieId = list[0].id;
    syncFormatToMovie();
  }
  list.forEach((movie, index) => {
    const card = document.createElement("article");
    card.className = "movie-card";
    card.dataset.movieId = movie.id;
    card.setAttribute("aria-pressed", String(movie.id === selectedMovieId));

    const poster = makePoster(movie, MOVIES.indexOf(movie), "movie-card-poster");
    const info = document.createElement("div");
    info.className = "movie-card-info";
    const title = document.createElement("strong");
    title.className = "movie-card-title";
    title.textContent = movie.title;
    const meta = document.createElement("span");
    meta.className = "movie-card-meta";
    meta.textContent = `${movie.genre} · ${movie.duration}`;
    const price = document.createElement("span");
    price.className = "movie-card-price";
    price.textContent = `from ${formatPrice(movie.price)}`;
    info.append(title, meta, price);

    const actions = document.createElement("div");
    actions.className = "movie-card-actions";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "movie-card-select";
    selectButton.innerHTML = movie.id === selectedMovieId
      ? `<span>Selected</span> <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>`
      : `<span>Select</span> <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg>`;
    selectButton.addEventListener("click", event => {
      event.stopPropagation();
      selectMovie(movie.id, true);
    });

    const trailerButton = document.createElement("button");
    trailerButton.type = "button";
    trailerButton.className = "movie-card-trailer";
    trailerButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16"><polygon points="5,3 13,8 5,13" fill="currentColor"/></svg><span>Watch trailer</span>';
    trailerButton.addEventListener("click", event => {
      event.stopPropagation();
      openTrailerDialog(movie);
    });

    actions.append(selectButton, trailerButton);
    card.append(poster, info, actions);
    movieGrid.append(card);
  });
}

function renderMovieDetails() {
  if (!moviePoster) return;
  const movie = currentMovie();
  moviePoster.dataset.tone = movie.tone;
  moviePoster.classList.remove("has-real-poster");
  const existingPreviewImg = moviePoster.querySelector(".poster-image");
  if (existingPreviewImg) existingPreviewImg.remove();
  const kicker = moviePoster.querySelector(".poster-kicker");
  if (kicker) kicker.innerHTML = `<span class="score-star">★</span> ${movie.score.toFixed(1)} · ${movie.rating}`;
  const letter = moviePoster.querySelector(".poster-letter");
  if (letter) letter.textContent = movie.title.charAt(0).toUpperCase();
  const index = moviePoster.querySelector(".poster-index");
  if (index) index.textContent = movie.formats.join(" · ");
  movieMeta.innerHTML = `<span class="meta-genre">${movie.genre}</span> · <span>${movie.duration}</span> · <span class="meta-cert">${movie.rating}</span> · <span class="meta-score">★ ${movie.score.toFixed(1)}</span>`;
  movieDescription.textContent = movie.description;
  moviePrice.textContent = `${formatPrice(formatBasePrice(movie, selectedFormat))} ${selectedFormat} base`;

  const movieActions = document.querySelector("#movie-actions");
  if (movieActions) {
    movieActions.replaceChildren();
    const trailerButton = document.createElement("button");
    trailerButton.type = "button";
    trailerButton.className = "watch-trailer-button";
    trailerButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 16 16"><polygon points="5,3 13,8 5,13" fill="currentColor"/></svg><span>Watch trailer</span>';
    trailerButton.addEventListener("click", () => openTrailerDialog(movie));
    movieActions.append(trailerButton);
  }

  const castRow = document.querySelector("#movie-cast");
  if (castRow) castRow.replaceChildren();

  if (movie.tmdbId) {
    fetchTMDBMedia(movie.tmdbId).then(data => {
      if (!data) return;
      if (currentMovie().id !== movie.id) return;
      if (data.posterUrl) {
        attachPosterImage(moviePoster, data.posterUrl);
      }
      if (castRow && Array.isArray(data.cast) && data.cast.length) {
        castRow.replaceChildren();
        data.cast.forEach(actor => {
          const chip = document.createElement("div");
          chip.className = "actor-chip";
          chip.title = `${actor.name} as ${actor.character || "Cast"}`;
          const avatar = document.createElement("img");
          avatar.className = "actor-avatar";
          avatar.alt = actor.name;
          avatar.loading = "lazy";
          avatar.src = actor.profileUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=181530&color=A78BFA&size=64`;
          avatar.onerror = () => {
            avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=181530&color=A78BFA&size=64`;
          };
          const info = document.createElement("div");
          info.className = "actor-info";
          const strong = document.createElement("strong");
          strong.className = "actor-name";
          strong.textContent = actor.name;
          const role = document.createElement("span");
          role.className = "actor-role";
          role.textContent = actor.character || "Cast";
          info.append(strong, role);
          chip.append(avatar, info);
          castRow.append(chip);
        });
      }
    });
  }
}

function availableCinemas() {
  const movie = currentMovie();
  return CINEMAS.filter(cinema => cinema.formats.some(format => movie.formats.includes(format)));
}

function syncFormatToMovie() {
  const movie = currentMovie();
  const cinema = availableCinemas()[0] || CINEMAS[0];
  selectedCinemaId = cinema.id;
  selectedFormat = movie.formats.find(format => cinema.formats.includes(format)) || movie.formats[0];
}

function renderBookingOptions() {
  const cinemaWrap = document.querySelector("#cinema-options");
  const formatWrap = document.querySelector("#format-options");
  const showWrap = document.querySelector("#showtime-options");
  if (!cinemaWrap || !formatWrap || !showWrap) return;
  const movie = currentMovie();
  cinemaWrap.replaceChildren();
  availableCinemas().forEach(cinema => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.setAttribute("aria-pressed", String(cinema.id === selectedCinemaId));
    button.textContent = `${cinema.name.split(" ")[0]} · ${cinema.area}`;
    button.addEventListener("click", () => {
      selectedCinemaId = cinema.id;
      if (!cinema.formats.includes(selectedFormat) || !movie.formats.includes(selectedFormat)) {
        selectedFormat = cinema.formats.find(format => movie.formats.includes(format)) || "2D";
      }
      selectedSeats.clear();
      renderBookingOptions();
      renderSeats();
      updateSummary();
    });
    cinemaWrap.append(button);
  });
  formatWrap.replaceChildren();
  movie.formats.filter(format => currentCinema().formats.includes(format)).forEach(format => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.setAttribute("aria-pressed", String(format === selectedFormat));
    button.textContent = `${format} · ${formatPrice(formatBasePrice(movie, format))}`;
    button.addEventListener("click", () => {
      selectedFormat = format;
      selectedSeats.clear();
      renderBookingOptions();
      renderMovieDetails();
      renderSeats();
      updateSummary();
    });
    formatWrap.append(button);
  });
  showWrap.replaceChildren();
  FEATURE_SHOWTIMES.forEach(time => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "showtime-chip";
    button.setAttribute("aria-pressed", String(time === selectedShowtime));
    const bump = dynamicMultiplier(time) > 1 ? " · peak" : "";
    button.textContent = `${time}${bump}`;
    button.addEventListener("click", () => {
      selectedShowtime = time;
      selectedSeats.clear();
      renderBookingOptions();
      renderSeats();
      updateSummary();
    });
    showWrap.append(button);
  });
}

function renderSeats() {
  if (!seatGrid) return;
  const booked = bookedSeatsFor();
  for (const seat of [...selectedSeats]) {
    if (booked.has(seat)) selectedSeats.delete(seat);
  }
  seatCount.textContent = `${SEAT_ROWS.length * SEATS_PER_ROW} SEATS · ROW E RECLINER`;
  seatGrid.replaceChildren();
  for (const rowName of SEAT_ROWS) {
    const row = document.createElement("div");
    row.className = `seat-row ${RECLINER_ROWS.includes(rowName) ? "recliner-row" : ""}`;
    row.dataset.row = rowName;
    const rowLabel = document.createElement("span");
    rowLabel.className = "row-label";
    rowLabel.textContent = rowName;
    row.append(rowLabel);
    for (let number = 1; number <= SEATS_PER_ROW; number += 1) {
      if (number === 5) {
        const aisle = document.createElement("span");
        aisle.className = "seat-aisle";
        aisle.setAttribute("aria-hidden", "true");
        row.append(aisle);
      }
      const seatName = `${rowName}${number}`;
      const isBooked = booked.has(seatName);
      const isSelected = selectedSeats.has(seatName);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `seat ${isBooked ? "booked" : isSelected ? "selected" : "available"} ${RECLINER_ROWS.includes(rowName) ? "recliner" : ""}`;
      button.textContent = String(number);
      button.disabled = isBooked;
      button.setAttribute("aria-label", `Row ${rowName}, seat ${number}: ${isBooked ? "booked" : isSelected ? "selected" : "available"}${RECLINER_ROWS.includes(rowName) ? ", recliner" : ""}`);
      button.setAttribute("aria-pressed", String(isSelected));
      button.addEventListener("click", () => {
        if (selectedSeats.has(seatName)) selectedSeats.delete(seatName);
        else selectedSeats.add(seatName);
        renderSeats();
        updateSummary();
      });
      row.append(button);
    }
    seatGrid.append(row);
  }
}

function renderOfferSelect() {
  const select = document.querySelector("#offer-select");
  if (!select || select.dataset.ready) return;
  select.dataset.ready = "true";
  OFFERS.forEach(offer => {
    const option = document.createElement("option");
    option.value = offer.id;
    option.textContent = `${offer.id} · ${offer.label}`;
    select.append(option);
  });
  select.addEventListener("change", () => {
    selectedOfferId = select.value;
    updateSummary();
  });
}

function updateSummary() {
  if (!bookingPanel) return;
  const movie = currentMovie();
  const seats = [...selectedSeats].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  updateNavBookingCount();
  bookingPanel.classList.toggle("has-selection", seats.length > 0);
  document.querySelector("#summary-movie").textContent = `${movie.title} · ${selectedFormat}`;
  document.querySelector("#summary-show").textContent = `${currentCinema().name} · ${selectedShowtime}`;
  const seatsSummary = document.querySelector("#summary-seats");
  seatsSummary.replaceChildren();
  if (seats.length) {
    seats.forEach(seatName => {
      const chip = document.createElement("span");
      chip.className = "seat-chip";
      chip.textContent = RECLINER_ROWS.includes(seatName.charAt(0)) ? `${seatName} R` : seatName;
      seatsSummary.append(chip);
    });
  } else {
    seatsSummary.textContent = "Choose seats";
  }
  const priced = applyOffer(seatsTotal(seats), seats, selectedOfferId);
  const totalElement = document.querySelector("#summary-total");
  const totalText = formatPrice(priced.total);
  if (totalElement.textContent !== totalText) {
    totalElement.textContent = totalText;
    totalElement.classList.remove("total-change");
    void totalElement.offsetWidth;
    totalElement.classList.add("total-change");
  }
  const offerNote = document.querySelector("#offer-note");
  if (offerNote) offerNote.textContent = priced.discount ? `${priced.offer.id} saves ${formatPrice(priced.discount)}` : "Demo prices · not charged";
  document.querySelector("#ticket-number").textContent = String(state.bookings.length + 1).padStart(3, "0");
  if (state.session && customerInput && !customerInput.value) customerInput.value = state.session.name;
  bookButton.disabled = !storageAvailable || !seats.length || !customerInput.value.trim();
  bookButton.querySelector("span").textContent = seats.length > 1 ? `Book ${seats.length} tickets` : "Book ticket";
}

function refundRate(showAt) {
  const hours = (new Date(showAt) - Date.now()) / 3600000;
  if (hours > 24) return 0.9;
  if (hours > 4) return 0.5;
  return 0;
}

function renderHistory() {
  if (!historyBody) return;
  updateNavBookingCount();
  const tableWrap = historyBody.closest(".table-wrap");
  const emptyStateNode = document.querySelector("#empty-bookings-state");
  historyBody.replaceChildren();
  document.querySelector("#history-count").textContent = `${state.bookings.length} ${state.bookings.length === 1 ? "BOOKING" : "BOOKINGS"}`;
  if (!state.bookings.length) {
    tableWrap.hidden = true;
    emptyStateNode.hidden = false;
    return;
  }
  tableWrap.hidden = false;
  emptyStateNode.hidden = true;
  for (const booking of [...state.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const movie = MOVIES.find(item => item.id === booking.movieId);
    const cinema = CINEMAS.find(item => item.id === booking.cinemaId);
    const row = document.createElement("tr");
    row.className = "ticket-row";
    row.dataset.tone = movie?.tone || "violet";
    const values = [
      `#${booking.id}`,
      movie ? `${movie.title} · ${booking.format || "2D"}` : "Movie unavailable",
      `${booking.seats.join(", ")} · ${booking.showtime || "—"}`,
      formatPrice(booking.total || (movie?.price || 0) * booking.seats.length),
      cinema ? cinema.name : "Jaipur"
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const action = document.createElement("td");
    const details = document.createElement("button");
    details.type = "button";
    details.className = "view-booking";
    details.textContent = "Details";
    details.addEventListener("click", () => showBookingDetails(booking));
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel-booking";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => cancelBooking(booking.id));
    action.append(details, cancel);
    row.append(action);
    historyBody.append(row);
  }
  renderWallet();
  renderOffersPanel();
}

function showBookingDetails(booking) {
  const movie = MOVIES.find(item => item.id === booking.movieId);
  const cinema = CINEMAS.find(item => item.id === booking.cinemaId);
  const rate = refundRate(booking.showAt || booking.createdAt);
  document.querySelector("#dialog-booking-id").textContent = `#${booking.id}`;
  document.querySelector("#dialog-movie").textContent = movie ? `${movie.title} · ${booking.format}` : "Movie unavailable";
  document.querySelector("#dialog-customer").textContent = booking.customer;
  document.querySelector("#dialog-seats").textContent = `${booking.seats.join(", ")} · ${cinema?.name || "Jaipur"} · ${booking.showtime}`;
  document.querySelector("#dialog-total").textContent = formatPrice(booking.total || 0);
  document.querySelector("#dialog-date").textContent = `${formatDate(booking.createdAt)} · cancel refund ${Math.round(rate * 100)}%`;
  document.querySelector("#booking-dialog").showModal();
}

function cancelBooking(bookingId) {
  const booking = state.bookings.find(item => item.id === bookingId);
  if (!booking) return;
  const rate = refundRate(booking.showAt || booking.createdAt);
  const refund = Math.round((booking.total || 0) * rate);
  const ok = window.confirm(rate
    ? `Cancel ${booking.id}? Demo refund ${formatPrice(refund)} (${Math.round(rate * 100)}%) goes to your rewards wallet. This is not a real payment refund.`
    : `Cancel ${booking.id}? The demo policy gives no refund this close to showtime.`);
  if (!ok) return;
  const ledger = [...state.wallet.ledger];
  if (refund) ledger.unshift({ label: `Refund ${booking.id}`, points: 0, credit: refund, at: new Date().toISOString() });
  const nextState = {
    ...state,
    bookings: state.bookings.filter(item => item.id !== bookingId),
    wallet: {
      ...state.wallet,
      credit: state.wallet.credit + refund,
      ledger
    }
  };
  if (!saveState(nextState)) return;
  if (movieGrid) renderSeats();
  renderHistory();
  if (movieGrid) updateSummary();
  showStatus(refund ? `Booking ${booking.id} cancelled. Demo credit ${formatPrice(refund)} added to wallet.` : `Booking ${booking.id} cancelled. No demo refund.`);
}

function createBookingId() {
  return `CV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function nextShowDate(label) {
  const hours = parseShowtime(label);
  const date = new Date();
  date.setHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0);
  if (date < new Date()) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function confirmBooking() {
  const customer = customerInput.value.trim();
  const seats = [...selectedSeats].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!customer) {
    showStatus("Enter your name before booking.", true);
    customerInput.focus();
    return;
  }
  if (!seats.length) {
    showStatus("Choose at least one available seat.", true);
    return;
  }
  const booked = bookedSeatsFor();
  const conflicts = seats.filter(seat => booked.has(seat));
  if (conflicts.length) {
    renderSeats();
    updateSummary();
    showStatus(`${conflicts.join(", ")} is already booked. Choose another seat.`, true);
    return;
  }
  const movie = currentMovie();
  const priced = applyOffer(seatsTotal(seats), seats, selectedOfferId);
  const points = Math.floor(priced.total / 10);
  const booking = {
    id: createBookingId(),
    movieId: movie.id,
    cinemaId: selectedCinemaId,
    format: selectedFormat,
    showtime: selectedShowtime,
    customer,
    seats,
    total: priced.total,
    offerId: priced.discount ? selectedOfferId : "",
    createdAt: new Date().toISOString(),
    showAt: nextShowDate(selectedShowtime)
  };
  const nextState = {
    ...state,
    bookings: [booking, ...state.bookings],
    wallet: {
      points: state.wallet.points + points,
      credit: state.wallet.credit,
      ledger: [{ label: `Booking ${booking.id}`, points, at: booking.createdAt }, ...state.wallet.ledger]
    }
  };
  if (!saveState(nextState)) return;
  selectedSeats.clear();
  customerInput.value = state.session?.name || "";
  renderSeats();
  updateSummary();
  showStatus(`Demo booking confirmed. ID ${booking.id}. No payment was taken.`);
  document.querySelector("#confirmation-id").textContent = `#${booking.id}`;
  document.querySelector("#confirmation-movie").textContent = `${movie.title} · ${selectedFormat}`;
  document.querySelector("#confirmation-seats").textContent = `${booking.seats.join(", ")} · ${currentCinema().name} · ${selectedShowtime} · ${formatPrice(booking.total)}`;
  document.querySelector("#booking-confirmation").showModal();
}

function initializeHomePage() {
  document.querySelector("#featured-prev")?.addEventListener("click", () => {
    featuredMovieIndex = (featuredMovieIndex + MOVIES.length - 1) % MOVIES.length;
    renderFeaturedFilm();
    const movie = MOVIES[featuredMovieIndex];
    if (movie) selectMovie(movie.id, false);
  });
  document.querySelector("#featured-next")?.addEventListener("click", () => {
    featuredMovieIndex = (featuredMovieIndex + 1) % MOVIES.length;
    renderFeaturedFilm();
    const movie = MOVIES[featuredMovieIndex];
    if (movie) selectMovie(movie.id, false);
  });
  document.querySelector("#featured-poster")?.addEventListener("click", () => {
    document.querySelector("#feature-trailer")?.click();
  });
  document.querySelector("#movie-poster")?.addEventListener("click", () => {
    document.querySelector("#feature-trailer")?.click();
  });
  document.querySelector("#feature-book")?.addEventListener("click", () => {
    const movie = MOVIES[featuredMovieIndex];
    selectMovie(movie.id, false);
    document.querySelector("#seat-title").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelector("#feature-trailer")?.addEventListener("click", () => {
    const movie = MOVIES[featuredMovieIndex];
    openTrailerDialog(movie);
  });

  function stopTrailer() {
    const dialog = document.querySelector("#trailer-dialog");
    const stage = document.querySelector("#trailer-stage");
    if (stage) {
      stage.replaceChildren();
      stage.classList.remove("has-video");
    }
    if (dialog && dialog.open) dialog.close();
  }

  document.querySelector("#close-trailer")?.addEventListener("click", stopTrailer);
  document.querySelector("#trailer-dialog")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) stopTrailer();
  });
  document.querySelector("#trailer-dialog")?.addEventListener("close", () => {
    const stage = document.querySelector("#trailer-stage");
    if (stage) {
      stage.replaceChildren();
      stage.classList.remove("has-video");
    }
  });
  document.querySelector("#movie-search")?.addEventListener("input", event => {
    searchQuery = event.target.value;
    renderMovies();
    renderMovieDetails();
  });
  document.querySelector("#genre-filter")?.addEventListener("change", event => {
    genreFilter = event.target.value;
    renderMovies();
    renderMovieDetails();
  });
  bookButton?.addEventListener("click", confirmBooking);
  customerInput?.addEventListener("input", updateSummary);
  document.querySelector("#close-confirmation")?.addEventListener("click", () => document.querySelector("#booking-confirmation").close());
  document.querySelector("#booking-confirmation")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY) return;
    state = readState();
    renderSeats();
    updateSummary();
  });
  renderOfferSelect();
  renderMovies();
  renderFeaturedFilm();
  renderMovieDetails();
  renderBookingOptions();
  renderSeats();
  updateSummary();
  if (!storageAvailable) showStatus("Browser storage is unavailable. Bookings cannot be saved in this session.", true);
}

function renderWallet() {
  const points = document.querySelector("#wallet-points");
  const credit = document.querySelector("#wallet-credit");
  const ledger = document.querySelector("#wallet-ledger");
  if (!points) return;
  points.textContent = `${state.wallet.points} pts`;
  credit.textContent = formatPrice(state.wallet.credit || 0);
  ledger.replaceChildren();
  state.wallet.ledger.slice(0, 6).forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.label} · ${item.points ? `+${item.points} pts` : formatPrice(item.credit || 0)}`;
    ledger.append(li);
  });
}

function renderOffersPanel() {
  const list = document.querySelector("#offers-list");
  if (!list) return;
  list.replaceChildren();
  OFFERS.forEach(offer => {
    const item = document.createElement("article");
    item.className = "offer-card";
    item.innerHTML = `<h3>${offer.id}</h3><p>${offer.label}</p><p class="muted">Apply this code on the booking bar. Demo only — no payment.</p>`;
    list.append(item);
  });
}

function initializeBookingsPage() {
  renderHistory();
  document.querySelector("#reset-demo")?.addEventListener("click", () => {
    if (!window.confirm("Reset the demo to its original sample data? Current demo bookings and wallet activity will be removed.")) return;
    if (!saveState(emptyState())) return;
    renderHistory();
    showStatus("Demo reset to the original sample data.");
  });
  document.querySelector("#close-booking-dialog")?.addEventListener("click", () => document.querySelector("#booking-dialog").close());
  document.querySelector("#booking-dialog")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY) return;
    state = readState();
    renderHistory();
  });
  if (!storageAvailable) showStatus("Browser storage is unavailable. Bookings cannot be saved in this session.", true);
}

function initializeCinemasPage() {
  const list = document.querySelector("#cinema-list");
  const search = document.querySelector("#cinema-search");
  const formatFilter = document.querySelector("#cinema-format");
  function draw() {
    const query = (search?.value || "").toLowerCase();
    const format = formatFilter?.value || "all";
    list.replaceChildren();
    CINEMAS.filter(cinema => {
      const text = `${cinema.name} ${cinema.area} ${cinema.address}`.toLowerCase();
      return text.includes(query) && (format === "all" || cinema.formats.includes(format));
    }).forEach(cinema => {
      const card = document.createElement("article");
      card.className = "cinema-card";
      card.innerHTML = `
        <div class="cinema-card-content">
          <div class="cinema-header-row">
            <span class="cinema-area-badge">${cinema.area}</span>
            <div class="cinema-formats-pills">${cinema.formats.map(f => `<span class="format-pill format-${f.toLowerCase()}">${f}</span>`).join("")}</div>
          </div>
          <h2 class="cinema-name">${cinema.name}</h2>
          <p class="cinema-address"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M8 1a5 5 0 0 0-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg> <span>${cinema.address}</span></p>
        </div>
        <div class="cinema-card-actions">
          <a class="maps-link" href="${cinema.maps}" target="_blank" rel="noopener noreferrer">
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 8h10M8 3l5 5-5 5"/></svg>
            <span>Directions</span>
          </a>
        </div>`;
      list.append(card);
    });
  }
  search?.addEventListener("input", draw);
  formatFilter?.addEventListener("change", draw);
  draw();
}

function scoreMovie(movie, mood, occasion, budget) {
  let score = movie.score;
  if (mood && movie.moods.includes(mood)) score += 2;
  if (occasion && movie.occasions.includes(occasion)) score += 2;
  if (budget && movie.price <= Number(budget)) score += 1.5;
  else if (budget) score -= 2;
  return score;
}

function createGroupRequestId() {
  const stamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  return `GRP-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function setGroupStatus(message, isError = false) {
  const status = document.querySelector("#group-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.classList.toggle("success", !isError && Boolean(message));
}

function renderGroupRequests() {
  const list = document.querySelector("#group-request-list");
  const emptyState = document.querySelector("#group-request-empty");
  if (!list || !emptyState) return;
  const requests = Array.isArray(state?.groupRequests)
    ? [...state.groupRequests].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    : [];
  list.replaceChildren();
  if (!requests.length) {
    list.hidden = true;
    emptyState.hidden = false;
    return;
  }
  list.hidden = false;
  emptyState.hidden = true;
  requests.forEach(request => {
    const card = document.createElement("article");
    card.className = "request-card";
    const header = document.createElement("div");
    header.className = "request-card-header";
    const idLabel = document.createElement("span");
    idLabel.className = "request-id";
    idLabel.textContent = request.id || "GROUP";
    const dateLabel = document.createElement("span");
    dateLabel.className = "request-date";
    dateLabel.textContent = request.at ? formatDate(request.at) : "Date unavailable";
    header.append(idLabel, dateLabel);
    const meta = document.createElement("div");
    meta.className = "request-card-meta";
    const film = document.createElement("strong");
    film.textContent = MOVIES.find(item => item.id === request.movie)?.title || request.movie || "Unknown film";
    const people = document.createElement("span");
    people.textContent = `${Number(request.people) || 0} people`;
    meta.append(film, people);
    const note = document.createElement("p");
    note.className = `request-note${request.note ? "" : " muted"}`;
    note.textContent = request.note ? request.note : "No special note";
    card.append(header, meta, note);
    list.append(card);
  });
}

function initializeLoungePage() {
  const results = document.querySelector("#suggest-results");
  document.querySelector("#suggest-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const mood = document.querySelector("#mood").value;
    const occasion = document.querySelector("#occasion").value;
    const budget = document.querySelector("#budget").value;
    const ranked = [...MOVIES].sort((a, b) => scoreMovie(b, mood, occasion, budget) - scoreMovie(a, mood, occasion, budget)).slice(0, 3);
    results.replaceChildren();
    const note = document.createElement("p");
    note.className = "demo-banner";
    note.textContent = "Heuristic demo suggestions from mood, occasion and budget. No AI service is called.";
    results.append(note);
    ranked.forEach(movie => {
      const card = document.createElement("article");
      card.className = "suggest-card";
      card.innerHTML = `
        <div class="suggest-card-header">
          <strong>${movie.title}</strong>
          <span class="suggest-card-meta">${movie.genre} · from ${formatPrice(movie.price)} · <span class="score-badge">★ ${movie.score.toFixed(1)}</span></span>
        </div>
        <p class="suggest-card-desc">${movie.description}</p>
        <a class="suggest-book-link" href="index.html#now-showing"><span>Book this film</span> <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 8h10M8 3l5 5-5 5"/></svg></a>`;
      results.append(card);
    });
  });
  document.querySelector("#group-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const movieId = document.querySelector("#group-movie")?.value || "";
    const people = Number(document.querySelector("#group-size")?.value || 0);
    const note = (document.querySelector("#group-note")?.value || "").trim();
    if (!movieId || !MOVIES.some(item => item.id === movieId)) {
      setGroupStatus("Select a valid film for the group request.", true);
      return;
    }
    if (!Number.isFinite(people) || people < 2 || people > 20) {
      setGroupStatus("Group size must be between 2 and 20 people.", true);
      return;
    }
    if (note.length > 180) {
      setGroupStatus("The note must be 180 characters or less.", true);
      return;
    }
    const request = {
      id: createGroupRequestId(),
      type: "group",
      movie: movieId,
      people,
      note,
      at: new Date().toISOString()
    };
    if (!saveState({ ...state, groupRequests: [request, ...state.groupRequests] })) return;
    setGroupStatus(`Group request ${request.id} saved on this device. No real reservation was made.`, false);
    renderGroupRequests();
    event.target.reset();
    document.querySelector("#group-size").value = "8";
  });
  document.querySelector("#private-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const request = {
      id: createBookingId(),
      type: "private",
      movie: document.querySelector("#private-movie").value,
      date: document.querySelector("#private-date").value,
      note: document.querySelector("#private-note").value,
      at: new Date().toISOString()
    };
    if (!saveState({ ...state, privateRequests: [request, ...state.privateRequests] })) return;
    document.querySelector("#private-status").textContent = `Demo private-screen request ${request.id} saved. This is not a confirmed hire.`;
    event.target.reset();
  });
  document.querySelector("#planner-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const movie = MOVIES.find(item => item.id === document.querySelector("#plan-movie").value) || MOVIES[0];
    const tickets = Number(document.querySelector("#plan-tickets").value);
    const meal = MEALS.find(item => item.id === document.querySelector("#plan-meal").value);
    const ride = TRANSPORT.find(item => item.id === document.querySelector("#plan-transport").value);
    const ticketCost = movie.price * tickets;
    const total = ticketCost + meal.price + ride.price;
    const planner = { movie: movie.title, tickets, meal: meal.name, ride: ride.name, total, at: new Date().toISOString() };
    if (!saveState({ ...state, planner })) return;
    document.querySelector("#planner-status").innerHTML = `<strong>${formatPrice(total)}</strong> demo night out for ${tickets} · ${movie.title}. Tickets ${formatPrice(ticketCost)}, ${meal.name} ${formatPrice(meal.price)}, ${ride.name} ${formatPrice(ride.price)}. Nothing is booked or charged.`;
  });
  const movieSelects = document.querySelectorAll("#group-movie, #private-movie, #plan-movie");
  movieSelects.forEach(select => {
    MOVIES.forEach(movie => {
      const option = document.createElement("option");
      option.value = movie.id;
      option.textContent = movie.title;
      select.append(option);
    });
  });
  renderGroupRequests();
}

function initializeAccountPage() {
  const sessionBox = document.querySelector("#session-box");
  function drawSession() {
    if (!state.session) {
      sessionBox.hidden = true;
      return;
    }
    sessionBox.hidden = false;
    sessionBox.querySelector("p").textContent = `Signed in on this device as ${state.session.name} (${state.session.email}). This is a demo session, not a real account service.`;
  }
  document.querySelector("#register-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = document.querySelector("#register-name").value.trim();
    const email = document.querySelector("#register-email").value.trim().toLowerCase();
    const password = document.querySelector("#register-password").value;
    if (password.length < 6) {
      document.querySelector("#account-status").textContent = "Use at least 6 characters for the demo password.";
      return;
    }
    const users = state.users.filter(user => user.email !== email);
    users.push({ name, email, password });
    if (!saveState({ ...state, users, session: { name, email } })) return;
    document.querySelector("#account-status").textContent = "Demo profile saved on this device.";
    drawSession();
    updateNavBookingCount();
    event.target.reset();
  });
  document.querySelector("#login-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const email = document.querySelector("#login-email").value.trim().toLowerCase();
    const password = document.querySelector("#login-password").value;
    const user = state.users.find(item => item.email === email && item.password === password);
    if (!user) {
      document.querySelector("#account-status").textContent = "No matching demo profile on this device.";
      return;
    }
    if (!saveState({ ...state, session: { name: user.name, email: user.email } })) return;
    document.querySelector("#account-status").textContent = "Signed in locally.";
    drawSession();
    updateNavBookingCount();
  });
  document.querySelector("#sign-out")?.addEventListener("click", () => {
    if (!saveState({ ...state, session: null })) return;
    document.querySelector("#account-status").textContent = "Signed out of the demo session.";
    drawSession();
    updateNavBookingCount();
  });
  drawSession();
}

function initializeSupportPage() {
  const list = document.querySelector("#faq-list");
  FAQS.forEach(item => {
    const details = document.createElement("details");
    details.className = "faq";
    details.innerHTML = `<summary>${item.q}</summary><p>${item.a}</p>`;
    list.append(details);
  });
  document.querySelector("#support-form")?.addEventListener("submit", event => {
    event.preventDefault();
    document.querySelector("#support-status").textContent = "Demo message stored only as a confirmation. No support inbox received this.";
    event.target.reset();
  });
}

mountChrome();
state = readState();
updateNavBookingCount();

const page = pageName();
if (page === "bookings") initializeBookingsPage();
else if (page === "cinemas") initializeCinemasPage();
else if (page === "lounge") initializeLoungePage();
else if (page === "account") initializeAccountPage();
else if (page === "support") initializeSupportPage();
else if (document.querySelector("#movie-grid")) initializeHomePage();
