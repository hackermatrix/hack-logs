# Hrishikesh’s Security Logs

A static, markdown-powered blog for cybersecurity and CTF writeups. Neon cyberpunk theme, search, tags, and code highlighting.

## Features
- Markdown posts with safe rendering (Marked + DOMPurify)
- Syntax highlighting (Prism + autoloader)
- Search and tag filters
- Hash routing for post pages (`#/post/<slug>`) — works on any static host

## Getting started

1. Install Node.js (18+ recommended).
2. Start the local server:
   - With Node: `node server.js` (defaults to http://localhost:5173)
   - Or with a port: `node server.js 3000`
3. Open the URL printed in your terminal.

## Add a post

1. Create a markdown file at `posts/<your-slug>.md`.
2. Add an entry in `posts/posts.json` like:

```json
{
  "slug": "your-slug",
  "title": "Readable title",
  "description": "One-liner about the post",
  "date": "2025-10-17",
  "tags": ["ctf", "recon", "linux"]
}
```

- `slug` must match the markdown filename.
- `date` is `YYYY-MM-DD`.
- `tags` can be any short strings you like.

## Images

Place images alongside the post in a folder `posts/<slug>/` and reference them with relative paths in markdown. The renderer rewrites relative image URLs to `posts/<slug>/...` automatically.

Example structure:
```
posts/
  web-pentest-notes.md
  web-pentest-notes/
    login-success.png
    flow.png
```

Markdown usage:
```md
![Login success](login-success.png)
![Flow](images/flow.png)
```

Absolute URLs and data URLs are left untouched.

## Formatting tips

- Use fenced code blocks with language hints (e.g., `bash`, `python`, `nginx`, `yaml`).
- Headings (`##`, `###`) auto-build a table of contents.
- Inline code uses backticks: `like_this`.

## Deploy

This is static — host the folder anywhere (GitHub Pages, Netlify, Vercel, S3, Nginx). Because routing uses URL hashes, no special server rules are needed.

## License

MIT
\n\n### Fix Log\n- Backtick escaping fixed in Kerberos post (2026-02-01)
