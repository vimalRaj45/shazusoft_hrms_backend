import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'super_secret_shazusoft_jwt_key_2026',
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE 
    ? path.resolve(__dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
    : path.resolve(__dirname, '../service.json'),
  googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
  officeLatitude: parseFloat(process.env.OFFICE_LATITUDE || '12.971598'),
  officeLongitude: parseFloat(process.env.OFFICE_LONGITUDE || '77.594566'),
  officeRadiusMeters: parseInt(process.env.OFFICE_RADIUS_METERS || '150', 10),
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  hostingerApiKey: process.env.HOSTINGER_API_KEY || 'cd2019a0481fcaab55f1141e15cff8e49257d240d04b16f9efd7e08c2b3cbbc4',
  hostingerSenderEmail: process.env.HOSTINGER_SENDER_EMAIL || 'info@shazusofttechnologies.org',
  hostingerSenderName: process.env.HOSTINGER_SENDER_NAME || 'Shazu Soft Technologies'
};

// Dynamic in-memory runtime settings that admin can update from dashboard
export const runtimeSettings = {
  officeLatitude: config.officeLatitude,
  officeLongitude: config.officeLongitude,
  officeRadiusMeters: config.officeRadiusMeters,
  allowMockBypassInDev: false
};
