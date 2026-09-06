import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET,
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE 
    ? path.resolve(__dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
    : path.resolve(__dirname, '../service.json'),
  googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
  officeLatitude: parseFloat(process.env.OFFICE_LATITUDE || '0'),
  officeLongitude: parseFloat(process.env.OFFICE_LONGITUDE || '0'),
  officeRadiusMeters: parseInt(process.env.OFFICE_RADIUS_METERS || '150', 10),
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  hostingerApiKey: process.env.HOSTINGER_API_KEY || '',
  hostingerSenderEmail: process.env.HOSTINGER_SENDER_EMAIL || '',
  hostingerSenderName: process.env.HOSTINGER_SENDER_NAME || '',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'production',
  isProduction: (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV),
  r2AccountId: process.env.R2_ACCOUNT_ID || '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  r2BucketName: process.env.R2_BUCKET_NAME || '',
  r2Endpoint: process.env.R2_ENDPOINT || '',
  timeZone: process.env.TIMEZONE || 'Asia/Kolkata'
};

// Dynamic in-memory runtime settings that admin can update from dashboard
export const runtimeSettings = {
  officeLatitude: config.officeLatitude,
  officeLongitude: config.officeLongitude,
  officeRadiusMeters: config.officeRadiusMeters,
  allowMockBypassInDev: false
};
