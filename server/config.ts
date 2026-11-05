export type RuntimeRole = 'web' | 'bot';
export function validateRuntimeConfiguration(
  role: RuntimeRole,
  env: Record<string, string | undefined> = process.env,
) {
  const required =
    role === 'web'
      ? [
          'DATABASE_URL',
          'PUBLIC_ORIGIN',
          'MANUS_PROJECT_ID',
          'MANUS_OAUTH_API_URL',
          'MANUS_OAUTH_PORTAL_URL',
        ]
      : ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'PUBLIC_ORIGIN'];
  const issues = required
    .filter((key) => !env[key]?.trim())
    .map((key) => `${key} não configurado.`);
  const secureUrl = (key: string, originOnly = false) => {
    if (!env[key]) return;
    try {
      const url = new URL(env[key]);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        (originOnly && env[key] !== url.origin)
      )
        throw new Error();
    } catch {
      issues.push(
        `${key} deve ser uma URL HTTPS válida${originOnly ? ', sem caminho, query ou fragmento' : ''}.`,
      );
    }
  };
  if (role === 'web') {
    for (const key of ['PUBLIC_ORIGIN', 'MANUS_OAUTH_API_URL', 'MANUS_OAUTH_PORTAL_URL'])
      secureUrl(key, key === 'PUBLIC_ORIGIN');
    if (env.DATABASE_URL) {
      try {
        const url = new URL(env.DATABASE_URL);
        if (
          url.protocol !== 'mysql:' ||
          !url.hostname ||
          !url.username ||
          !url.password ||
          url.pathname.length < 2
        )
          throw new Error();
      } catch {
        issues.push('DATABASE_URL deve identificar um banco MySQL com usuário e senha.');
      }
    }
    if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535))
      issues.push('PORT deve estar entre 1 e 65535.');
  } else {
    if (env.DISCORD_CLIENT_ID && !/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID))
      issues.push('DISCORD_CLIENT_ID deve ser o Application ID numérico do Discord.');
    secureUrl('PUBLIC_ORIGIN', true);
    if (env.FRAGMENTOS_API_URL) {
      try {
        const url = new URL(env.FRAGMENTOS_API_URL);
        const privateHttp =
          url.protocol === 'http:' &&
          (url.hostname.endsWith('.railway.internal') ||
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
        if (
          (!privateHttp && url.protocol !== 'https:') ||
          url.username ||
          url.password ||
          url.pathname !== '/' ||
          url.search ||
          url.hash
        )
          throw new Error();
      } catch {
        issues.push(
          'FRAGMENTOS_API_URL deve ser uma origem HTTPS ou HTTP local/privada do Railway.',
        );
      }
    }
  }
  return issues;
}
export function assertRuntimeConfiguration(
  role: RuntimeRole,
  env: Record<string, string | undefined> = process.env,
) {
  const issues = validateRuntimeConfiguration(role, env);
  if (issues.length) throw new Error(`Configuração de ${role} incompleta: ${issues.join(' ')}`);
}
