// One login entry point for legacy usernames and optional server-side email aliases.
export function normalizeLoginIdentifier(value) {
  return String(value ?? '').trim().toLowerCase();
}
export function isEmailAlias(identifier) {
  const normalized = normalizeLoginIdentifier(identifier);
  return normalized.includes('@') && !normalized.endsWith('@wifi-users.bantuberes.com');
}
export async function signInWithIdentifier(client, identifier, password) {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized || !password) return { data: null, error: new Error('Isi username atau email serta password.') };
  if (!isEmailAlias(normalized)) {
    const email = normalized.includes('@') ? normalized : normalized + '@wifi-users.bantuberes.com';
    return client.auth.signInWithPassword({ email, password: String(password) });
  }
  const { data, error } = await client.functions.invoke('login-alias', {
    body: { email: normalized, password: String(password) }
  });
  if (error || !data?.access_token || !data?.refresh_token) {
    return { data: null, error: new Error('Email atau password tidak sesuai. Akun username lama juga bisa masuk dengan username.') };
  }
  return client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
}
