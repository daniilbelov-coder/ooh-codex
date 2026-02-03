# Replicate Proxy (Railway)

This is a small proxy that allows the Figma plugin UI to call Replicate without exposing an API token in the plugin UI. It forwards:

- `POST /v1/files`
- `POST /v1/predictions`
- `GET /v1/predictions/:id`

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway, create a new project from the repo.
3. Set environment variable:
   - `REPLICATE_API_TOKEN` = your Replicate token
4. Railway will run `npm install` and `npm start` in the `proxy/` folder.

## Health check

`GET /health` should return `{ "ok": true }`.

## Plugin configuration

Once deployed, your base URL will look like:

```
https://your-app.up.railway.app/v1
```

Send me that URL and I’ll wire it into the plugin and update `manifest.json`.
