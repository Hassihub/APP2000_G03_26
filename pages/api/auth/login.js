import nextConnect from "next-connect";
import session from "express-session";
import passport from "../../../lib/auth/passport";

const handler = nextConnect({
  onError(err, req, res) {
    console.error("Login API error", err);
    res.status(500).json({ message: "Noe gikk galt" });
  },
  onNoMatch(req, res) {
    res.status(405).json({ message: "Method not allowed" });
  },
});

handler.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 uke
    },
  })
);

handler.use(passport.initialize());
handler.use(passport.session());

handler.post((req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ message: info?.message || "Innlogging feilet" });
    }

    req.logIn(user, (err2) => {
      if (err2) return next(err2);
      return res.status(200).json({ user });
    });
  })(req, res, next);
});

export default handler;
