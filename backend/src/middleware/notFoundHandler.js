/**
 * HTTP methods that some registered route accepts for `path`, collected by
 * walking the Express router stack (app → mounted routers → routes).
 * Only runs for requests that matched nothing, so the cost is irrelevant.
 */
const allowedMethods = (stack, path, methods = new Set()) => {
  for (const layer of stack || []) {
    let matched = false;
    try {
      matched = layer.match(path);
    } catch {
      matched = false; // malformed percent-encoding: not a match
    }
    if (!matched) continue;
    if (layer.route) {
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled && method !== '_all') methods.add(method.toUpperCase());
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const rest = path.slice(layer.path.length);
      allowedMethods(layer.handle.stack, rest.startsWith('/') ? rest : `/${rest}`, methods);
    }
  }
  return methods;
};

/**
 * Unknown route → 404 JSON. A known path called with the wrong method → 405
 * with an `Allow` header, so clients can tell a typo from a wrong verb.
 */
export const notFoundHandler = (req, res) => {
  const methods = allowedMethods(req.app._router?.stack, req.path);
  if (methods.size > 0 && !methods.has(req.method)) {
    if (methods.has('GET')) methods.add('HEAD');
    const allow = [...methods].sort().join(', ');
    res.set('Allow', allow);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} is not allowed for ${req.originalUrl.split('?')[0]}. Allowed: ${allow}.`
    });
  }
  return res.status(404).json({
    success: false,
    message: `API Route Not Found: [${req.method}] ${req.originalUrl}`
  });
};
