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
  { id: "last-light", title: "The Last Light", genre: "Adventure", duration: "2h 08m", rating: "PG-13", score: 8.4, price: 320, tone: "teal", moods: ["epic", "hopeful"], occasions: ["friends", "solo"], formats: ["2D", "3D", "IMAX"], description: "One quiet journey becomes a reason to begin again." },
  { id: "paper-moons", title: "Paper Moons", genre: "Romance", duration: "1h 54m", rating: "PG", score: 7.9, price: 280, tone: "rose", moods: ["cozy", "hopeful"], occasions: ["date", "solo"], formats: ["2D", "3D"], description: "Two strangers find a little magic in the long way home." },
  { id: "blue-hour", title: "The Blue Hour", genre: "Mystery", duration: "2h 02m", rating: "PG-13", score: 8.1, price: 350, tone: "blue", moods: ["tense", "thoughtful"], occasions: ["solo", "friends"], formats: ["2D", "IMAX"], description: "A forgotten photograph reveals a very old secret." },
  { id: "quiet-orbit", title: "A Quiet Orbit", genre: "Science fiction", duration: "1h 48m", rating: "PG", score: 8.6, price: 300, tone: "violet", moods: ["epic", "thoughtful"], occasions: ["friends", "celebration"], formats: ["2D", "3D", "IMAX"], description: "A voice from home changes the loneliest mission in space." },
  { id: "velvet-city", title: "Velvet City", genre: "Drama", duration: "2h 11m", rating: "15", score: 7.6, price: 330, tone: "gold", moods: ["thoughtful", "cozy"], occasions: ["date", "solo"], formats: ["2D"], description: "A late-night pianist gets one last chance to change the tune." },
  { id: "wildwood", title: "Wildwood", genre: "Family", duration: "1h 42m", rating: "PG", score: 7.4, price: 260, tone: "green", moods: ["hopeful", "cozy"], occasions: ["family", "celebration"], formats: ["2D", "3D", "4DX"], description: "A curious fox and a young mapmaker find an enchanted forest." },
  { id: "night-circuit", title: "Night Circuit", genre: "Action", duration: "2h 04m", rating: "15", score: 8.0, price: 360, tone: "rose", moods: ["tense", "epic"], occasions: ["friends", "celebration"], formats: ["2D", "3D", "4DX", "IMAX"], description: "A monsoon chase through Jaipur after one wrong radio call." },
  { id: "kesar-house", title: "Kesar House", genre: "Comedy", duration: "1h 56m", rating: "PG-13", score: 7.2, price: 250, tone: "gold", moods: ["cozy"], occasions: ["family", "friends", "date"], formats: ["2D", "3D"], description: "A wedding week where every secret arrives before the baraat." }
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
