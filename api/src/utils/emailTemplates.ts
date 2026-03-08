const BASE = `
  <div style="background:#14110C;padding:40px 0;font-family:Georgia,serif">
    <div style="max-width:540px;margin:0 auto;background:#1A1710;border-radius:16px;overflow:hidden;border:1px solid #2A2720">
      <div style="background:linear-gradient(90deg,#C9A84C,#E8C96A);height:4px"></div>
      <div style="padding:40px 36px">
        <p style="margin:0 0 28px;font-size:22px;font-weight:700;color:#F5F0E8">
          🐾 Battersea <span style="color:#C9A84C;font-style:italic">K9</span>
        </p>
        {{BODY}}
        <div style="margin-top:40px;padding-top:24px;border-top:1px solid #2A2720">
          <p style="margin:0;font-size:12px;color:#6B6660">
            Battersea K9 · London · <a href="https://batterseak9.com" style="color:#C9A84C;text-decoration:none">batterseak9.com</a>
          </p>
        </div>
      </div>
    </div>
  </div>
`;

function wrap(body: string) {
  return BASE.replace('{{BODY}}', body);
}

function heading(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:24px;color:#F5F0E8;font-weight:700">${text}</h1>`;
}

function para(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;color:#C8C0B0;line-height:1.6">${text}</p>`;
}

function btn(text: string, url: string) {
  return `
    <a href="${url}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:linear-gradient(90deg,#C9A84C,#E8C96A);color:#14110C;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none">
      ${text}
    </a>
  `;
}

function infoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#6B6660;width:120px">${label}</td>
      <td style="padding:8px 0;font-size:13px;color:#F5F0E8;font-weight:600">${value}</td>
    </tr>
  `;
}

// ── Templates ──────────────────────────────────────────────────────────────

export function welcomeEmail(firstName: string | null) {
  const name = firstName ?? 'there';
  return wrap(`
    ${heading(`Welcome, ${name}!`)}
    ${para('Your Battersea K9 account is ready. We\'re thrilled to have you and your pup on board.')}
    ${para('Browse available walk slots, top up your credit wallet, and book a walk whenever you need it.')}
    ${btn('Open the app', 'k9app://home')}
    ${para('If you have any questions, just reply to this email — we\'re here to help.')}
  `);
}

export function bookingConfirmationEmail(opts: {
  firstName: string | null;
  dogName: string;
  serviceName: string;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
  bookingId: string;
}) {
  const name = opts.firstName ?? 'there';
  const date = new Date(opts.slotDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return wrap(`
    ${heading('Booking confirmed!')}
    ${para(`Hi ${name}, your walk has been booked. We\'ll send you a reminder the day before.`)}
    <table style="margin:20px 0;border-collapse:collapse;width:100%">
      ${infoRow('Dog', opts.dogName)}
      ${infoRow('Service', opts.serviceName)}
      ${infoRow('Date', date)}
      ${infoRow('Time', `${opts.slotStart.slice(0,5)} – ${opts.slotEnd.slice(0,5)}`)}
    </table>
    ${btn('View booking', `k9app://booking/${opts.bookingId}`)}
  `);
}

export function bookingCancellationEmail(opts: {
  firstName: string | null;
  dogName: string;
  serviceName: string;
  slotDate: string;
  slotStart: string;
  refunded: boolean;
}) {
  const name = opts.firstName ?? 'there';
  const date = new Date(opts.slotDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const refundNote = opts.refunded
    ? '1 credit has been refunded to your wallet.'
    : 'As this was cancelled within 24 hours of the walk, no credit has been refunded.';
  return wrap(`
    ${heading('Booking cancelled')}
    ${para(`Hi ${name}, your booking has been cancelled.`)}
    <table style="margin:20px 0;border-collapse:collapse;width:100%">
      ${infoRow('Dog', opts.dogName)}
      ${infoRow('Service', opts.serviceName)}
      ${infoRow('Date', date)}
      ${infoRow('Time', opts.slotStart.slice(0,5))}
    </table>
    ${para(refundNote)}
  `);
}

export function walkStartedEmail(opts: {
  firstName: string | null;
  dogName: string;
  bookingId: string;
}) {
  const name = opts.firstName ?? 'there';
  return wrap(`
    ${heading(`${opts.dogName}'s walk has started!`)}
    ${para(`Hi ${name}, your walker has picked up ${opts.dogName} and the walk is underway.`)}
    ${para('You can track the walk live and receive photo updates in the app.')}
    ${btn('Track live', `k9app://tracking`)}
  `);
}

export function walkCompletedEmail(opts: {
  firstName: string | null;
  dogName: string;
  durationMinutes: number;
  bookingId: string;
}) {
  const name = opts.firstName ?? 'there';
  const dur = opts.durationMinutes < 60
    ? `${opts.durationMinutes} minutes`
    : `${Math.floor(opts.durationMinutes / 60)}h ${opts.durationMinutes % 60 > 0 ? `${opts.durationMinutes % 60}m` : ''}`.trim();
  return wrap(`
    ${heading('Walk complete!')}
    ${para(`Hi ${name}, ${opts.dogName}'s walk is done. Hope they had a great time!`)}
    <table style="margin:20px 0;border-collapse:collapse;width:100%">
      ${infoRow('Duration', dur)}
    </table>
    ${para('View the full walk report including photos and GPS route in the app.')}
    ${btn('View report', `k9app://booking/${opts.bookingId}`)}
  `);
}

export function paymentReceiptEmail(opts: {
  firstName: string | null;
  productLabel: string;
  credits: number;
  amountPence: number;
}) {
  const name = opts.firstName ?? 'there';
  const amount = `£${(opts.amountPence / 100).toFixed(2)}`;
  return wrap(`
    ${heading('Payment received')}
    ${para(`Hi ${name}, thank you for your payment.`)}
    <table style="margin:20px 0;border-collapse:collapse;width:100%">
      ${infoRow('Product', opts.productLabel)}
      ${infoRow('Amount', amount)}
      ${infoRow('Credits added', String(opts.credits))}
    </table>
    ${para('Your credits have been added to your wallet and are ready to use.')}
    ${btn('View wallet', 'k9app://payments')}
  `);
}

export function subscriptionRenewalEmail(opts: {
  firstName: string | null;
  credits: number;
}) {
  const name = opts.firstName ?? 'there';
  return wrap(`
    ${heading('Monthly credits added')}
    ${para(`Hi ${name}, your Monthly Plan has renewed and ${opts.credits} credits have been added to your wallet.`)}
    ${btn('View wallet', 'k9app://payments')}
  `);
}

export function paymentFailedEmail(opts: { firstName: string | null }) {
  const name = opts.firstName ?? 'there';
  return wrap(`
    ${heading('Payment failed')}
    ${para(`Hi ${name}, we were unable to process your subscription payment.`)}
    ${para('Please update your payment details to keep your subscription active.')}
    ${btn('Manage billing', 'k9app://payments')}
  `);
}

export function subscriptionCancelledEmail(opts: { firstName: string | null }) {
  const name = opts.firstName ?? 'there';
  return wrap(`
    ${heading('Subscription cancelled')}
    ${para(`Hi ${name}, your Battersea K9 Monthly Plan has been cancelled.`)}
    ${para('Your existing credits remain in your wallet and can still be used to book walks.')}
    ${para('You can restart your subscription at any time from the payments screen.')}
    ${btn('View wallet', 'k9app://payments')}
  `);
}

export function bookingReminderEmail(opts: {
  firstName: string | null;
  dogName: string;
  serviceName: string;
  slotDate: string;
  slotStart: string;
  bookingId: string;
}) {
  const name = opts.firstName ?? 'there';
  const date = new Date(opts.slotDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return wrap(`
    ${heading('Walk reminder — tomorrow!')}
    ${para(`Hi ${name}, just a reminder that ${opts.dogName}'s walk is tomorrow.`)}
    <table style="margin:20px 0;border-collapse:collapse;width:100%">
      ${infoRow('Service', opts.serviceName)}
      ${infoRow('Date', date)}
      ${infoRow('Time', opts.slotStart.slice(0,5))}
    </table>
    ${btn('View booking', `k9app://booking/${opts.bookingId}`)}
  `);
}

export function passwordResetEmail(opts: { firstName: string | null; resetUrl: string }) {
  const name = opts.firstName ?? 'there';
  return wrap(`
    ${heading('Reset your password')}
    ${para(`Hi ${name}, we received a request to reset your Battersea K9 password.`)}
    ${para('This link expires in 1 hour. If you didn\'t request a reset, you can safely ignore this email.')}
    ${btn('Reset password', opts.resetUrl)}
  `);
}

export function walkConfirmedEmail(opts: {
  firstName: string | null;
  dogName: string;
  slotDate: string;
  slotStart: string;
  bookingId: string;
}) {
  const name = opts.firstName ?? 'there';
  const date = new Date(opts.slotDate + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return wrap(`
    ${heading('Walk confirmed by your walker')}
    ${para(`Hi ${name}, great news — ${opts.dogName}'s walk on ${date} at ${opts.slotStart.slice(0,5)} has been confirmed.`)}
    ${btn('View booking', `k9app://booking/${opts.bookingId}`)}
  `);
}
