require('dotenv').config()
const passport = require('passport')
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt')
const { Strategy: GoogleStrategy } = require('passport-google-oauth20')

module.exports = function configurePassport() {
  passport.use(new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'thisismysecretkeyiwonttellyou_paybyteupi_2026_backend'
    },
    async (payload, done) => {
      try {
        const User = require('../models/user.model')
        const user = await User.findById(payload.sub).select('-password_hash')
        if (!user || !user.is_active) return done(null, false)
        return done(null, user)
      } catch (err) {
        return done(err, false)
      }
    }
  ))

  // Validate Google OAuth environment variables
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    throw new Error('Missing required Google OAuth environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL')
  }

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const OAuthAccount = require('../models/oauth.model')
        const User = require('../models/user.model')

        let oauthAccount = await OAuthAccount.findOne({
          provider: 'google',
          provider_id: profile.id
        })

        if (oauthAccount) {
          const user = await User.findById(oauthAccount.user_id)
          return done(null, user)
        }

        let user = await User.findOne({ email: profile.emails[0].value })

        if (!user) {
          user = await User.create({
            email: profile.emails[0].value,
            full_name: profile.displayName,
            is_active: true,
            kyc_status: 'pending'
          })
        }

        await OAuthAccount.create({
          user_id: user._id,
          provider: 'google',
          provider_id: profile.id,
          email: profile.emails[0].value,
          access_token: accessToken
        })

        return done(null, user)
      } catch (err) {
        return done(err, false)
      }
    }
  ))
}