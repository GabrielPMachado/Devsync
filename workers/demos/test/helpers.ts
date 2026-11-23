export interface Call {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

/** fetch falso: registra as chamadas e responde com `handler`. */
export function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const call: Call = {
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body ? await req.text() : null,
    };
    calls.push(call);
    return handler(call);
  };
  return { fetch: f as typeof fetch, calls };
}
