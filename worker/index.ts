interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const json = (value: unknown, init: ResponseInit = {}) =>
  Response.json(value, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...init.headers,
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        product: 'HOPSCOTCH',
        edge: 'cloudflare-workers',
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
