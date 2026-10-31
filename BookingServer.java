import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BookingServer {

    private final TicketBookingSystem system;
    private final Path webRoot;

    private BookingServer(TicketBookingSystem system, Path webRoot) {
        this.system = system;
        this.webRoot = webRoot;
    }

    public static void start(TicketBookingSystem system, int port) throws IOException {
        // Bind only to this computer; the browser and API share one local origin.
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        BookingServer app = new BookingServer(system, Path.of("web").toAbsolutePath().normalize());
        server.createContext("/api/movies", app::movies);
        server.createContext("/api/seats", app::seats);
        server.createContext("/api/bookings", app::bookings);
        server.createContext("/api/book", app::book);
        server.createContext("/api/cancel", app::cancel);
        server.createContext("/", app::staticFile);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();
    }

    private void movies(HttpExchange exchange) throws IOException {
        if (!requireMethod(exchange, "GET")) return;
        try {
            StringBuilder json = new StringBuilder("[");
            for (TicketBookingSystem.MovieInfo movie : system.listMovies()) {
                if (json.length() > 1) json.append(',');
                json.append("{\"id\":").append(movie.id)
                        .append(",\"title\":\"").append(escape(movie.title))
                        .append("\",\"price\":").append(movie.price.toPlainString()).append('}');
            }
            send(exchange, 200, json.append(']').toString());
        } catch (SQLException e) {
            sendError(exchange, 500, "Could not load movies. Check the database schema and connection.");
        }
    }

    private void seats(HttpExchange exchange) throws IOException {
        if (!requireMethod(exchange, "GET")) return;
        try {
            int movieId = Integer.parseInt(queryValue(exchange, "movieId"));
            if (movieId <= 0) throw new NumberFormatException();
            StringBuilder json = new StringBuilder("[");
            for (TicketBookingSystem.SeatInfo seat : system.listSeats(movieId)) {
                if (json.length() > 1) json.append(',');
                json.append("{\"seatNumber\":\"").append(escape(seat.seatNumber))
                        .append("\",\"booked\":").append(seat.booked).append('}');
            }
            send(exchange, 200, json.append(']').toString());
        } catch (NumberFormatException e) {
            sendError(exchange, 400, "A valid movieId is required.");
        } catch (SQLException e) {
            sendError(exchange, 500, "Could not load seats. Check the database schema and connection.");
        }
    }

    private void bookings(HttpExchange exchange) throws IOException {
        if (!requireMethod(exchange, "GET")) return;
        try {
            StringBuilder json = new StringBuilder("[");
            for (TicketBookingSystem.BookingInfo booking : system.listBookings()) {
                if (json.length() > 1) json.append(',');
                json.append("{\"id\":").append(booking.id)
                        .append(",\"customer\":\"").append(escape(booking.customer))
                        .append("\",\"movie\":\"").append(escape(booking.movie))
                    .append("\",\"seat\":\"").append(escape(booking.seat))
                    .append("\",\"price\":").append(booking.price.toPlainString())
                    .append(",\"bookingTime\":\"")
                    .append(escape(booking.bookingTime == null ? "" : booking.bookingTime.toString()))
                    .append("\"}");
            }
            send(exchange, 200, json.append(']').toString());
        } catch (SQLException e) {
            sendError(exchange, 500, "Could not load booking history. Check the database schema and connection.");
        }
    }

    private void book(HttpExchange exchange) throws IOException {
        if (!requireMethod(exchange, "POST")) return;
        // Read the request, validate through the service, and send its status as JSON.
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        try {
            int movieId = Integer.parseInt(jsonValue(body, "movieId"));
            String seat = jsonValue(body, "seatNumber");
            String customer = jsonValue(body, "customerName");
            TicketBookingSystem.BookingResult result = system.bookSeat(movieId, seat, customer);
            send(exchange, result.getHttpStatus(),
                    "{\"success\":" + result.isSuccessful()
                        + ",\"bookingId\":" + result.getBookingId() + ",\"message\":\""
                            + escape(result.getMessage()) + "\"}");
        } catch (IllegalArgumentException e) {
            sendError(exchange, 400, "Provide a valid movieId, seatNumber, and customerName.");
        }
    }

    private void cancel(HttpExchange exchange) throws IOException {
        if (!requireMethod(exchange, "POST")) return;
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        try {
            int bookingId = Integer.parseInt(jsonValue(body, "bookingId"));
            TicketBookingSystem.BookingResult result = system.cancelBooking(bookingId);
            send(exchange, result.getHttpStatus(),
                    "{\"success\":" + result.isSuccessful() + ",\"message\":\""
                            + escape(result.getMessage()) + "\"}");
        } catch (IllegalArgumentException e) {
            sendError(exchange, 400, "Provide a valid bookingId.");
        }
    }

    private void staticFile(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendError(exchange, 405, "Method not allowed.");
            return;
        }
        String requestPath = exchange.getRequestURI().getPath();
        if ("/".equals(requestPath)) requestPath = "/index.html";
        // Normalize paths and keep every requested file inside the web folder.
        Path file = webRoot.resolve(requestPath.substring(1)).normalize();
        if (!file.startsWith(webRoot) || !Files.isRegularFile(file)) {
            sendError(exchange, 404, "Page not found.");
            return;
        }
        String type = requestPath.endsWith(".css") ? "text/css; charset=utf-8"
                : requestPath.endsWith(".js") ? "text/javascript; charset=utf-8"
                : "text/html; charset=utf-8";
        byte[] content = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", type);
        exchange.sendResponseHeaders(200, content.length);
        exchange.getResponseBody().write(content);
        exchange.close();
    }

    private boolean requireMethod(HttpExchange exchange, String method) throws IOException {
        if (method.equals(exchange.getRequestMethod())) return true;
        sendError(exchange, 405, "Method not allowed.");
        return false;
    }

    private static String queryValue(HttpExchange exchange, String name) {
        String query = exchange.getRequestURI().getRawQuery();
        if (query != null) {
            for (String part : query.split("&")) {
                String[] pair = part.split("=", 2);
                if (pair.length == 2 && name.equals(pair[0])) {
                    return URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
                }
            }
        }
        return "";
    }

    private static String jsonValue(String json, String key) {
        Pattern field = Pattern.compile("\\\"" + Pattern.quote(key)
                + "\\\"\\s*:\\s*(?:\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"|(\\d+))");
        Matcher matcher = field.matcher(json);
        if (!matcher.find()) throw new IllegalArgumentException("Missing " + key);
        return matcher.group(1) != null ? unescape(matcher.group(1)) : matcher.group(2);
    }

    private static String unescape(String value) {
        return value.replace("\\\"", "\"").replace("\\\\", "\\")
                .replace("\\n", "\n").replace("\\r", "\r");
    }

    private static String escape(String value) {
        if (value == null) return "";
        StringBuilder escaped = new StringBuilder();
        for (char character : value.toCharArray()) {
            switch (character) {
                case '"': escaped.append("\\\""); break;
                case '\\': escaped.append("\\\\"); break;
                case '\b': escaped.append("\\b"); break;
                case '\f': escaped.append("\\f"); break;
                case '\n': escaped.append("\\n"); break;
                case '\r': escaped.append("\\r"); break;
                case '\t': escaped.append("\\t"); break;
                default:
                    if (character < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
            }
        }
        return escaped.toString();
    }

    private static void sendError(HttpExchange exchange, int status, String message) throws IOException {
        send(exchange, status, "{\"error\":\"" + escape(message) + "\"}");
    }

    private static void send(HttpExchange exchange, int status, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }
}