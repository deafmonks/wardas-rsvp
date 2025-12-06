Local proxy to forward RSVP requests to Google Apps Script and add CORS headers

Setup (macOS / zsh):

1. Open Terminal and cd to the project folder (where proxy.js is):

   ```bash
   cd ~/Desktop/\Wardas\ RSVP
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Edit `proxy.js` and set `SCRIPT_URL` to your Apps Script Web App exec URL.

4. Start the proxy:

   ```bash
   npm start
   ```

5. Make sure your `index.html` uses:

   ```js
   const scriptURL = 'http://localhost:3000/rsvp';
   ```

Note:
- The proxy expects the client to POST URL-encoded form data (application/x-www-form-urlencoded).
- The client code in `index.html` was updated to send `new URLSearchParams(new FormData(form))` so it works with this proxy.
