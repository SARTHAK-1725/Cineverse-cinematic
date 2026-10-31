const STORAGE_KEY = "cineverse-demo-v1";
const SEAT_ROWS = ["A", "B", "C", "D", "E"];
const SEATS_PER_ROW = 8;
const RECLINER_ROWS = ["E"];
const RECLINER_SURCHARGE = 180;
const MOVIE_TONES = ["teal", "rose", "blue", "violet", "gold", "green"];
const NAV_LINKS = [
  { id: "home", href: "index.html", label: "Now Showing" },
  { id: "cinemas", href: "cinemas.html", label: "Jaipur" },
  { id: "lounge", href: "lounge.html", label: "Lounge" },
  { id: "support", href: "support.html", label: "Support" }
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

function updateNavBookingCount() {
  const badge = document.querySelector("#nav-booking-count");
  if (badge) badge.textContent = String(state.bookings.length);
  const walletBadge = document.querySelector("#nav-points");
  if (walletBadge) walletBadge.textContent = `${state.wallet.points} pts`;
  const sessionLabel = document.querySelector("#nav-session");
  if (sessionLabel) sessionLabel.textContent = state.session ? state.session.name.split(" ")[0] : "Sign in";
}

function mountChrome() {
  const header = document.querySelector("#app-header");
  const footer = document.querySelector("#app-footer");
  const active = pageName();
  if (header) {
    header.innerHTML = `
      <a class="wordmark" href="index.html" aria-label="CineVerse home"><span class="mark">C</span><span>CINEVERSE <small>JAIPUR</small></span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
      <nav id="primary-nav" class="primary-nav" aria-label="Primary navigation">
        ${NAV_LINKS.map(link => `<a href="${link.href}" ${link.id === active ? 'aria-current="page"' : ""}>${link.label}</a>`).join("")}
      </nav>
      <div class="header-actions">
        <a class="ghost-link" href="account.html" id="nav-session">Sign in</a>
        <a class="history-link" href="bookings.html" ${active === "bookings" ? 'aria-current="page"' : ""}><span>Tickets</span><span id="nav-booking-count" class="booking-count">0</span></a>
      </div>`;
    header.querySelector(".nav-toggle")?.addEventListener("click", event => {
      const open = header.classList.toggle("nav-open");
      event.currentTarget.setAttribute("aria-expanded", String(open));
    });
  }
  if (footer) {
    footer.innerHTML = `<span>CINEVERSE · JAIPUR DEMO</span><span>Tickets, meals and plans — simulated on this device.</span>`;
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

function makePoster(movie, index, className) {
  const poster = document.createElement("span");
  poster.className = className;
  poster.dataset.tone = movie.tone || MOVIE_TONES[index % MOVIE_TONES.length];
  poster.setAttribute("aria-hidden", "true");
  const kicker = document.createElement("span");
  kicker.className = "poster-kicker";
  kicker.textContent = `${movie.score.toFixed(1)} · ${movie.rating}`;
  const letter = document.createElement("span");
  letter.className = "poster-letter";
  letter.textContent = movie.title.charAt(0).toUpperCase();
  const indexLabel = document.createElement("span");
  indexLabel.className = "poster-index";
  indexLabel.textContent = movie.formats.join(" · ");
  poster.append(kicker, letter, indexLabel);
  return poster;
}

function renderFeaturedFilm() {
  const movie = MOVIES[featuredMovieIndex];
  const title = document.querySelector("#featured-title");
  if (!title) return;
  title.textContent = movie.title;
  document.querySelector("#featured-meta").textContent = `${movie.genre} · ${movie.duration} · ${movie.rating} · ${movie.score.toFixed(1)}`;
  document.querySelector("#featured-description").textContent = movie.description;
  document.querySelector("#featured-counter").textContent = `${String(featuredMovieIndex + 1).padStart(2, "0")} / ${String(MOVIES.length).padStart(2, "0")}`;
  const poster = document.querySelector("#featured-poster");
  poster.dataset.tone = movie.tone;
  document.querySelector("#featured-poster-letter").textContent = movie.title.charAt(0).toUpperCase();
  document.querySelector("#featured-poster-index").textContent = movie.formats[0];
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
    const card = document.createElement("button");
    card.type = "button";
    card.className = "movie-card";
    card.dataset.movieId = movie.id;
    card.setAttribute("aria-pressed", String(movie.id === selectedMovieId));
    card.append(makePoster(movie, MOVIES.indexOf(movie), "movie-card-poster"));
    const info = document.createElement("span");
    info.className = "movie-card-info";
    const title = document.createElement("strong");
    title.className = "movie-card-title";
    title.textContent = movie.title;
    const meta = document.createElement("span");
    meta.className = "movie-card-meta";
    meta.textContent = `${movie.genre} · ${movie.duration} · ${movie.score.toFixed(1)}`;
    const price = document.createElement("span");
    price.className = "movie-card-price";
    price.textContent = `from ${formatPrice(movie.price)}`;
    const action = document.createElement("span");
    action.className = "movie-card-action";
    action.textContent = movie.id === selectedMovieId ? "Selected" : "Select";
    info.append(title, meta, price);
    card.append(info, action);
    card.addEventListener("click", () => {
      selectedMovieId = movie.id;
      selectedSeats.clear();
      syncFormatToMovie();
      renderMovies();
      renderMovieDetails();
      renderBookingOptions();
      renderSeats();
      updateSummary();
      showStatus("");
    });
    movieGrid.append(card);
  });
}

function renderMovieDetails() {
  if (!moviePoster) return;
  const movie = currentMovie();
  moviePoster.dataset.tone = movie.tone;
  moviePoster.querySelector(".poster-kicker").textContent = `${movie.score.toFixed(1)} · ${movie.rating}`;
  moviePoster.querySelector(".poster-letter").textContent = movie.title.charAt(0).toUpperCase();
  moviePoster.querySelector(".poster-index").textContent = movie.formats.join(" · ");
  movieMeta.textContent = `${movie.genre} · ${movie.duration} · ${movie.rating}`;
  movieDescription.textContent = movie.description;
  moviePrice.textContent = `${formatPrice(formatBasePrice(movie, selectedFormat))} ${selectedFormat} base`;
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
  });
  document.querySelector("#featured-next")?.addEventListener("click", () => {
    featuredMovieIndex = (featuredMovieIndex + 1) % MOVIES.length;
    renderFeaturedFilm();
  });
  document.querySelector("#feature-book")?.addEventListener("click", () => {
    const movie = MOVIES[featuredMovieIndex];
    selectedMovieId = movie.id;
    selectedSeats.clear();
    syncFormatToMovie();
    renderMovies();
    renderMovieDetails();
    renderBookingOptions();
    renderSeats();
    updateSummary();
    document.querySelector("#seat-title").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelector("#feature-trailer")?.addEventListener("click", () => {
    const movie = MOVIES[featuredMovieIndex];
    document.querySelector("#trailer-title").textContent = movie.title;
    document.querySelector("#trailer-copy").textContent = `${movie.description} ${SAMPLE_TRAILER.caption}.`;
    document.querySelector("#trailer-stage").dataset.tone = movie.tone;
    document.querySelector("#trailer-dialog").showModal();
  });
  document.querySelector("#close-trailer")?.addEventListener("click", () => document.querySelector("#trailer-dialog").close());
  document.querySelector("#trailer-dialog")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
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
        <div>
          <p class="eyebrow">${cinema.area}</p>
          <h2>${cinema.name}</h2>
          <p>${cinema.address}</p>
          <p class="formats">${cinema.formats.join(" · ")}</p>
        </div>
        <a class="maps-link" href="${cinema.maps}" target="_blank" rel="noopener noreferrer">Navigate</a>`;
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
      card.innerHTML = `<strong>${movie.title}</strong><span>${movie.genre} · from ${formatPrice(movie.price)} · ${movie.score.toFixed(1)}</span><p>${movie.description}</p><a href="index.html">Book this film</a>`;
      results.append(card);
    });
  });
  document.querySelector("#group-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const request = {
      id: createBookingId(),
      type: "group",
      movie: document.querySelector("#group-movie").value,
      people: document.querySelector("#group-size").value,
      note: document.querySelector("#group-note").value,
      at: new Date().toISOString()
    };
    if (!saveState({ ...state, groupRequests: [request, ...state.groupRequests] })) return;
    document.querySelector("#group-status").textContent = `Demo group request ${request.id} saved on this device. The cinema was not contacted.`;
    event.target.reset();
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
