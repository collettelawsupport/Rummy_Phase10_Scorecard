# Family Scorecard

A device-local scorekeeper for Rummy and Phase 10. It supports two to six players, saved games, automatic dealer rotation, Rummy tiebreaks, Phase 10 phase tracking, round undo, and a persistent Bo vs. Daylene Rummy record.

## Run locally

Serve the `dist` directory with any static web server. For example:

```sh
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.

## Deploy to Netlify

Connect the repository in Netlify. The included `netlify.toml` publishes the `dist` directory and does not require a build command.

## Data storage

Games and the Bo vs. Daylene record are stored in browser local storage. They survive browser and computer restarts on the same browser and device. Clearing site data, using another browser, or switching devices will not carry the record over.
