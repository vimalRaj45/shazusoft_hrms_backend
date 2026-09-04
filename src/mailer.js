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
export async function sendOTPEmail({ toEmail, otp, employeeName = 'Valued Team Member' }) {
  const mailboxId = await getMailboxResourceId();
  const configuration = new Configuration({
    accessToken: config.hostingerApiKey
  });
  const sendApi = new SendApi(configuration);

  const subject = `${otp} is your Shazu Soft HRMS Verification Code`;
  const plainText = `Hello ${employeeName},\n\nYour 6-digit login verification code for Shazu Soft HRMS is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this code, please ignore this email or notify management immediately.\n\nBest regards,\nShazu Soft Technologies Management`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="520" style="max-width: 520px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #133829; padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">
                      SHAZU SOFT TECHNOLOGIES
                    </div>
                    <div style="font-size: 12px; color: #a7f3d0; margin-top: 4px; font-weight: 600;">
                      HRMS Portal • Secure Authentication
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
                Hello ${employeeName},
              </p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Use the following 6-digit one-time password (OTP) to securely sign in to your <strong>Shazu Soft HRMS</strong> workspace.
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1.5px dashed #059669; border-radius: 6px; padding: 22px 16px;">
                    <div style="font-size: 11px; font-weight: 800; color: #059669; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
                      YOUR VERIFICATION CODE
                    </div>
                    <div style="font-size: 34px; font-weight: 900; color: #133829; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 600;">
                      ⏳ Valid for 10 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 20px 0 0 0;">
                For your security, never share this code with anyone. If you did not initiate this login request, please contact your HR manager immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 4px 0;">
                Sent via Shazu Soft Secure Mail Service (${config.hostingerSenderEmail})
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                © 2026 Shazu Soft Technologies & Operations. All rights reserved.
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
 * Send an official, professional notification email when management declines or requests action on a request
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
  adminName = 'HR & Operations Management'
}) {
  try {
    const mailboxId = await getMailboxResourceId();
    const configuration = new Configuration({
      accessToken: config.hostingerApiKey
    });
    const sendApi = new SendApi(configuration);

    const subject = `Update on your ${requestType} — Shazu Soft HRMS`;
    const dateStr = details.date || details.start_date || 'N/A';
    const durationStr = details.duration || details.total_days || details.requested_times || 'N/A';

    const plainText = `Hello ${employeeName},\n\nThis is an official communication regarding your recent ${requestType}.\n\nStatus: Request Declined / Action Required\nRequest Date: ${dateStr}\nDetails: ${durationStr}\n\nManagement Remarks / Reason:\n${rejectionReason}\n\nReviewed By: ${adminName}\n\nIf you have questions or require further clarification, please coordinate directly with your reporting manager.\n\nBest regards,\nShazu Soft Technologies Management`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.04);">
          <!-- Corporate Header -->
          <tr>
            <td style="background-color: #133829; padding: 24px 30px; text-align: left;">
              <div style="font-size: 17px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">
                SHAZU SOFT TECHNOLOGIES
              </div>
              <div style="font-size: 12px; color: #a7f3d0; margin-top: 3px; font-weight: 600;">
                Human Resource & Operations Portal
              </div>
            </td>
          </tr>

          <!-- Status Alert Banner -->
          <tr>
            <td style="background-color: #fef2f2; border-bottom: 1px solid #fee2e2; padding: 14px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Decision: Declined
                    </span>
                    <span style="font-size: 13px; font-weight: 600; color: #991b1b; margin-left: 10px;">
                      ${requestType} Status Update
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 30px;">
              <p style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
                Dear ${employeeName},
              </p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                Management has reviewed your submitted <strong>${requestType}</strong> and was unable to approve it at this time. Please review the specific feedback and details below:
              </p>

              <!-- Request Parameters Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 20px; font-size: 13px;">
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%; font-weight: 600;">Request Type:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${requestType}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Date / Period:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${dateStr}</td>
                </tr>
                ${details.leaveType ? `
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Category:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${details.leaveType}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Reviewed By:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 600;">${adminName}</td>
                </tr>
              </table>

              <!-- Management Feedback / Justification Box -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 0 4px 4px 0; margin-bottom: 22px;">
                <div style="font-size: 11px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                  Management Reason / Instructions
                </div>
                <div style="font-size: 13.5px; color: #78350f; font-weight: 500; line-height: 1.55;">
                  ${rejectionReason}
                </div>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
                If you believe this requires reconsideration or you need to resubmit with updated details, please coordinate with your reporting team or submit a revised request on the portal.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 3px 0;">
                Sent automatically via Shazu Soft HRMS Notification Engine (${config.hostingerSenderEmail})
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                © 2026 Shazu Soft Technologies. All rights reserved.
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
    console.log(`[Hostinger Mail] Professional Rejection Email successfully dispatched to ${toEmail}. Status: ${response.status}`);
    return response;
  } catch (err) {
    console.error(`[Hostinger Mail] Failed to dispatch rejection email to ${toEmail}:`, err.response?.data || err.message);
    return null;
  }
}

