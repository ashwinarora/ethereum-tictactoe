/**
 * No-contact mode: the one place the rest of the app learns about it.
 *
 * `NO_CONTACT=true` in the server's environment produces a deployment with no way to reach
 * me: no link to my portfolio, GitHub, LinkedIn, video or other sites, and no email. Unset,
 * or any other value, is the normal site, unchanged.
 *
 * Everything that differs between the two deployments is decided here or in the
 * `nc:normal-only` / `nc:no-contact-only` blocks of the files in `public/` (see buildSite.js).
 * Take this site's URLs from `siteUrls`; never hard-code them elsewhere.
 * See README "No-contact mode".
 */
const path = require('path');

const NO_CONTACT = process.env.NO_CONTACT === 'true';

/**
 * The production game server. It is the only game engine: games live in its memory and it
 * holds the only wallet, so a no-contact deployment forwards /socket.io to it instead of
 * running its own (see socketProxy.js). This host also serves the normal site, so in
 * no-contact mode it must stay on the server and never reach the browser.
 */
const PRODUCTION_BACKEND = 'https://web-production-fc9f.up.railway.app';

/** Both URL sets. The keys are the `{{nc:key}}` tokens used in `public/`. */
const urlSets = {
    normal: {
        homeUrl: 'https://www.ethtictactoe.com/',
        howToPlayUrl: 'https://www.ethtactoe.com/howToPlay.html',
        socketUrl: PRODUCTION_BACKEND + '/',
    },
    // Relative, so every link and the socket stay on whichever origin serves the page.
    noContact: {
        homeUrl: '/',
        howToPlayUrl: '/howToPlay.html',
        socketUrl: '/',
    },
};

module.exports = {
    NO_CONTACT,

    /** The URL set of this deployment, already selected. */
    siteUrls: NO_CONTACT ? urlSets.noContact : urlSets.normal,

    /** Where /socket.io is forwarded in no-contact mode. Not used in normal mode. */
    BACKEND_URL: (process.env.NO_CONTACT_BACKEND_URL || PRODUCTION_BACKEND).replace(/\/+$/, ''),

    /** Sent as the X-Robots-Tag header and the robots meta tag in no-contact mode. */
    ROBOTS: 'noindex, nofollow',

    /** The files in `public/` are the source. The server only ever serves the built copy. */
    SOURCE_DIR: path.join(__dirname, 'public'),
    SERVED_DIR: path.join(__dirname, '.served', NO_CONTACT ? 'no-contact' : 'normal'),
};
