const nodemailer = require('nodemailer')
const logger = require('../../shared/logger')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

transporter.verify((err) => {
  if (err) logger.error('Email transporter error', err)
  else logger.info('Notification email transporter ready')
})

async function sendWelcomeEmail({ email, full_name }) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Welcome to PaybyteUPI!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
        <div style="background: #6C47FF; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">PaybyteUPI</h1>
          <p style="color: #d4c9ff; margin: 8px 0 0;">Payments made simple</p>
        </div>
        <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #333;">Hey ${full_name}! 👋</h2>
          <p style="color: #555; line-height: 1.6;">
            Welcome to PaybyteUPI - your new home for fast, secure payments.
            Your account is ready and your UPI ID has been created.
          </p>
          <div style="background: white; border: 2px solid #6C47FF; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
            <p style="margin: 0; color: #888; font-size: 13px;">You can now</p>
            <p style="margin: 8px 0 0; color: #6C47FF; font-weight: bold; font-size: 16px;">
              Send money · Add funds · Receive payments
            </p>
          </div>
          <p style="color: #888; font-size: 12px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    `
  })
  logger.info(`Welcome email sent to ${email}`)
}

async function sendPaymentSentEmail({ email, full_name, amount, receiverName, transactionId }) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `₹${amount} sent successfully`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
        <div style="background: #6C47FF; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0;">Payment Sent ✓</h2>
        </div>
        <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #555;">Hi ${full_name},</p>
          <div style="background: white; border-radius: 8px; padding: 24px; margin: 16px 0; text-align: center; border: 1px solid #eee;">
            <p style="margin: 0; color: #888; font-size: 13px;">Amount sent</p>
            <p style="margin: 8px 0; color: #6C47FF; font-size: 36px; font-weight: bold;">₹${amount}</p>
            <p style="margin: 0; color: #333;">To: <strong>${receiverName || 'User'}</strong></p>
          </div>
          <p style="color: #888; font-size: 12px;">Transaction ID: ${transactionId}</p>
        </div>
      </div>
    `
  })
  logger.info(`Payment sent email sent to ${email}`)
}

async function sendPaymentReceivedEmail({ email, full_name, amount, senderName, transactionId }) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `₹${amount} received! 💰`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
        <div style="background: #00b386; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0;">Money Received </h2>
        </div>
        <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #555;">Hi ${full_name},</p>
          <div style="background: white; border-radius: 8px; padding: 24px; margin: 16px 0; text-align: center; border: 1px solid #eee;">
            <p style="margin: 0; color: #888; font-size: 13px;">Amount received</p>
            <p style="margin: 8px 0; color: #00b386; font-size: 36px; font-weight: bold;">₹${amount}</p>
            <p style="margin: 0; color: #333;">From: <strong>${senderName || 'User'}</strong></p>
          </div>
          <p style="color: #888; font-size: 12px;">Transaction ID: ${transactionId}</p>
        </div>
      </div>
    `
  })
  logger.info(`Payment received email sent to ${email}`)
}

async function sendCashbackEmail({ email, full_name, amount, transactionId }) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `You earned ₹${amount} cashback! 🎁`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
        <div style="background: #ff6b35; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0;">Cashback Earned! 🎁</h2>
        </div>
        <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #555;">Hi ${full_name},</p>
          <div style="background: white; border-radius: 8px; padding: 24px; margin: 16px 0; text-align: center; border: 1px solid #eee;">
            <p style="margin: 0; color: #888; font-size: 13px;">Cashback credited</p>
            <p style="margin: 8px 0; color: #ff6b35; font-size: 36px; font-weight: bold;">₹${amount}</p>
            <p style="margin: 0; color: #555; font-size: 13px;">Added to your PaybyteUPI wallet</p>
          </div>
          <p style="color: #888; font-size: 12px;">Transaction ID: ${transactionId}</p>
        </div>
      </div>
    `
  })
  logger.info(`Cashback email sent to ${email}`)
}

module.exports = {
  sendWelcomeEmail,
  sendPaymentSentEmail,
  sendPaymentReceivedEmail,
  sendCashbackEmail
}