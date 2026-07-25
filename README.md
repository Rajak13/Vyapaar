# Vyapaar — landing hero

Vite + React project with just the hero section: navbar (logo, log in, register),
oversized wordmark, invoice/coin illustration, curved ribbon banner ("Leave the
boring stuff to us"), CTA pill, and a working light/dark theme toggle (the two
circular icons bottom right).

## Run it

```
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## Files

- `src/App.jsx` — the hero component and its pieces (illustration, ribbon)
- `src/App.css` — layout and theme styling
- `src/index.css` — color tokens (`--cream`, `--taupe`, `--brown`, `--ink`, `--orange`)

Colors and the two theme variants (`.app-dark` / `.app-light`) live in
`src/index.css` if you want to adjust the palette.
