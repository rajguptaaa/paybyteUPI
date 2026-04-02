const nodemailer = require('nodemailer')
const logger = require('../../shared/logger')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// Verify connection on startup
transporter.verify((err) => {
  if (err) logger.error('Email transporter error', err)
  else logger.info('Email transporter ready')
})

async function sendOTPEmail({ to, subject, otp, purpose }) {
  const templates = {
    verify_email: {
      subject: 'Verify your PaybyteUPI account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color: #6C47FF;">Verify your email</h2>
          <p>Welcome to PaybyteUPI! Use the OTP below to verify your email address.</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; 
                      color: #6C47FF; padding: 20px; background: #f4f4f4; 
                      text-align: center; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #888; font-size: 13px;">
            This OTP expires in 10 minutes. Do not share it with anyone.
          </p>
        </div>
      `
    },
    forgot_password: {
      subject: 'Reset your PaybyteUPI password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color: #6C47FF;">Reset your password</h2>
          <p>We received a request to reset your password. Use the OTP below.</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; 
                      color: #6C47FF; padding: 20px; background: #f4f4f4; 
                      text-align: center; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #888; font-size: 13px;">
            This OTP expires in 10 minutes. If you didn't request this, ignore this email.
          </p>
        </div>
      `
    },
    change_password: {
      subject: 'Confirm password change — PaybyteUPI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color: #6C47FF;">Confirm password change</h2>
          <p>Use the OTP below to confirm your password change.</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; 
                      color: #6C47FF; padding: 20px; background: #f4f4f4; 
                      text-align: center; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #888; font-size: 13px;">
            This OTP expires in 10 minutes. Do not share it with anyone.
          </p>
        </div>
      `
    }
  }

  const template = templates[purpose]

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: template.subject,
    html: template.html
  })

  logger.info(`OTP email sent to ${to} for purpose: ${purpose}`)
}

module.exports = { sendOTPEmail }