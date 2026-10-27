// Rota explícita para evitar 404 na Vercel em URLs de autenticação aninhadas.
// A validação de credenciais continua exclusivamente no Express.
import apiHandler from "../[...path].js";

export default function handler(req: any, res: any) {
  req.url = "/api/auth/login";
  return apiHandler(req, res);
}
