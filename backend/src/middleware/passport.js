const passport       = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const JwtStrategy    = require("passport-jwt").Strategy;
const ExtractJwt     = require("passport-jwt").ExtractJwt;
const { prisma }     = require("../services/db.service");
const logger         = require("../utils/logger");

function initPassport(app) {
  app.use(passport.initialize());

  // ── Google OAuth2 ────────────────────────────────────
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn("⚠️  GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set – Google OAuth disabled");
  } else {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  "/api/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from Google"));

        const user = await prisma.user.upsert({
          where:  { googleId: profile.id },
          update: { name: profile.displayName, avatarUrl: profile.photos?.[0]?.value },
          create: {
            googleId:  profile.id,
            email,
            name:      profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          },
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  ));
  }

  // ── JWT ──────────────────────────────────────────────
  passport.use(new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:    process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        user ? done(null, user) : done(null, false);
      } catch (err) {
        done(err);
      }
    }
  ));

  logger.info("🔐 Passport initialized (Google OAuth2 + JWT)");
}

module.exports = { initPassport };