// Minimal Decap CMS "github" backend OAuth proxy.
//
// Decap opens a popup at {base_url}/auth, which redirects here to GitHub's
// own OAuth authorize screen. GitHub redirects back to /callback with a
// code, which is exchanged server-side for an access token (this exchange
// requires the client secret, which is why it can't happen in the browser).
// The token is then handed back to the CMS tab via the exact postMessage
// handshake Decap/Netlify CMS expect: the popup announces itself with
// "authorizing:github", waits for the opener to acknowledge, then sends
// "authorization:github:success:{...}" carrying the real token.
//
// GITHUB_CLIENT_ID is a plain var (it's public anyway, visible in the
// authorize URL). GITHUB_CLIENT_SECRET is set as a Worker secret via
// `wrangler secret put`, never committed to the repo.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(url, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(request, url, env);
    }
    return new Response("Not found", { status: 404 });
  },
};

function handleAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "public_repo");
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({ Location: authorizeUrl.toString() });
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; Path=/; Max-Age=600; SameSite=Lax`
  );
  return new Response(null, { status: 302, headers });
}

async function handleCallback(request, url, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("Cookie") || "";
  const savedState = (cookieHeader.match(/oauth_state=([^;]+)/) || [])[1];

  if (!code || !state || state !== savedState) {
    return new Response("Invalid OAuth state.", { status: 400 });
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return new Response(
      `OAuth error: ${tokenData.error_description || "no token returned"}`,
      { status: 400 }
    );
  }

  const payload = JSON.stringify({ token: tokenData.access_token, provider: "github" });
  const message = `authorization:github:success:${payload}`;

  const html = `<!doctype html>
<html><body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      ${JSON.stringify(message)},
      e.origin
    );
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
