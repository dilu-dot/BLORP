# Google Sign-Up in Blorp AI Windows (V0.5.4 preview)

This release adds a **native-desktop Google sign-in option**, not an embedded Google popup. Google's installed-app guidance recommends the system browser and loopback redirect. Sign-in uses OAuth2 authorization code with random state and S256 PKCE. The resulting Google ID token is verified independently by the Blorp backend using the configured *Desktop OAuth Client ID*.

## Activate this feature
- Create Google Cloud OAuth **Desktop app** credentials and configure the Google consent screen.
- Backend: set `BLORP_GOOGLE_DESKTOP_CLIENT_ID` to the public Desktop Client ID, install `requirements-google.txt`, restart your updated Python backend.
- Desktop: open Blorp AI → Sign in → Continue with Google → browser → return to desktop.
- For existing password accounts, sign in first, then use **Connect Google** in Dashboard. Existing accounts cannot be automatically merged solely based on matching emails.
- Browser GIS remains separate and requires `BLORP_GOOGLE_CLIENT_ID` for its Web OAuth client.

No OAuth secret is included in the compiled app. The public EXE is a preview only: it does not include or deploy the backend. In offline mode or before OAuth setup the button cannot sign users in. The backend must remain private/local until a production security review.
