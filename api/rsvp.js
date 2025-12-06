const { google } = require('googleapis');

module.exports = async (req, res) => {
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const SHEET_NAME = process.env.SHEET_NAME || 'Responses';
    const SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;

    if (!SPREADSHEET_ID || !SERVICE_ACCOUNT) {
      return res.status(500).json({ error: 'Missing SPREADSHEET_ID or GOOGLE_SERVICE_ACCOUNT env variables' });
    }

    // On GET return a simple JSON for sanity check
    if (req.method === 'GET') {
      return res.json({ status: 'ok', message: 'rsvp endpoint is deployed' });
    }

    const key = typeof SERVICE_ACCOUNT === 'string' ? JSON.parse(SERVICE_ACCOUNT) : SERVICE_ACCOUNT;
    if (key.private_key) key.private_key = key.private_key.replace(/\\n/g, '\n');

    const jwt = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await jwt.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    const body = req.body || {};
    // Timestamp as day/month only (DD/MM)
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = `${day}/${month}`;

    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    const attendance = (body.attendance || '').trim();
    const message = (body.message || '').trim();
    const mainMeal = (body.meal || '').trim();
    const side = (body.side || '').trim();

    // validate required main fields
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required.' });
    }
    if (!attendance) {
      return res.status(400).json({ error: 'Confirmation (attendance) is required.' });
    }
    if (!side) {
      return res.status(400).json({ error: 'Please specify whether you are from the groom or bride side (side).' });
    }

    // Helper: build groom/bride columns
    function sideFlags(sideValue) {
      if (!sideValue) return ['', ''];
      if (String(sideValue).toLowerCase() === 'groom') return ['Yes', ''];
      if (String(sideValue).toLowerCase() === 'bride') return ['', 'Yes'];
      return ['', ''];
    }

    // Build rows in requested order:
    // Timestamp | First name | Last name | Confirmation | Meal | Message | Groom | Bride
    const rows = [];
    const [groomFlag, brideFlag] = sideFlags(side);
    rows.push([timestamp, firstName, lastName, attendance, mainMeal, message, groomFlag, brideFlag]);

    // Guests: look for guest_{i}_first and guest_{i}_last
    for (let i = 1; i <= 10; i++) {
      const gFirst = (body[`guest_${i}_first`] || '').trim();
      const gLast = (body[`guest_${i}_last`] || '').trim();
      const gMeal = (body[`guest_${i}_meal`] || '').trim();
      if (gFirst || gLast) {
        // require both first & last for any provided guest
        if (!gFirst || !gLast) {
          return res.status(400).json({ error: `Guest ${i} requires both first and last name.` });
        }
        // Do not duplicate the message for guests — only the main submitter's row includes the message
        rows.push([timestamp, gFirst, gLast, attendance, gMeal, '', groomFlag, brideFlag]);
      }
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No names provided' });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rows },
    });

    return res.status(200).json({ status: 'success', rowsAppended: rows.length });
  } catch (err) {
    console.error('rsvp error', err);
    return res.status(500).json({ status: 'error', message: String(err && err.message ? err.message : err) });
  }
};
