// Rota explícita para evitar 404 na Vercel em URLs de autenticação aninhadas.
// Não duplica nem enfraquece autenticação, rate limit ou CSRF do Express.
import apiHandler from "../../[...path].js";

export default function handler(req: any, res: any) {
  req.url = "/api/auth/admin/login";
  return apiHandler(req, res);
}
