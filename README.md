# Ethereum TicTacToe

A real-time two-player TicTacToe game with bets, on BNB Smart Chain Testnet (chain id 97). Live at [ethtactoe.com](https://www.ethtactoe.com).

- `app.js`: Express 4 and Socket.IO 2. It serves the site and runs the game engine: it keeps the games in memory, relays the moves between the two players, and ends each game on the contract with the server's wallet.
- `public/`: the site. Plain HTML, CSS and JavaScript, with no bundler.
- `contracts/`: the Solidity contract. Its ABI and address are in `contractData.js` and `app.js`.

## Running it

```sh
npm install
PRIVATE_KEY=0x... npm start
```

It listens on `PORT`, or 5000. `PRIVATE_KEY` is the wallet that calls `endGame` on the contract; the server does not start without it. Both can also go in a `.env` file, which git ignores.

Two things to know before running it locally:

- The page connects its socket to the production game server, not to the server that served it. The address is `socketUrl` in `noContact.js`.
- The server writes the site to `.served/` when it starts and serves that copy, never `public/` itself (see below). After editing a file in `public/`, restart the server.

## No-contact mode

This repo runs two deployments from the same branch. The only difference between them is one environment variable:

| `NO_CONTACT` | Deployment | Result |
| --- | --- | --- |
| unset, or anything but `true` | `ethtactoe.com` | The normal site |
| `true` | the `showcase.` deployment | Identical, except a visitor has no way to contact me or find my contact details |

In no-contact mode the responses have no "Developer Portfolio" link, no "Developed By" footer, no GitHub or LinkedIn link, no "Hire the Developer!" link, no video, no social preview image, and no email address in the console. The links between the two pages point at the deployment itself, the pages are `noindex`, and every response carries `X-Robots-Tag: noindex, nofollow`. All of it is decided when the server starts, so the contact content is absent from the HTML and the JavaScript rather than hidden.

### Where it lives

| File | Role |
| --- | --- |
| `noContact.js` | **The flag.** Exports `NO_CONTACT`, both URL sets (`siteUrls` is the one for this deployment) and the game server's address. The only place the app learns which deployment it is |
| `public/` | The source of the site, for both deployments. Blocks marked `nc:normal-only` and `nc:no-contact-only`, and `{{nc:key}}` tokens, say what differs |
| `buildSite.js` | Writes the site for the current mode to `.served/normal/` or `.served/no-contact/` at server start. `app.js` serves that directory. In normal mode the output is byte for byte what `public/` held before the markers were added |
| `socketProxy.js` | No-contact mode only. Forwards `/socket.io/` (long-polling and WebSocket) to the game server |
| `app.js` | Reads the flag: sends the header, serves the built site, and in no-contact mode starts the proxy instead of the game engine |
| `views/layout.pug` | The error page. Gets the robots meta tag in no-contact mode |
| `scripts/check-no-contact.mjs` | `npm run check:no-contact` |

### Markers and tokens

In the `.html`, `.js` and `.css` files of `public/`, a line that holds only a marker, written as a comment, opens or closes a block. Marker lines never reach the output.

```html
<!-- nc:normal-only -->
<a href="https://ashwinarora.com/">Developer Portfolio</a>
<!-- nc:end -->
<!-- nc:no-contact-only -->
<meta name="robots" content="noindex, nofollow">
<!-- nc:end -->
<a href="{{nc:howToPlayUrl}}">How to Play?</a>
```

```js
// nc:normal-only
console.log("only the normal site has this line")
// nc:end
```

`{{nc:key}}` becomes the value of `key` in the URL set of `noContact.js`. Blocks do not nest. A marker without its pair, or an unknown token, stops the server at start.

### One game engine

The game engine keeps its games in memory and finds a game by its on-chain id (`gameIndex = gameId - gameNumber - 1`, with `gameNumber` read from the contract once at start). A second engine on the same contract would count from a different `gameNumber`, break that mapping for both, and share the wallet's nonce. So a no-contact deployment runs no engine: it creates no wallet, does not read the contract, and needs no `PRIVATE_KEY`. The browser connects to its own origin, and the server forwards `/socket.io/` to the production game server. That server's address also serves the normal site, so it stays in `noContact.js` on the server and is never sent to the browser.

### Rules for future changes

1. **Put anything that leads to me in an `nc:normal-only` block**: a link to my portfolio or another of my sites, a profile, a handle, an address, an embed from one of my accounts, an image hosted under my name. My name alone, with no link, can stay.
2. **Never hard-code this site's URL or the game server's address in `public/`.** Add a key to both URL sets in `noContact.js` and use the `{{nc:key}}` token. The no-contact value must be a path on the deployment itself.
3. **Copy that invites contact needs a second wording** that reads complete without it, in an `nc:no-contact-only` block next to the original.
4. **Never serve `public/` or any other source directory.** No second `express.static`, no `res.sendFile` from it. The built copy in `.served/` is the only thing a browser can reach.
5. **Gate server responses on `NO_CONTACT`** from `noContact.js` (routes, pug views, headers, error messages). The check scans those too.
6. **Do not start a second game engine**, and do not deploy the server in normal mode a second time. See above.
7. **Images are yours to check.** The script reads text, not pixels, and the build copies every file in `public/` to both deployments. So an image that shows a link to me, a social icon or an address cannot go in `public/` as it is: teach `buildSite.js` to leave it out of the no-contact build first.
8. **Run `npm run check:no-contact` before pushing.** It starts the server with `NO_CONTACT=true` against a stub game server, so it never touches production. It requests both pages, every file in `public/`, the routes, an unknown path and a set of path tricks, and fails on email addresses, `mailto:`, `tel:`, Calendly, Telegram, WhatsApp, LinkedIn, X/Twitter, Discord, GitHub, Flickr, YouTube, my handles, "hire", "portfolio", `vercel.app`, `railway.app`, `herokuapp.com`, the normal domains of my sites, an unprocessed marker, a missing `noindex`, and the game server's address. It also plays a Socket.IO round trip through the proxy over both transports. There is no CI in this repo, so this is the check.

The check uses two free ports from 4841 upwards; set `CHECK_PORT` to start elsewhere. Its allowlist is at the top of the script. Each entry is one exact match in one file, with its reason, and an entry that no longer matches fails the check.

### Deploying it

Set `NO_CONTACT=true` on the service and deploy the default branch with the same start command (`node app.js`). Do not set `PRIVATE_KEY`. One optional variable exists, and is ignored unless `NO_CONTACT=true`:

| Variable | Purpose |
| --- | --- |
| `NO_CONTACT_BACKEND_URL` | The game server to forward `/socket.io/` to, instead of the production one. For local testing: run a second copy in normal mode with a throwaway key and point this at it |
