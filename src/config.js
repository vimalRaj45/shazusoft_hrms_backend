import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

try {
  dns.setDefaultResultOrder?.('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const origLookup = dns.lookup;
  dns.lookup = (hostname, options, callback) => {
    let cb = callback;
    let opts = options;
    if (typeof options === 'function') {
      cb = options;
      opts = {};
    }
    dns.resolve4(hostname, (err, addresses) => {
      if (!err && addresses && addresses.length > 0) {
        if (opts && opts.all) {
          return cb(null, addresses.map(a => ({ address: a, family: 4 })));
        }
        return cb(null, addresses[0], 4);
      }
      origLookup(hostname, options, cb);
    });
  };
} catch (e) {}

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
  timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BPzYce6UvC8ShowBUmiQFxeKSAwKqOt-F88DErrFG5UyUExDNuNDVnyPgfXmQM5quBSQ2sDuwowiNv42189KVnA',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '-wVAHRSLiI6QQa0gGVcWpj2gC8Ll6iKmw-3_d6k47YQ',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:info@shazusofttechnologies.org'
};

// Dynamic in-memory runtime settings loaded from PostgreSQL system_settings
export const runtimeSettings = {
  officeLatitude: config.officeLatitude,
  officeLongitude: config.officeLongitude,
  officeRadiusMeters: config.officeRadiusMeters,
  // Full-time Staff shift & working hours
  officeOpeningTime: '09:30',
  officeClosingTime: '18:30',
  officeLateGraceTime: '09:45',
  halfDayHours: 4.5,
  fullDayHours: 8.5,
  avgDailyHours: 8.5,
  // Part-Time Staff shift & working hours (Admin-configured flexible / lighter hours)
  internOpeningTime: '10:00',
  internClosingTime: '16:30',
  internLateGraceTime: '10:15',
  internHalfDayHours: 3.0,
  internFullDayHours: 6.0,
  internAvgDailyHours: 6.0,
  get partTimeOpeningTime() { return this.internOpeningTime; },
  set partTimeOpeningTime(v) { this.internOpeningTime = v; },
  get partTimeClosingTime() { return this.internClosingTime; },
  set partTimeClosingTime(v) { this.internClosingTime = v; },
  get partTimeLateGraceTime() { return this.internLateGraceTime; },
  set partTimeLateGraceTime(v) { this.internLateGraceTime = v; },
  get partTimeHalfDayHours() { return this.internHalfDayHours; },
  set partTimeHalfDayHours(v) { this.internHalfDayHours = v; },
  get partTimeFullDayHours() { return this.internFullDayHours; },
  set partTimeFullDayHours(v) { this.internFullDayHours = v; },
  get partTimeAvgDailyHours() { return this.internAvgDailyHours; },
  set partTimeAvgDailyHours(v) { this.internAvgDailyHours = v; },
  allowMockBypassInDev: false
};

export function loadPersistedTimings(saved) {
  if (!saved || typeof saved !== 'object') return;
  if (saved.opening_time) runtimeSettings.officeOpeningTime = saved.opening_time;
  if (saved.closing_time) runtimeSettings.officeClosingTime = saved.closing_time;
  if (saved.late_grace_time) runtimeSettings.officeLateGraceTime = saved.late_grace_time;
  if (saved.half_day_hours !== undefined) runtimeSettings.halfDayHours = parseFloat(saved.half_day_hours) || 4.5;
  if (saved.full_day_hours !== undefined) runtimeSettings.fullDayHours = parseFloat(saved.full_day_hours) || 8.5;
  if (saved.avg_daily_hours !== undefined) runtimeSettings.avgDailyHours = parseFloat(saved.avg_daily_hours) || 8.5;

  const ptOpening = saved.part_time_opening_time || saved.intern_opening_time;
  if (ptOpening) runtimeSettings.internOpeningTime = ptOpening;

  const ptClosing = saved.part_time_closing_time || saved.intern_closing_time;
  if (ptClosing) runtimeSettings.internClosingTime = ptClosing;

  const ptLateGrace = saved.part_time_late_grace_time || saved.intern_late_grace_time;
  if (ptLateGrace) runtimeSettings.internLateGraceTime = ptLateGrace;

  const ptHalfDay = saved.part_time_half_day_hours !== undefined ? saved.part_time_half_day_hours : saved.intern_half_day_hours;
  if (ptHalfDay !== undefined) runtimeSettings.internHalfDayHours = parseFloat(ptHalfDay) || 3.0;

  const ptFullDay = saved.part_time_full_day_hours !== undefined ? saved.part_time_full_day_hours : saved.intern_full_day_hours;
  if (ptFullDay !== undefined) runtimeSettings.internFullDayHours = parseFloat(ptFullDay) || 6.0;

  const ptAvgDaily = saved.part_time_avg_daily_hours !== undefined ? saved.part_time_avg_daily_hours : saved.intern_avg_daily_hours;
  if (ptAvgDaily !== undefined) runtimeSettings.internAvgDailyHours = parseFloat(ptAvgDaily) || 6.0;
}

export function saveOfficeTimings(newTimings, updatedBy = 'Admin') {
  if (newTimings.opening_time) runtimeSettings.officeOpeningTime = newTimings.opening_time;
  if (newTimings.closing_time) runtimeSettings.officeClosingTime = newTimings.closing_time;
  if (newTimings.late_grace_time) runtimeSettings.officeLateGraceTime = newTimings.late_grace_time;
  if (newTimings.half_day_hours !== undefined) runtimeSettings.halfDayHours = parseFloat(newTimings.half_day_hours) || 4.5;
  if (newTimings.full_day_hours !== undefined) runtimeSettings.fullDayHours = parseFloat(newTimings.full_day_hours) || 8.5;
  if (newTimings.avg_daily_hours !== undefined) runtimeSettings.avgDailyHours = parseFloat(newTimings.avg_daily_hours) || 8.5;

  const ptOpening = newTimings.part_time_opening_time || newTimings.intern_opening_time;
  if (ptOpening) runtimeSettings.internOpeningTime = ptOpening;

  const ptClosing = newTimings.part_time_closing_time || newTimings.intern_closing_time;
  if (ptClosing) runtimeSettings.internClosingTime = ptClosing;

  const ptLateGrace = newTimings.part_time_late_grace_time || newTimings.intern_late_grace_time;
  if (ptLateGrace) runtimeSettings.internLateGraceTime = ptLateGrace;

  const ptHalfDay = newTimings.part_time_half_day_hours !== undefined ? newTimings.part_time_half_day_hours : newTimings.intern_half_day_hours;
  if (ptHalfDay !== undefined) runtimeSettings.internHalfDayHours = parseFloat(ptHalfDay) || 3.0;

  const ptFullDay = newTimings.part_time_full_day_hours !== undefined ? newTimings.part_time_full_day_hours : newTimings.intern_full_day_hours;
  if (ptFullDay !== undefined) runtimeSettings.internFullDayHours = parseFloat(ptFullDay) || 6.0;

  const ptAvgDaily = newTimings.part_time_avg_daily_hours !== undefined ? newTimings.part_time_avg_daily_hours : newTimings.intern_avg_daily_hours;
  if (ptAvgDaily !== undefined) runtimeSettings.internAvgDailyHours = parseFloat(ptAvgDaily) || 6.0;

  const payload = {
    opening_time: runtimeSettings.officeOpeningTime,
    closing_time: runtimeSettings.officeClosingTime,
    late_grace_time: runtimeSettings.officeLateGraceTime,
    half_day_hours: runtimeSettings.halfDayHours,
    full_day_hours: runtimeSettings.fullDayHours,
    avg_daily_hours: runtimeSettings.avgDailyHours,
    part_time_opening_time: runtimeSettings.internOpeningTime,
    part_time_closing_time: runtimeSettings.internClosingTime,
    part_time_late_grace_time: runtimeSettings.internLateGraceTime,
    part_time_half_day_hours: runtimeSettings.internHalfDayHours,
    part_time_full_day_hours: runtimeSettings.internFullDayHours,
    part_time_avg_daily_hours: runtimeSettings.internAvgDailyHours,
    intern_opening_time: runtimeSettings.internOpeningTime,
    intern_closing_time: runtimeSettings.internClosingTime,
    intern_late_grace_time: runtimeSettings.internLateGraceTime,
    intern_half_day_hours: runtimeSettings.internHalfDayHours,
    intern_full_day_hours: runtimeSettings.internFullDayHours,
    intern_avg_daily_hours: runtimeSettings.internAvgDailyHours,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  return payload;
}
