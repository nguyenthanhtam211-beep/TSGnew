import { google } from 'googleapis';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    let oauth2Client;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });
      oauth2Client = auth;
    } else {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { summary, description, start, end, location } = req.body || {};

    const event = {
      summary,
      description,
      location,
      start: {
        dateTime: start,
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: end,
        timeZone: 'Asia/Ho_Chi_Minh',
      },
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return res.status(200).json(result.data);
  } catch (error: any) {
    console.error("Vercel calendar event error:", error);
    return res.status(500).json({ error: error.message || "Failed to create calendar event" });
  }
}
