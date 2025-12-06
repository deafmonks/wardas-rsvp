const express = require('express');
const fetch = require('node-fetch'); // v2
const app = express();

// Accept urlencoded form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Change this to match your dev origin (Live Server uses http://127.0.0.1:5500)
const ALLOWED_ORIGIN = 'http://127.0.0.1:5500';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Replace this with your Apps Script Web App URL (the exec URL you get after deploying)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxK37rmOstD7AqtE5PVDOa2flLVlURrga8ckKYoBlKxcIsNSM6hFzuWHXkcKh2xpxGE/exec';

app.post('/rsvp', async (req, res) => {
  try {
    // Build URLSearchParams from parsed body so Apps Script receives form-encoded data
    const params = new URLSearchParams();
    for (const k in req.body) {
      const v = req.body[k];
      if (Array.isArray(v)) {
        v.forEach((item) => params.append(k, item));
      } else if (typeof v !== 'undefined') {
        params.append(k, String(v));
      }
    }

    const r = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const text = await r.text();
    res
      .status(r.status)
      .set('Content-Type', r.headers.get('content-type') || 'text/plain')
      .send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
