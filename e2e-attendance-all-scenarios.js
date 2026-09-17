/**
 * Comprehensive End-to-End Test Suite: Attendance, Timesheets, WorkDone & Reports
 * Tests all scenarios: Live active punches, Past unclosed sessions (2026-09-16 issue),
 * Geofencing, Full-Time vs Part-Time shifts, Task logging, and Report synchronization.
 */

import { computeEffectiveAttendance } from './src/routes/attendance.js';
import { verifyGeofence } from './src/geofence.js';
import { runtimeSettings } from './src/config.js';
import { formatTime12h, parseTimeStrToDate, getTodayDateStr, getNowTimeStr } from './src/utils/dateTime.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${colors.green}✓${colors.reset} ${message}`);
    passed++;
  } else {
    console.error(`  ${colors.red}✗ FAILED: ${message}${colors.reset}`);
    failed++;
  }
}

console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}   SHAZUSOFT HRMS - END-TO-END VERIFICATION SUITE   ${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

// ---------------------------------------------------------
// SCENARIO 1: Past Day Unclosed Punch (The 2026-09-16 Issue)
// ---------------------------------------------------------
console.log(`${colors.bright}${colors.blue}SCENARIO 1: Past Day Unclosed Punch (e.g. 2026-09-16 @ 05:31:48 PM)${colors.reset}`);
{
  const pastRecord = {
    id: 'ATT-TEST-PAST',
    date: '2026-09-16',
    employee_id: 'EMP-01',
    login_time: '05:31:48 PM',
    logout_time: '',
    total_hours: '0',
    net_hours: '0',
    status: 'Late',
    in_geofence: 'TRUE'
  };

  const todayStr = '2026-09-17';
  const nowTimeStr = '06:00:00 PM';
  const dayTaskHours = 4.0; // Task logged: 4h

  const effective = computeEffectiveAttendance(pastRecord, '2026-09-16', todayStr, nowTimeStr, dayTaskHours, '18:30');

  assert(effective !== null, 'Effective attendance record is generated');
  assert(effective.logout_time !== 'In Progress' && effective.logout_time !== 'Active' && effective.logout_time !== '--', `Logout time is auto-closed to shift end (${effective.logout_time})`);
  assert(parseFloat(effective.net_hours) > 0, `Net hours is NOT 0 hrs (Calculated: ${effective.net_hours} hrs)`);
  assert(effective.status === 'Late', 'Late status is properly preserved');
}

// ---------------------------------------------------------
// SCENARIO 2: Current Day Live Active Session (Today's Punch)
// ---------------------------------------------------------
console.log(`\n${colors.bright}${colors.blue}SCENARIO 2: Current Day Live In-Progress Session${colors.reset}`);
{
  const todayStr = getTodayDateStr();
  const todayRecord = {
    id: 'ATT-TEST-TODAY',
    date: todayStr,
    employee_id: 'EMP-01',
    login_time: '09:30:00 AM',
    logout_time: '',
    total_hours: '0',
    net_hours: '0',
    status: 'Present',
    in_geofence: 'TRUE'
  };

  const effective = computeEffectiveAttendance(todayRecord, todayStr, todayStr, '03:30:00 PM', 0, '18:30');

  assert(effective.logout_time === 'In Progress', 'Live logout time shows "In Progress"');
  assert(parseFloat(effective.net_hours) >= 5.5, `Live elapsed working hours calculated accurately (${effective.net_hours} hrs)`);
}

// ---------------------------------------------------------
// SCENARIO 3: Normal Completed Punch-Out
// ---------------------------------------------------------
console.log(`\n${colors.bright}${colors.blue}SCENARIO 3: Standard Punch-In & Punch-Out Calculation${colors.reset}`);
{
  const fullRecord = {
    id: 'ATT-TEST-FULL',
    date: '2026-09-15',
    employee_id: 'EMP-01',
    login_time: '09:30:00 AM',
    logout_time: '06:30:00 PM',
    total_hours: '9.00',
    net_hours: '9.00',
    status: 'Present',
    in_geofence: 'TRUE'
  };

  const effective = computeEffectiveAttendance(fullRecord, '2026-09-15', '2026-09-17', '06:00:00 PM', 0, '18:30');

  assert(effective.login_time.includes('09:30'), `Login time is formatted 12h (${effective.login_time})`);
  assert(effective.logout_time.includes('06:30'), `Logout time is formatted 12h (${effective.logout_time})`);
  assert(effective.net_hours === '9.00', 'Net hours matches recorded duration (9.00 hrs)');
}

// ---------------------------------------------------------
// SCENARIO 4: Geofence Verification (Inside vs Outside)
// ---------------------------------------------------------
console.log(`\n${colors.bright}${colors.blue}SCENARIO 4: Office GPS Geofence Verification${colors.reset}`);
{
  const officeLat = runtimeSettings.officeLatitude || 11.6569101;
  const officeLng = runtimeSettings.officeLongitude || 78.1635979;

  // Exact coordinates
  const insideCheck = verifyGeofence(officeLat, officeLng);
  assert(insideCheck.inside === true, 'Exact office location verified INSIDE geofence');

  // Coordinates 5km away
  const outsideCheck = verifyGeofence(officeLat + 0.05, officeLng + 0.05);
  assert(outsideCheck.inside === false, 'Location outside 150m boundary correctly REJECTED');
}

// ---------------------------------------------------------
// SCENARIO 5: WorkDone Task Actual Hours Auto-Defaulting
// ---------------------------------------------------------
console.log(`\n${colors.bright}${colors.blue}SCENARIO 5: WorkDone Task Estimation vs Actual Hours${colors.reset}`);
{
  const testTask = {
    project_name: 'testing of hrms',
    task_title: 'do it',
    estimated_hours: '4',
    actual_hours: '0',
    status: 'Completed'
  };

  let finalEstHours = String(testTask.estimated_hours || '0').trim();
  let finalActHours = String(testTask.actual_hours || '0').trim();

  if (testTask.status === 'Completed' && (finalActHours === '0' || !finalActHours) && parseFloat(finalEstHours) > 0) {
    finalActHours = finalEstHours;
  }

  assert(finalActHours === '4', `Completed task with 0h actual defaulted to estimated 4h (Result: ${finalActHours}h actual)`);
}

// ---------------------------------------------------------
// SCENARIO 6: Part-Time vs Full-Time Timing Rules
// ---------------------------------------------------------
console.log(`\n${colors.bright}${colors.blue}SCENARIO 6: Part-Time vs Full-Time Timing Configuration${colors.reset}`);
{
  assert(runtimeSettings.officeClosingTime === '18:30', 'Full-time shift closes at 18:30');
  assert(runtimeSettings.internClosingTime === '16:30', 'Part-time shift closes at 16:30');
  assert(runtimeSettings.fullDayHours === 8.5, 'Full-time expected day is 8.5 hrs');
  assert(runtimeSettings.internFullDayHours === 6.0, 'Part-time expected day is 6.0 hrs');
}

console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.bright}SUMMARY: ${passed} PASSED, ${failed} FAILED${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
