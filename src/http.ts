export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Keep transport errors readable; never expose HTML or JSON parser exceptions in the UI. */
export async function requestJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new RequestError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      response.status,
      typeof data?.error === 'string'
        ? data.error.slice(0, 400)
        : 'Não foi possível concluir a ação. Tente novamente.',
    );
  if (data === null)
    throw new RequestError(
      response.status,
      'O servidor retornou uma resposta inesperada. Atualize a página e tente novamente.',
    );
  return data as T;
}
