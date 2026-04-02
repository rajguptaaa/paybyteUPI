const passport = require('passport')
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt')

module.exports = function configurePassport() {
  // JWT strategy — always configured
  passport.use(new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'fallback_secret'
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

  // Google OAuth — only configure if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const { Strategy: GoogleStrategy } = require('passport-google-oauth20')

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
  } else {
    console.warn('Google OAuth not configured — skipping Google strategy')
  }
}
