import sgMail from '@sendgrid/mail';

export class EmailService {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey && apiKey !== 'YOUR_SENDGRID_API_KEY') {
      sgMail.setApiKey(apiKey);
      console.log('[EmailService]: SendGrid initialized.');
    } else {
      console.log('[EmailService]: SENDGRID_API_KEY not found or placeholder. Using console mock fallback.');
    }
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'no-reply@crmapp.com';

    if (apiKey && apiKey !== 'YOUR_SENDGRID_API_KEY') {
      try {
        await sgMail.send({
          to,
          from: fromEmail,
          subject,
          html,
        });
        console.log(`[EmailService]: Email sent successfully via SendGrid to ${to}`);
      } catch (err: any) {
        console.error(`[EmailService]: Failed to send email via SendGrid to ${to}`, err);
        // Print SendGrid response body errors if available
        if (err.response && err.response.body) {
          console.error(JSON.stringify(err.response.body, null, 2));
        }
        throw err;
      }
    } else {
      // Mock log to console
      console.log(`[EmailService] [MOCK SEND] ------------------------------`);
      console.log(`From:    ${fromEmail}`);
      console.log(`To:      ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:    ${html}`);
      console.log(`--------------------------------------------------------`);
    }
  }

  substituteVariables(body: string, lead: { name: string; company: string }): string {
    let result = body;
    result = result.replace(/\{\{\s*name\s*\}\}/g, lead.name || '');
    result = result.replace(/\{\{\s*company\s*\}\}/g, lead.company || '');
    return result;
  }
}

export const emailService = new EmailService();
export default emailService;
