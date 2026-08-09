<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/dd16e017-5029-4295-b42c-f581f9c1ee23

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Multiplayer

Run the WebSocket relay in a second terminal:

`npm run multiplayer`

Then open the Vite app at `http://localhost:3000/` and enable `ONLINE MODE` in the main menu. Other browser tabs connected to the same WebSocket server appear as remote players. Set `WS_PORT` to use a different relay port.

For deployment, set the WebSocket endpoint before building the frontend:

`VITE_WS_URL=wss://your-game.example.com/multiplayer npm run build`

If the game page uses HTTPS, the client automatically uses `wss://` for the current host. In production, place the WebSocket server behind a TLS reverse proxy and forward WebSocket upgrades for the configured path or port.
