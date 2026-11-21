export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function authorizeMutation(
  request: Request,
  writeToken: string,
): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== requestUrl.origin) {
    return jsonResponse({ error: "cross-origin mutation rejected" }, 403);
  }
  if (request.headers.get("x-jig-write-token") !== writeToken) {
    return jsonResponse({ error: "invalid write token" }, 403);
  }
  return null;
}
