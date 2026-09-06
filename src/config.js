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

import fs from 'fs';

const TIMINGS_FILE = path.resolve(__dirname, '../data/office_timings.json');

let savedTimings = {};
try {
  if (fs.existsSync(TIMINGS_FILE)) {
    savedTimings = JSON.parse(fs.readFileSync(TIMINGS_FILE, 'utf8'));
  }
} catch (e) {
  // Silent fallback to defaults
}

// Dynamic in-memory runtime settings that admin can update from dashboard
export const runtimeSettings = {
  officeLatitude: config.officeLatitude,
  officeLongitude: config.officeLongitude,
  officeRadiusMeters: config.officeRadiusMeters,
  officeOpeningTime: savedTimings.opening_time || '09:30',
  officeClosingTime: savedTimings.closing_time || '18:30',
  officeLateGraceTime: savedTimings.late_grace_time || '09:45',
  halfDayHours: parseFloat(savedTimings.half_day_hours) || 4.5,
  fullDayHours: parseFloat(savedTimings.full_day_hours) || 8.5,
  allowMockBypassInDev: false
};

export function saveOfficeTimings(newTimings, updatedBy = 'Admin') {
  if (newTimings.opening_time) runtimeSettings.officeOpeningTime = newTimings.opening_time;
  if (newTimings.closing_time) runtimeSettings.officeClosingTime = newTimings.closing_time;
  if (newTimings.late_grace_time) runtimeSettings.officeLateGraceTime = newTimings.late_grace_time;
  if (newTimings.half_day_hours !== undefined) runtimeSettings.halfDayHours = parseFloat(newTimings.half_day_hours) || 4.5;
  if (newTimings.full_day_hours !== undefined) runtimeSettings.fullDayHours = parseFloat(newTimings.full_day_hours) || 8.5;

  const payload = {
    opening_time: runtimeSettings.officeOpeningTime,
    closing_time: runtimeSettings.officeClosingTime,
    late_grace_time: runtimeSettings.officeLateGraceTime,
    half_day_hours: runtimeSettings.halfDayHours,
    full_day_hours: runtimeSettings.fullDayHours,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  try {
    const dir = path.dirname(TIMINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TIMINGS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('[Config] Failed to persist office_timings.json:', err);
  }

  return payload;
}

