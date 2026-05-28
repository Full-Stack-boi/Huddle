/**
 * Twitch OAuth Implicit Grant Redirect Handler
 *
 * After the user authorizes on Twitch, the browser is redirected here with the
 * access_token in the URL hash fragment (#access_token=...).  Because hash
 * fragments are never sent to the server, this endpoint returns a small HTML
 * page that extracts the token client-side and relays it to the Huddle Chrome
 * extension via `window.postMessage` (the extension's content script listens
 * on the page) and `chrome.runtime.sendMessage` (for the externally_connectable
 * path declared in manifest.json).
 */

export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Huddle – Twitch Connected</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Quicksand', sans-serif;
      background: #FFF8F0;
      color: #1E293B;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 3px solid #1E293B;
      border-radius: 16px;
      box-shadow: 4px 4px 0px #1E293B;
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
      width: 100%;
      animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes popIn {
      0% { transform: scale(0.8); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .logo { font-size: 2rem; font-weight: 700; color: #8B5CF6; margin-bottom: 8px; }
    .emoji { font-size: 3rem; margin-bottom: 16px; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 1rem; color: #475569; line-height: 1.5; }
    .status { margin-top: 20px; font-weight: 600; }
    .success { color: #16a34a; }
    .error { color: #dc2626; }
    .spinner {
      display: inline-block;
      width: 20px; height: 20px;
      border: 3px solid #8B5CF6;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🎬 Huddle</div>
    <div class="emoji" id="statusEmoji">⏳</div>
    <h1 id="statusTitle">Connecting…</h1>
    <p id="statusMsg">Sending your Twitch credentials to the extension.</p>
    <p class="status" id="statusDetail"></p>
  </div>

  <script>
    (function () {
      var hash = window.location.hash.substring(1);
      var params = new URLSearchParams(hash);
      var accessToken = params.get('access_token');
      var error = params.get('error');

      var elEmoji = document.getElementById('statusEmoji');
      var elTitle = document.getElementById('statusTitle');
      var elMsg   = document.getElementById('statusMsg');
      var elDetail = document.getElementById('statusDetail');

      if (error || !accessToken) {
        elEmoji.textContent = '❌';
        elTitle.textContent = 'Connection Failed';
        elMsg.textContent = error
          ? 'Twitch returned an error: ' + error
          : 'No access token received. Please try again.';
        elDetail.className = 'status error';
        elDetail.textContent = 'You can close this tab.';
        return;
      }

      // Relay token to extension via postMessage (content script listener)
      var payload = {
        type: 'HUDDLE_TWITCH_TOKEN',
        accessToken: accessToken
      };

      window.postMessage(payload, '*');

      // Give the extension a moment to pick it up, then show success
      setTimeout(function () {
        elEmoji.textContent = '✅';
        elTitle.textContent = 'Connected!';
        elMsg.textContent = 'Your Twitch account is linked. You can close this tab.';
        elDetail.className = 'status success';
        elDetail.textContent = 'Redirecting back…';

        // Attempt to close after a brief delay
        setTimeout(function () {
          window.close();
          // If window.close() is blocked, update the message
          elDetail.textContent = 'You can close this tab now.';
        }, 2000);
      }, 800);
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
}
