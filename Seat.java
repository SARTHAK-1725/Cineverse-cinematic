/** In-memory example: synchronized lets one thread book this object at a time; MySQL protects real bookings. */
public class Seat {

    private final String seatNumber;
    private boolean booked;

    public Seat(String seatNumber) {
        this.seatNumber = seatNumber;
        this.booked = false;
    }

    public String getSeatNumber() {
        return seatNumber;
    }

    public boolean isBooked() {
        return booked;
    }

    public synchronized boolean bookSeat() {
        if (!booked) {
            booked = true;
            return true;
        }

        return false;
    }
}