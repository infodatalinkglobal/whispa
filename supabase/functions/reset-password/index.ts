// Supabase Edge Function: reset a password with a recovery code.
// Deployed as "reset-password" with JWT verification on (the app calls it with the public anon key).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// 32 symbols (no 0/O/1/I), so one random byte & 31 is unbiased. 16 symbols = 80 bits.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const code = String(body.code ?? "");
  const password = String(body.password ?? "");
  // bcrypt only reads the first 72 bytes, so cap the password there.
  if (!/^[a-z0-9_]{3,20}$/.test(username) || password.length < 8 || new TextEncoder().encode(password).length > 72) {
    return json({ error: "bad_request" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: userId, error: verifyError } = await admin.rpc("verify_recovery", {
    p_username: username,
    p_code: code,
  });
  if (verifyError) return json({ error: "server_error" }, 500);
  // Same answer for unknown username, wrong code, no code set, or locked out.
  if (!userId) return json({ error: "invalid" }, 400);

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) return json({ error: "server_error" }, 500);

  // A reset ends every existing login for the account, so a stolen session stops working.
  const { error: revokeError } = await admin.rpc("revoke_sessions", { p_user: userId });
  if (revokeError) return json({ error: "server_error" }, 500);

  // Recovery codes are single use: issue a fresh one.
  const fresh = newCode();
  const { error: setError } = await admin.rpc("set_recovery_code_for", { p_user: userId, p_code: fresh });
  if (setError) return json({ error: "server_error" }, 500);

  return json({ ok: true, newCode: fresh });
});
