import { Configuration, SendApi, AccountApi } from 'hostinger-mail-api-sdk';
import { config } from './config.js';

let cachedMailboxId = null;

/**
 * Fetch or get cached mailbox resource ID for Hostinger Mail
 */
async function getMailboxResourceId() {
  if (cachedMailboxId) return cachedMailboxId;

  try {
    const configuration = new Configuration({
      accessToken: config.hostingerApiKey
    });
    const accountApi = new AccountApi(configuration);
    const res = await accountApi.getCurrentAccount();
    const mailboxes = res.data?.data?.mailboxes || [];
    if (mailboxes.length > 0) {
      cachedMailboxId = mailboxes[0].resourceId;
      console.log(`[Hostinger Mail] Connected to Mailbox: ${mailboxes[0].address} (${cachedMailboxId})`);
      return cachedMailboxId;
    }
  } catch (err) {
    console.error('[Hostinger Mail] Failed to fetch mailbox ID:', err.response?.data || err.message);
  }

  // Fallback known mailbox ID from testing
  return 'AC27733647b7b2b04cefeca882d854';
}

/**
 * Send an OTP Verification Code Email to an Employee
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.otp
 * @param {string} [params.employeeName]
 */
export async function sendOTPEmail({ toEmail, otp, employeeName = 'Team Member' }) {
  const mailboxId = await getMailboxResourceId();
  const configuration = new Configuration({
    accessToken: config.hostingerApiKey
  });
  const sendApi = new SendApi(configuration);

  const subject = `${otp} is your Shazu Soft HRMS verification code`;
  const plainText = `Dear ${employeeName},\n\nYour single-use verification code for accessing the Shazu Soft HRMS portal is: ${otp}\n\nThis verification code is valid for 10 minutes. For security reasons, please do not share this code with anyone.\n\nIf you did not initiate this authentication request, please notify HR Administration immediately.\n\nRegards,\nHuman Resources & Information Security Administration\nShazu Soft Technologies`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Corporate Header -->
          <tr>
            <td style="background-color: #133829; padding: 22px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em; text-transform: uppercase;">
                      Shazu Soft Technologies
                    </div>
                    <div style="font-size: 11px; color: #cbd5e1; margin-top: 3px; font-weight: 500;">
                      Human Resources Management System • Portal Authentication
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 28px 20px 28px;">
              <p style="font-size: 14px; color: #0f172a; margin: 0 0 14px 0; font-weight: 600;">
                Dear ${employeeName},
              </p>
              <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Your single-use verification code to sign in to the Shazu Soft HRMS portal is provided below.
              </p>

              <!-- Verification Code Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 18px 16px;">
                    <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px;">
                      Verification Code
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace;">
                      ${otp}
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 6px;">
                      Valid for 10 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12.5px; color: #64748b; line-height: 1.6; margin: 18px 0 24px 0;">
                For security reasons, do not share this code with anyone. If you did not initiate this login request, please disregard this email or report the event to HR Administration.
              </p>

              <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; font-size: 13px; color: #334155;">
                <p style="margin: 0; font-weight: 600;">Regards,</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Human Resources Administration<br>Shazu Soft Technologies</p>
              </div>
            </td>
          </tr>

          <!-- Corporate Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 3px 0;">
                This is an automated system communication sent by Shazu Soft HRMS (${config.hostingerSenderEmail}).
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                © 2026 Shazu Soft Technologies. All rights reserved. Confidential.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const payload = {
    to: [toEmail],
    displayName: config.hostingerSenderName,
    subject: subject,
    text: plainText,
    html: htmlContent
  };

  const response = await sendApi.sendEmail(mailboxId, payload);
  console.log(`[Hostinger Mail] OTP Email sent to ${toEmail}. Status: ${response.status}`);
  return response;
}

/**
 * Send an official notification email when management declines or requests action on a request
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.employeeName
 * @param {string} params.requestType - e.g. "Leave Application", "Short Permission Pass", "Attendance Regularization"
 * @param {string} params.rejectionReason - Detailed management explanation
 * @param {Object} [params.details] - e.g. { date, leaveType, duration, requestedTimes }
 * @param {string} [params.adminName]
 */
export async function sendProfessionalRejectionEmail({
  toEmail,
  employeeName = 'Team Member',
  requestType = 'HRMS Request',
  rejectionReason,
  details = {},
  adminName = 'HR Administration'
}) {
  try {
    const mailboxId = await getMailboxResourceId();
    const configuration = new Configuration({
      accessToken: config.hostingerApiKey
    });
    const sendApi = new SendApi(configuration);

    const subject = `Status Update: ${requestType} — Shazu Soft HRMS`;
    const dateStr = details.date || details.start_date || 'N/A';
    const durationStr = details.duration || details.total_days || details.requested_times || 'N/A';

    const plainText = `Dear ${employeeName},\n\nThis is an official communication regarding your recent ${requestType}.\n\nReview Status: Declined / Action Required\nRequest Date: ${dateStr}\nDetails: ${durationStr}\nReviewed By: ${adminName}\n\nManagement Remarks / Reason:\n${rejectionReason}\n\nIf you have questions or wish to submit an amended request, please coordinate with your reporting manager or HR administration.\n\nRegards,\nHuman Resources Administration\nShazu Soft Technologies`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Corporate Header -->
          <tr>
            <td style="background-color: #133829; padding: 22px 28px; text-align: left;">
              <div style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em; text-transform: uppercase;">
                Shazu Soft Technologies
              </div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 3px; font-weight: 500;">
                Human Resources Management System • Request Review Notice
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 26px 28px 20px 28px;">
              <p style="font-size: 14px; color: #0f172a; margin: 0 0 12px 0; font-weight: 600;">
                Dear ${employeeName},
              </p>
              <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 18px 0;">
                This communication is regarding the <strong>${requestType}</strong> you submitted. Following administrative review, management was unable to approve the request as submitted.
              </p>

              <!-- Request Parameters Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 18px; font-size: 13px; border-collapse: collapse;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%; font-weight: 600;">Request Type:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${requestType}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Date / Period:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${dateStr}</td>
                </tr>
                ${details.leaveType ? `
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Leave Category:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${details.leaveType}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Review Status:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #991b1b; font-weight: 700;">Declined / Action Required</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 9px 14px; color: #64748b; font-weight: 600;">Reviewed By:</td>
                  <td style="padding: 9px 14px; color: #0f172a;">${adminName}</td>
                </tr>
              </table>

              <!-- Management Remarks Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #64748b; padding: 12px 16px; border-radius: 0 4px 4px 0; margin-bottom: 18px;">
                <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                  Management Explanation / Remarks:
                </div>
                <div style="font-size: 13px; color: #1e293b; line-height: 1.5;">
                  ${rejectionReason}
                </div>
              </div>

              <p style="font-size: 12.5px; color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                If you need to provide supplementary information or submit a revised request, please coordinate with your reporting manager or update your submission through the portal.
              </p>

              <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; font-size: 13px; color: #334155;">
                <p style="margin: 0; font-weight: 600;">Regards,</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Human Resources & Operations Administration<br>Shazu Soft Technologies</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 3px 0;">
                Sent automatically via Shazu Soft HRMS Notification Service (${config.hostingerSenderEmail})
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                © 2026 Shazu Soft Technologies. All rights reserved. Confidential.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const payload = {
      to: [toEmail],
      displayName: config.hostingerSenderName,
      subject: subject,
      text: plainText,
      html: htmlContent
    };

    const response = await sendApi.sendEmail(mailboxId, payload);
    console.log(`[Hostinger Mail] Rejection notice email dispatched to ${toEmail}. Status: ${response.status}`);
    return response;
  } catch (err) {
    console.error(`[Hostinger Mail] Failed to dispatch rejection notice to ${toEmail}:`, err.response?.data || err.message);
    return null;
  }
}

/**
 * Send an official Onboarding Welcome Email to a new employee
 * @param {Object} params
 * @param {string} params.toEmail
 * @param {string} params.employeeName
 * @param {string} params.employeeId
 * @param {string} [params.role]
 * @param {string} [params.department]
 * @param {string} [params.designation]
 * @param {string} [params.workMode]
 * @param {string} [params.portalUrl]
 */
export async function sendInvitationEmail({
  toEmail,
  employeeName = 'Team Member',
  employeeId,
  role = 'employee',
  department = 'General',
  designation = 'Staff',
  workMode = 'office',
  portalUrl = 'http://localhost:5173'
}) {
  try {
    const mailboxId = await getMailboxResourceId();
    const configuration = new Configuration({
      accessToken: config.hostingerApiKey
    });
    const sendApi = new SendApi(configuration);

    const subject = `Welcome to Shazu Soft Technologies — HRMS Portal Access (${employeeId})`;
    const workModeLabel = workMode === 'wfh' ? 'Work From Home (Remote)' : 'In-Office (GPS Perimeter)';

    const plainText = `Dear ${employeeName},\n\nWelcome to Shazu Soft Technologies. Your employee account has been created in the Shazu Soft HRMS portal.\n\nAccount Details:\n- Employee ID: ${employeeId}\n- Official Email: ${toEmail}\n- Department: ${department}\n- Designation: ${designation}\n- Role: ${role === 'admin' ? 'Administrator' : 'Employee'}\n- Work Mode: ${workModeLabel}\n\nPortal Authentication Instructions:\n1. Navigate to: ${portalUrl}\n2. Enter your registered email address (${toEmail}).\n3. Click "Send Verification Code" to receive your 6-digit one-time passcode via email.\n4. Enter the code to access your workspace.\n\nRegards,\nHuman Resources Administration\nShazu Soft Technologies`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Corporate Header -->
          <tr>
            <td style="background-color: #133829; padding: 22px 28px; text-align: left;">
              <div style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 0.04em; text-transform: uppercase;">
                Shazu Soft Technologies
              </div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 3px; font-weight: 500;">
                Human Resources Management System • Portal Onboarding
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 26px 28px 20px 28px;">
              <p style="font-size: 14px; color: #0f172a; margin: 0 0 12px 0; font-weight: 600;">
                Dear ${employeeName},
              </p>
              <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 18px 0;">
                Welcome to Shazu Soft Technologies. Your employee profile has been provisioned in the corporate HRMS portal. You may now access the system to view your daily attendance logs, timesheets, tasks, and leave balances.
              </p>

              <!-- Account Specifications Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 20px; font-size: 13px; border-collapse: collapse;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%; font-weight: 600;">Employee ID:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${employeeId}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Official Email:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${toEmail}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Department:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${department}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Designation:</td>
                  <td style="padding: 9px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${designation}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 9px 14px; color: #64748b; font-weight: 600;">Work Mode:</td>
                  <td style="padding: 9px 14px; color: #0f172a;">${workModeLabel}</td>
                </tr>
              </table>

              <!-- Portal Authentication Steps -->
              <div style="font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                Authentication Instructions:
              </div>
              <ol style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
                <li>Navigate to the HRMS portal using the link below.</li>
                <li>Enter your registered email address (<strong style="color: #0f172a;">${toEmail}</strong>).</li>
                <li>Click <em>"Send Verification Code"</em> to receive a 6-digit one-time passcode via email.</li>
                <li>Enter the code to access your workspace.</li>
              </ol>

              <!-- Portal Access Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td align="left">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; background-color: #133829; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 4px;">
                      Access HRMS Portal
                    </a>
                  </td>
                </tr>
              </table>

              <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; font-size: 13px; color: #334155;">
                <p style="margin: 0; font-weight: 600;">Regards,</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Human Resources Administration<br>Shazu Soft Technologies</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 3px 0;">
                Sent automatically via Shazu Soft HRMS Onboarding Service (${config.hostingerSenderEmail})
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                © 2026 Shazu Soft Technologies. All rights reserved. Confidential.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const payload = {
      to: [toEmail],
      displayName: config.hostingerSenderName,
      subject: subject,
      text: plainText,
      html: htmlContent
    };

    const response = await sendApi.sendEmail(mailboxId, payload);
    console.log(`[Hostinger Mail] Onboarding email dispatched to ${toEmail}. Status: ${response.status}`);
    return response;
  } catch (err) {
    console.error(`[Hostinger Mail] Failed to dispatch onboarding email to ${toEmail}:`, err.response?.data || err.message);
    return null;
  }
}
