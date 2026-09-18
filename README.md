# Family Scorecard

A family scorekeeper for Rummy and Phase 10. It supports two to six players, saved games, automatic dealer rotation, per-round winners, Rummy tiebreaks, Phase 10 phase tracking, round undo, and a shared Bo vs. Daylene Rummy record with wins and cumulative points.

## Run locally

Serve the `dist` directory with any static web server. For example:

```sh
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.

## Deploy to Netlify

Connect the repository in Netlify. The included `netlify.toml` publishes the `dist` directory and deploys the shared-record function. Netlify installs the small Blob-storage dependency automatically.

## Data storage

Individual game scorecards stay in browser local storage and survive restarts on that device. The Bo vs. Daylene wins and cumulative points are stored as one app-wide record in Netlify Blobs, so every device opening the deployed link sees the same record. Because the shared app is intentionally link-accessible, anyone with the link can update that record.
