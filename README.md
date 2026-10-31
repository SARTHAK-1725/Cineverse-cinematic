# CineVerse

A premium movie-ticket booking **demo** for Jaipur, built from the existing Afterglow HTML/CSS/JS app. It needs no database, Java, or payment provider.

Java sources in this folder are unused by the website and are left as they were.

## Run

From this folder, if Node is installed:

```powershell
.\run.ps1
```

Or serve the `web` folder locally. Opening `web/index.html` directly also works.

The site is a demonstration. Bookings, wallet credits, login, group requests and mood suggestions stay in this browser via `localStorage`. Payments, real cinema holds and remote AI are not integrated.

## Pages

- `web/index.html` — catalogue, search, filters, trailers, formats, showtimes, seats
- `web/cinemas.html` — Jaipur locator with Maps links
- `web/lounge.html` — mood picks, group and private-screen requests, outing planner
- `web/bookings.html` — history, rewards wallet, offers, cancel with demo refunds
- `web/account.html` — login and registration UI
- `web/support.html` — FAQs, support form, cancellation policy

Logic lives in `web/data.js` and `web/app.js`. Styles are in `web/styles.css`.
