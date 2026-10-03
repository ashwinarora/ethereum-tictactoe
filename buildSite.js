// Builds the site that the server serves, from the source files in `public/`.
//
// `public/` is never served directly, because some of its files hold content for both
// deployments (see noContact.js). At server start this writes the copy for the current
// mode to another directory, and that copy is the only thing express.static sees.
//
// In .html, .js and .css files:
//
//   A line holding only one of these markers, written as a comment in the file's own
//   syntax (`<!-- nc:end -->`, `// nc:end`, `/* nc:end */`), is removed from the output:
//     nc:normal-only       the lines up to nc:end exist only in the normal site
//     nc:no-contact-only   the lines up to nc:end exist only in the no-contact site
//     nc:end               closes the block. Blocks do not nest.
//
//   `{{nc:key}}` is replaced by `tokens[key]` (the URL set in noContact.js).
//
// Every other file, and every other byte, is copied unchanged.
const fs = require('fs');
const path = require('path');

const MARKER = /^\s*(?:<!--|\/\/|\/\*)\s*nc:(normal-only|no-contact-only|end)\s*(?:-->|\*\/)?\s*$/;
const TOKEN = /\{\{nc:(\w+)\}\}/g;
const PROCESSED = new Set(['.html', '.js', '.css']);

function render(source, { noContact, tokens, file }) {
    const kept = [];
    let open = null;

    source.split('\n').forEach((line, index) => {
        const where = `${file}:${index + 1}`;
        const marker = MARKER.exec(line);
        if (marker) {
            const kind = marker[1];
            if (kind === 'end') {
                if (!open) throw new Error(`${where}: nc:end without an open block`);
                open = null;
            } else {
                if (open) throw new Error(`${where}: nc:${kind} inside the nc:${open.kind} block opened at line ${open.line}`);
                open = { kind, line: index + 1 };
            }
            return;
        }
        if (open && (open.kind === 'no-contact-only') !== noContact) return;
        kept.push(line.replace(TOKEN, (token, key) => {
            if (typeof tokens[key] !== 'string') throw new Error(`${where}: unknown token ${token}`);
            return tokens[key];
        }));
    });

    if (open) throw new Error(`${file}:${open.line}: nc:${open.kind} is never closed with nc:end`);
    return kept.join('\n');
}

function build(sourceDir, outDir, options) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const from = path.join(sourceDir, entry.name);
        const to = path.join(outDir, entry.name);
        if (entry.isDirectory()) {
            build(from, to, options);
            continue;
        }
        if (PROCESSED.has(path.extname(entry.name).toLowerCase())) {
            // latin1 maps every byte to one character and back, so untouched lines stay
            // byte-identical whatever their encoding.
            fs.writeFileSync(to, render(fs.readFileSync(from, 'latin1'), { ...options, file: from }), 'latin1');
        } else {
            fs.copyFileSync(from, to);
        }
        // Keep the source's timestamps: express.static derives Last-Modified and ETag from them.
        const { atime, mtime } = fs.statSync(from);
        fs.utimesSync(to, atime, mtime);
    }
}

/**
 * Writes the site for one mode to `outDir`, replacing whatever was there.
 * Throws on a malformed marker or an unknown token, so a broken source file stops the
 * server at start instead of being served.
 */
module.exports = function buildSite({ sourceDir, outDir, noContact, tokens }) {
    fs.rmSync(outDir, { recursive: true, force: true });
    build(sourceDir, outDir, { noContact, tokens });
    return outDir;
};

module.exports.render = render;
