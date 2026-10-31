import java.awt.Desktop;
import java.net.URI;
import java.util.Scanner;

public class Main {

    public static void main(String[] args) {

        TicketBookingSystem system = new TicketBookingSystem();

        if (args.length > 0 && "--seed".equals(args[0])) {
            try {
                system.testConnection();
                int count = system.runDemoSqlScript("database.sql");
                System.out.println("Database demo script completed. SQL statements run: " + count);
            } catch (Exception e) {
                System.err.println("Could not prepare demo data: " + e.getMessage());
                System.exit(1);
            }
            return;
        }

        if (args.length > 0 && "--schema".equals(args[0])) {
            try {
                for (TicketBookingSystem.SchemaColumn column : system.inspectSchema()) {
                    System.out.printf("%s.%s %s nullable=%s%n", column.table,
                            column.column, column.type, column.nullable);
                }
                for (String definition : system.inspectTableDefinitions()) {
                    System.out.println(definition);
                }
            } catch (Exception e) {
                System.err.println("Could not inspect database schema: " + e.getMessage());
            }
            return;
        }

        if (args.length > 0 && "--server".equals(args[0])) {
            String url = "http://localhost:8080";
            try {
                system.testConnection();
                BookingServer.start(system, 8080);
                System.out.println("Server started successfully: " + url);
            } catch (Exception e) {
                System.err.println("Could not start server: " + e.getMessage());
                System.exit(1);
                return;
            }
            try {
                if (Desktop.isDesktopSupported()) {
                    Desktop.getDesktop().browse(URI.create(url));
                } else {
                    System.out.println("Open this URL in your browser: " + url);
                }
            } catch (Exception e) {
                System.out.println("Server is running. Open this URL in your browser: " + url);
            }
            return;
        }

        Scanner scanner = new Scanner(System.in);

        System.out.println("======================================");
        System.out.println("   MULTITHREADED TICKET BOOKING");
        System.out.println("======================================");

        while (true) {

            System.out.println("\n1. View Seats");
            System.out.println("2. Book a Ticket");
            System.out.println("3. Simulate Concurrent Booking");
            System.out.println("4. Exit");
            System.out.print("Enter your choice: ");

            int choice;

            try {
                choice = Integer.parseInt(scanner.nextLine());
            } catch (NumberFormatException e) {
                System.out.println("Please enter a valid number.");
                continue;
            }

            switch (choice) {

                case 1:
                    system.displaySeats();
                    break;

                case 2:
                    System.out.print("Enter your name: ");
                    String name = scanner.nextLine();

                    System.out.print("Enter seat number (A1-A10): ");
                    String seatNumber = scanner.nextLine();

                    system.bookSeat(seatNumber, name);
                    break;

                case 3:
                    system.simulateConcurrentBooking();
                    break;

                case 4:
                    System.out.println("Thank you for using the Ticket Booking System!");
                    scanner.close();
                    return;

                default:
                    System.out.println("Invalid choice. Please try again.");
            }
        }
    }
}