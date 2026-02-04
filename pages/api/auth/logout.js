import nextConnect from "next-connect";
import session from "express-session";
import passport from "../../../lib/auth/passport";

const handler = nextConnect({
  onError(err, req, res) {
    console.error("Logout API error", err);
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
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

handler.use(passport.initialize());
handler.use(passport.session());

handler.post((req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error", err);
      return res.status(500).json({ message: "Kunne ikke logge ut" });
    }
    req.session.destroy(() => {
      res.status(200).json({ message: "Logget ut" });
    });
  });
});

export default handler;
