import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class TicketBookingSystem {

    private static final String URL =
            System.getenv().getOrDefault("DB_URL",
                "jdbc:mysql://localhost:3306/ticket_booking_db");

    private static final String USER = System.getenv().getOrDefault("DB_USER", "root");
    private static final String PASSWORD = System.getenv().getOrDefault("DB_PASSWORD", "");

    private static final int DEFAULT_MOVIE_ID = 1;

    public static final class BookingResult {
        private final boolean successful;
        private final int httpStatus;
        private final String message;
        private final int bookingId;

        BookingResult(boolean successful, int httpStatus, String message) {
            this(successful, httpStatus, message, -1);
        }

        BookingResult(boolean successful, int httpStatus, String message, int bookingId) {
            this.successful = successful;
            this.httpStatus = httpStatus;
            this.message = message;
            this.bookingId = bookingId;
        }

        public boolean isSuccessful() {
            return successful;
        }

        public String getMessage() {
            return message;
        }

        public int getHttpStatus() {
            return httpStatus;
        }

        public int getBookingId() {
            return bookingId;
        }
    }

    public static final class SchemaColumn {
        public final String table;
        public final String column;
        public final String type;
        public final String nullable;

        SchemaColumn(String table, String column, String type, String nullable) {
            this.table = table;
            this.column = column;
            this.type = type;
            this.nullable = nullable;
        }
    }

    public TicketBookingSystem() {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("MySQL Connector/J is missing from the classpath.", e);
        }
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    public void testConnection() throws SQLException {
        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT 1");
             ResultSet result = statement.executeQuery()) {
            if (!result.next() || result.getInt(1) != 1) {
                throw new SQLException("MySQL connection test returned no result.");
            }
        }
    }

    public java.util.List<SchemaColumn> inspectSchema() throws SQLException {
        java.util.List<SchemaColumn> columns = new java.util.ArrayList<>();
        try (Connection connection = getConnection()) {
            for (String table : new String[] {"movies", "seats", "users", "bookings"}) {
                try (ResultSet result = connection.getMetaData().getColumns(
                        connection.getCatalog(), null, table, "%")) {
                    while (result.next()) {
                        columns.add(new SchemaColumn(table, result.getString("COLUMN_NAME"),
                            result.getString("TYPE_NAME"), result.getString("IS_NULLABLE")));
                    }
                }
            }
        }
        return columns;
    }

    public java.util.List<String> inspectTableDefinitions() throws SQLException {
        java.util.List<String> definitions = new java.util.ArrayList<>();
        try (Connection connection = getConnection();
             java.sql.Statement statement = connection.createStatement()) {
            for (String table : new String[] {"movies", "seats", "users", "bookings"}) {
                try (ResultSet result = statement.executeQuery("SHOW CREATE TABLE " + table)) {
                    if (result.next()) definitions.add(result.getString(2));
                }
            }
        }
        return definitions;
    }

    public int runDemoSqlScript(String fileName)
            throws java.io.IOException, SQLException {
        String script = java.nio.file.Files.readString(
                java.nio.file.Path.of(fileName), java.nio.charset.StandardCharsets.UTF_8);
        int statementsRun = 0;
        try (Connection connection = getConnection();
             java.sql.Statement statement = connection.createStatement()) {
            for (String sql : script.split(";")) {
                if (sql.trim().isEmpty()) continue;
                statement.execute(sql);
                statementsRun++;
            }
        }
        return statementsRun;
    }

    public void displaySeats() {
        try {
            for (SeatInfo seat : listSeats(DEFAULT_MOVIE_ID)) {
                System.out.println(seat.seatNumber + " : "
                        + (seat.booked ? "BOOKED" : "AVAILABLE"));
            }
        } catch (SQLException e) {
            System.out.println("Could not display seats: " + e.getMessage());
        }
    }

    public void bookSeat(String seatNumber, String userName) {
        BookingResult result = bookSeat(DEFAULT_MOVIE_ID, seatNumber, userName);
        System.out.println(result.getMessage());
    }

    public void simulateConcurrentBooking() {
        try {
            String availableSeat = null;
            for (SeatInfo seat : listSeats(DEFAULT_MOVIE_ID)) {
                if (!seat.booked) {
                    availableSeat = seat.seatNumber;
                    break;
                }
            }
            if (availableSeat == null) {
                System.out.println("No available seats for the concurrency demonstration.");
                return;
            }

            final String seatToBook = availableSeat;
            final java.util.concurrent.CountDownLatch ready =
                    new java.util.concurrent.CountDownLatch(2);
            final java.util.concurrent.CountDownLatch start =
                    new java.util.concurrent.CountDownLatch(1);
                // Both threads wait at the gate so their database attempts begin together.
            Runnable attempt = () -> {
                ready.countDown();
                try {
                    start.await();
                    BookingResult result = bookSeat(DEFAULT_MOVIE_ID, seatToBook,
                            Thread.currentThread().getName());
                    System.out.println(Thread.currentThread().getName() + ": " + result.getMessage());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            };

            Thread user1 = new Thread(attempt, "User 1");
            Thread user2 = new Thread(attempt, "User 2");
            System.out.println("Two users are trying to book " + seatToBook + " simultaneously.");
            user1.start();
            user2.start();
            ready.await();
            start.countDown();
            user1.join();
            user2.join();
        } catch (SQLException e) {
            System.out.println("Could not run concurrency demonstration: "
                    + "check the database connection and schema.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.out.println("Simulation interrupted.");
        }
    }

    public java.util.List<MovieInfo> listMovies() throws SQLException {
        // PreparedStatement keeps SQL values separate from the query text.
        String query = "SELECT movie_id, movie_name, ticket_price "
            + "FROM Movies ORDER BY movie_id";
        java.util.List<MovieInfo> movies = new java.util.ArrayList<>();

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(query);
             ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                movies.add(new MovieInfo(result.getInt("movie_id"),
                    result.getString("movie_name"), result.getBigDecimal("ticket_price")));
            }
        }
        return movies;
    }

    public java.util.List<SeatInfo> listSeats(int movieId) throws SQLException {
        String query = "SELECT seat_number, is_booked FROM Seats "
                + "WHERE movie_id = ? ORDER BY seat_number";
        java.util.List<SeatInfo> seats = new java.util.ArrayList<>();

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
            statement.setInt(1, movieId);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    seats.add(new SeatInfo(result.getString("seat_number"),
                            result.getBoolean("is_booked")));
                }
            }
        }
        return seats;
    }

    public BookingResult bookSeat(int movieId, String seatNumber, String userName) {
        if (movieId <= 0 || seatNumber == null
                || !seatNumber.matches("(?i)A(?:[1-9]|10)")) {
            return new BookingResult(false, 400, "Choose a valid movie and seat A1-A10.");
        }
        if (userName == null || userName.trim().isEmpty() || userName.trim().length() > 100) {
            return new BookingResult(false, 400, "Enter a name between 1 and 100 characters.");
        }

        String normalizedSeat = seatNumber.toUpperCase(java.util.Locale.ROOT);
        String reserveSeat = "UPDATE Seats SET is_booked = TRUE "
            + "WHERE movie_id = ? AND seat_number = ? AND COALESCE(is_booked, FALSE) = FALSE";
        String addUser = "INSERT INTO Users (name) VALUES (?)";
        String addBooking = "INSERT INTO Bookings (user_id, seat_id) "
                + "SELECT ?, seat_id FROM Seats WHERE movie_id = ? AND seat_number = ?";

        try (Connection connection = getConnection()) {
            // Keep the seat reservation, user, and booking row in one transaction.
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement statement = connection.prepareStatement(reserveSeat)) {
                    statement.setInt(1, movieId);
                    statement.setString(2, normalizedSeat);
                    // This conditional update lets the database choose one concurrent winner.
                    if (statement.executeUpdate() != 1) {
                        connection.rollback();
                        return new BookingResult(false, 409, "That seat is already booked or unavailable.");
                    }
                }

                int userId;
                try (PreparedStatement statement = connection.prepareStatement(
                        addUser, java.sql.Statement.RETURN_GENERATED_KEYS)) {
                    statement.setString(1, userName.trim());
                    statement.executeUpdate();
                    try (ResultSet keys = statement.getGeneratedKeys()) {
                        if (!keys.next()) {
                            throw new SQLException("Could not create customer record.");
                        }
                        userId = keys.getInt(1);
                    }
                }

                try (PreparedStatement statement = connection.prepareStatement(
                        addBooking, java.sql.Statement.RETURN_GENERATED_KEYS)) {
                    statement.setInt(1, userId);
                    statement.setInt(2, movieId);
                    statement.setString(3, normalizedSeat);
                    if (statement.executeUpdate() != 1) {
                        throw new SQLException("Could not save booking record.");
                    }
                    try (ResultSet keys = statement.getGeneratedKeys()) {
                        if (!keys.next()) {
                            throw new SQLException("Could not read the new booking ID.");
                        }
                        int bookingId = keys.getInt(1);
                        connection.commit();
                        return new BookingResult(true, 201,
                                "Booking confirmed for " + normalizedSeat + ".", bookingId);
                    }
                }
            } catch (SQLException e) {
                connection.rollback();
                if (e.getErrorCode() == 1062) {
                    return new BookingResult(false, 409, "That seat is already booked.");
                }
                throw e;
            } finally {
                connection.setAutoCommit(true);
            }
        } catch (SQLException e) {
            return new BookingResult(false, 500,
                    "Booking could not be completed. Check the database connection and schema.");
        }
    }

    public BookingResult cancelBooking(int bookingId) {
        if (bookingId <= 0) {
            return new BookingResult(false, 400, "A valid booking ID is required.");
        }

        try (Connection connection = getConnection()) {
            connection.setAutoCommit(false);
            try {
                int seatId;
                String findBooking = "SELECT seat_id, status FROM Bookings "
                        + "WHERE booking_id = ? FOR UPDATE";
                try (PreparedStatement statement = connection.prepareStatement(findBooking)) {
                    statement.setInt(1, bookingId);
                    try (ResultSet result = statement.executeQuery()) {
                        if (!result.next()) {
                            connection.rollback();
                            return new BookingResult(false, 404, "Booking was not found.");
                        }
                        if ("CANCELLED".equalsIgnoreCase(result.getString("status"))) {
                            connection.rollback();
                            return new BookingResult(false, 409, "This booking is already cancelled.");
                        }
                        seatId = result.getInt("seat_id");
                    }
                }

                try (PreparedStatement statement = connection.prepareStatement(
                        "UPDATE Bookings SET status = 'CANCELLED' WHERE booking_id = ?")) {
                    statement.setInt(1, bookingId);
                    statement.executeUpdate();
                }

                String activeBookings = "SELECT COUNT(*) FROM Bookings WHERE seat_id = ? "
                        + "AND COALESCE(status, 'CONFIRMED') <> 'CANCELLED'";
                try (PreparedStatement statement = connection.prepareStatement(activeBookings)) {
                    statement.setInt(1, seatId);
                    try (ResultSet result = statement.executeQuery()) {
                        if (result.next() && result.getInt(1) == 0) {
                            try (PreparedStatement release = connection.prepareStatement(
                                    "UPDATE Seats SET is_booked = FALSE WHERE seat_id = ?")) {
                                release.setInt(1, seatId);
                                release.executeUpdate();
                            }
                        }
                    }
                }
                connection.commit();
                return new BookingResult(true, 200, "Booking cancelled and seat released.");
            } catch (SQLException e) {
                connection.rollback();
                throw e;
            } finally {
                connection.setAutoCommit(true);
            }
        } catch (SQLException e) {
            return new BookingResult(false, 500,
                    "Could not cancel booking. Check the database connection.");
        }
    }

    public java.util.List<BookingInfo> listBookings() throws SQLException {
        // These joins follow the booking foreign keys to show customer, movie, and seat details.
        String query = "SELECT b.booking_id, u.name, m.movie_name, s.seat_number, "
            + "m.ticket_price, b.booking_time "
                + "FROM Bookings b JOIN Users u ON b.user_id = u.user_id "
                + "JOIN Seats s ON b.seat_id = s.seat_id "
            + "JOIN Movies m ON s.movie_id = m.movie_id "
            + "WHERE COALESCE(b.status, 'CONFIRMED') <> 'CANCELLED' "
            + "ORDER BY b.booking_id DESC";
        java.util.List<BookingInfo> bookings = new java.util.ArrayList<>();

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(query);
             ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                bookings.add(new BookingInfo(result.getInt("booking_id"),
                    result.getString("name"), result.getString("movie_name"),
                    result.getString("seat_number"), result.getBigDecimal("ticket_price"),
                    result.getTimestamp("booking_time")));
            }
        }
        return bookings;
    }

    public static final class MovieInfo {
        public final int id;
        public final String title;
        public final java.math.BigDecimal price;
        MovieInfo(int id, String title, java.math.BigDecimal price) {
            this.id = id;
            this.title = title;
            this.price = price;
        }
    }

    public static final class SeatInfo {
        public final String seatNumber;
        public final boolean booked;
        SeatInfo(String seatNumber, boolean booked) {
            this.seatNumber = seatNumber;
            this.booked = booked;
        }
    }

    public static final class BookingInfo {
        public final int id;
        public final String customer;
        public final String movie;
        public final String seat;
        public final java.math.BigDecimal price;
        public final java.sql.Timestamp bookingTime;
        BookingInfo(int id, String customer, String movie, String seat,
            java.math.BigDecimal price, java.sql.Timestamp bookingTime) {
            this.id = id;
            this.customer = customer;
            this.movie = movie;
            this.seat = seat;
            this.price = price;
            this.bookingTime = bookingTime;
        }
    }
}