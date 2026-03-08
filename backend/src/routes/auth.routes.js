const router          = require("express").Router();
const passport        = require("passport");
const jwt             = require("jsonwebtoken");
const { requireAuth } = require("../middleware/auth.middleware");
const logger          = require("../utils/logger");

// ── Google OAuth: redirect to Google ──────────────────
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

// ── Google OAuth: callback ────────────────────────────
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    const token = jwt.sign({ sub: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
    const appUrl = process.env.APP_URL || "http://localhost:5173";
    res.redirect(`${appUrl}/login?token=${token}`);
  }
);

// ── Get current user ──────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── Logout ────────────────────────────────────────────
router.post("/logout", requireAuth, (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

module.exports = router;