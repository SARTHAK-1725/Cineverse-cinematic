const CINEMAS = [
  {
    id: "raj-mandir",
    name: "Raj Mandir Cinema",
    area: "C-Scheme",
    address: "Bhagwan Das Road, C-Scheme, Jaipur",
    formats: ["2D", "3D"],
    maps: "https://www.google.com/maps/search/?api=1&query=Raj+Mandir+Cinema+Jaipur"
  },
  {
    id: "pvr-wtp",
    name: "PVR World Trade Park",
    area: "Malviya Nagar",
    address: "World Trade Park, JLN Marg, Jaipur",
    formats: ["2D", "3D", "IMAX"],
    maps: "https://www.google.com/maps/search/?api=1&query=PVR+World+Trade+Park+Jaipur"
  },
  {
    id: "inox-gtcc",
    name: "INOX Crystal Palm",
    area: "Bani Park",
    address: "Crystal Palm Mall, Sardar Patel Marg, Jaipur",
    formats: ["2D", "3D", "4DX"],
    maps: "https://www.google.com/maps/search/?api=1&query=INOX+Crystal+Palm+Jaipur"
  },
  {
    id: "cinepolis-pink",
    name: "Cinepolis Pink Square",
    area: "Govind Nagar",
    address: "Pink Square Mall, Govind Nagar, Jaipur",
    formats: ["2D", "3D", "4DX"],
    maps: "https://www.google.com/maps/search/?api=1&query=Cinepolis+Pink+Square+Jaipur"
  },
  {
    id: "golcha",
    name: "Golcha Cinema",
    area: "Chaura Rasta",
    address: "Chaura Rasta, Johari Bazaar, Jaipur",
    formats: ["2D"],
    maps: "https://www.google.com/maps/search/?api=1&query=Golcha+Cinema+Jaipur"
  }
];

const FORMAT_INFO = {
  "2D": { label: "2D", note: "Classic projection", multiplier: 1 },
  "3D": { label: "3D", note: "Depth glasses included in demo price", multiplier: 1.35 },
  "4DX": { label: "4DX", note: "Motion seats and effects", multiplier: 1.85 },
  IMAX: { label: "IMAX", note: "Large-format screen", multiplier: 2.1 }
};

const MOVIES = [
  { id: "last-light", tmdbId: 693134, title: "Dune: Part Two", genre: "Adventure", duration: "2h 46m", rating: "PG-13", score: 8.5, price: 320, tone: "teal", moods: ["epic", "hopeful"], occasions: ["friends", "solo"], formats: ["2D", "3D", "IMAX"], description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.", trailerUrl: "https://www.youtube.com/watch?v=Way9Dexny3w" },
  { id: "paper-moons", tmdbId: 313369, title: "La La Land", genre: "Romance", duration: "2h 08m", rating: "PG-13", score: 8.0, price: 280, tone: "rose", moods: ["cozy", "hopeful"], occasions: ["date", "solo"], formats: ["2D", "3D"], description: "Mia, an aspiring actress, and Sebastian, a dedicated jazz musician, struggle to make ends meet in a city known for crushing hopes.", trailerUrl: "https://www.youtube.com/watch?v=0pdqf4P9MB8" },
  { id: "blue-hour", tmdbId: 546554, title: "Knives Out", genre: "Mystery", duration: "2h 10m", rating: "PG-13", score: 7.9, price: 350, tone: "blue", moods: ["tense", "thoughtful"], occasions: ["solo", "friends"], formats: ["2D", "IMAX"], description: "When renowned crime novelist Harlan Thrombey is found dead, inquisitive Detective Benoit Blanc is mysteriously enlisted to investigate.", trailerUrl: "https://www.youtube.com/watch?v=qGqiHJTsRkQ" },
  { id: "quiet-orbit", tmdbId: 157336, title: "Interstellar", genre: "Science fiction", duration: "2h 49m", rating: "PG-13", score: 8.7, price: 300, tone: "violet", moods: ["epic", "thoughtful"], occasions: ["friends", "celebration"], formats: ["2D", "3D", "IMAX"], description: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.", trailerUrl: "https://www.youtube.com/watch?v=zSWdZVtXT7E" },
  { id: "velvet-city", tmdbId: 872585, title: "Oppenheimer", genre: "Drama", duration: "3h 01m", rating: "R", score: 8.3, price: 330, tone: "gold", moods: ["thoughtful", "cozy"], occasions: ["date", "solo"], formats: ["2D"], description: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.", trailerUrl: "https://www.youtube.com/watch?v=uYPbbksJxIg" },
  { id: "wildwood", tmdbId: 1022789, title: "Inside Out 2", genre: "Family", duration: "1h 36m", rating: "PG", score: 7.6, price: 260, tone: "green", moods: ["hopeful", "cozy"], occasions: ["family", "celebration"], formats: ["2D", "3D", "4DX"], description: "Teenager Riley's mind headquarters undergoes a sudden demolition to make room for brand-new emotions: Anxiety, Envy, Ennui, and Embarrassment.", trailerUrl: "https://www.youtube.com/watch?v=lo8F8jhT3SI" },
  { id: "night-circuit", tmdbId: 155, title: "The Dark Knight", genre: "Action", duration: "2h 32m", rating: "PG-13", score: 8.5, price: 360, tone: "rose", moods: ["tense", "epic"], occasions: ["friends", "celebration"], formats: ["2D", "3D", "4DX", "IMAX"], description: "Batman raises the stakes in his war on crime with the help of Lt. Jim Gordon and District Attorney Harvey Dent, until the Joker unleashes chaos.", trailerUrl: "https://www.youtube.com/watch?v=EXeTwQWrcwY" },
  { id: "kesar-house", tmdbId: 346698, title: "Barbie", genre: "Comedy", duration: "1h 54m", rating: "PG-13", score: 7.4, price: 250, tone: "gold", moods: ["cozy"], occasions: ["family", "friends", "date"], formats: ["2D", "3D"], description: "To live in Barbie Land is to be a perfect being in a perfect place. Unless you have a full-on existential crisis. Or you're a Ken.", trailerUrl: "https://www.youtube.com/watch?v=8zIf0XvoL9Y" }
];

const FEATURE_SHOWTIMES = ["11:20 am", "2:40 pm", "5:30 pm", "7:45 pm", "9:50 pm"];
const MEALS = [
  { id: "classic", name: "Classic combo", detail: "Popcorn + soda", price: 280 },
  { id: "recliner", name: "Recliner tray", detail: "Nachos, brownie, mocktail", price: 520 },
  { id: "skip", name: "No meal", detail: "Tickets only", price: 0 }
];
const TRANSPORT = [
  { id: "cab", name: "Cab both ways", detail: "Demo estimate for C-Scheme", price: 420 },
  { id: "metro", name: "Metro + auto", detail: "Pink Line connection", price: 120 },
  { id: "own", name: "Own vehicle", detail: "Parking demo fee", price: 80 }
];
const OFFERS = [
  { id: "CINE50", label: "₹50 off bookings over ₹600", min: 600, amount: 50 },
  { id: "FIRST100", label: "₹100 off your first demo booking", min: 200, amount: 100, firstOnly: true },
  { id: "GROUP8", label: "₹80 off 4+ seats", min: 0, amount: 80, minSeats: 4 }
];
const FAQS = [
  { q: "Is this a real cinema booking service?", a: "No. CineVerse is a demonstration website. Tickets, payments, AI, and requests are simulated and saved only in this browser." },
  { q: "How do refunds work in the demo?", a: "Cancellation uses a published demo policy: 90% more than 24 hours before the listed showtime, 50% between 4 and 24 hours, and no refund inside 4 hours. Refund value is added to the demo rewards wallet." },
  { q: "Do 4DX and IMAX cost extra?", a: "Yes. Each format has its own demo price, and recliner rows add a further surcharge. Prime evening showtimes apply a small dynamic bump." },
  { q: "Can I book a private screen?", a: "You can send a private-screen request from the Lounge page. It is a demo request stored on this device, not a booking with a cinema." }
];
const SAMPLE_TRAILER = {
  caption: "Demo trailer · no video is streamed"
};
