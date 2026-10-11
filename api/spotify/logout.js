import { SP_COOKIE } from "./_sp.js";
export default function handler(req, res) {
  res.setHeader("Set-Cookie", `${SP_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  res.redirect(302, "/#erfolge");
}
