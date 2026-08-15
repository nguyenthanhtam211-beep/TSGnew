import { google } from 'googleapis';
import { Readable } from 'stream';

async function getOrCreateFolder(drive: any, name: string, parentId?: string) {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const response = await drive.files.list({ q, fields: "files(id, name)" });
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }
  const folderMetadata: any = {
    name: name,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId) {
    folderMetadata.parents = [parentId];
  }
  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id"
  });
  return folder.data.id;
}

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
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      oauth2Client = auth;
    } else {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const { customers = [] } = req.body || {};

    const rootFolderId = await getOrCreateFolder(drive, "TSG_Business_Documents");
    const customerFolderId = await getOrCreateFolder(drive, "Customers", rootFolderId);

    const jsonContent = JSON.stringify(customers, null, 2);
    const fileName = `TSG_Customers_Directory_${new Date().toISOString().slice(0, 10)}.json`;

    const fileMetadata = {
      name: fileName,
      parents: [customerFolderId],
    };

    const media = {
      mimeType: "application/json",
      body: Readable.from([jsonContent]),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    return res.status(200).json({
      success: true,
      driveFileId: file.data.id,
      driveLink: file.data.webViewLink,
      count: customers.length,
    });
  } catch (error: any) {
    console.error("Vercel Drive sync customers error:", error);
    return res.status(500).json({ error: error.message || "Failed to sync customers to Drive" });
  }
}
