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
    const timestamp = new Date().toISOString();
    const mainName = (body.name || '').trim();
    const attendance = (body.attendance || '').trim();
    const message = (body.message || '').trim();
    const mainMeal = (body.meal || '').trim();

    const rows = [];
    if (mainName) rows.push([timestamp, mainName, attendance, mainMeal, message]);
    for (let i = 1; i <= 10; i++) {
      const gName = (body[`guest_${i}_name`] || '').trim();
      if (gName) {
        const gMeal = (body[`guest_${i}_meal`] || '').trim();
        rows.push([timestamp, gName, attendance, gMeal, message]);
      }
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No names provided' });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:E`,
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
