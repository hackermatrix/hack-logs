// Minimal client-side blog engine for Markdown posts
// - Loads posts.json manifest
// - Supports search, tag filters, and hash-based routing (#/post/slug)
// - Renders Markdown to sanitized HTML, with Prism highlighting

const state = {
  posts: [],
  tags: new Set(),
  filteredTag: null,
  searchQuery: "",
  theme: null,
};

const elements = {
  postList: document.getElementById("postList"),
  tagsContainer: document.getElementById("tagsContainer"),
  postView: document.getElementById("postView"),
  homeView: document.getElementById("homeView"),
  postTitle: document.getElementById("postTitle"),
  postContent: document.getElementById("postContent"),
  postDate: document.getElementById("postDate"),
  postTags: document.getElementById("postTags"),
  searchInput: document.getElementById("searchInput"),
  randomBtn: document.getElementById("randomBtn"),
  toc: document.getElementById("toc"),
  themeToggle: document.getElementById("themeToggle"),
};

function getPreferredTheme() {
  const saved = localStorage.getItem("nhl-theme");
  if (saved === "terminal" || saved === "neon") return saved;
  // default by system preference is neon; could switch based on prefers-color-scheme if needed
  return "neon";
}

function applyTheme(theme) {
  state.theme = theme;
  const root = document.documentElement;
  if (theme === "terminal") {
    root.setAttribute("data-theme", "terminal");
  } else {
    root.removeAttribute("data-theme");
  }
  localStorage.setItem("nhl-theme", theme);
  if (elements.themeToggle) {
    elements.themeToggle.setAttribute("aria-pressed", theme === "terminal" ? "true" : "false");
    elements.themeToggle.textContent = theme === "terminal" ? "🖥️" : "🌓";
    elements.themeToggle.title = theme === "terminal" ? "Switch to Neon" : "Switch to Terminal";
  }
}

function toggleTheme() {
  applyTheme(state.theme === "terminal" ? "neon" : "terminal");
}

async function loadManifest() {
  const res = await fetch("./posts/posts.json");
  if (!res.ok) throw new Error("Failed to load posts.json");
  const manifest = await res.json();
  state.posts = manifest.posts
    .map(p => ({ ...p, date: new Date(p.date) }))
    .sort((a, b) => b.date - a.date);
  for (const p of state.posts) {
    if (Array.isArray(p.tags)) p.tags.forEach(t => state.tags.add(t));
  }
}

function getTagCounts() {
  const counts = new Map();
  for (const post of state.posts) {
    const set = new Set(post.tags || []);
    for (const t of set) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return counts;
}

function renderTags() {
  const counts = getTagCounts();
  const allCount = state.posts.length;
  const tags = ["all", ...Array.from(state.tags).sort((a, b) => a.localeCompare(b))];
  elements.tagsContainer.innerHTML = "";
  for (const tag of tags) {
    const isAll = tag === "all";
    const isActive = (state.filteredTag === null && isAll) || state.filteredTag === tag;
    const count = isAll ? allCount : (counts.get(tag) || 0);
    const el = document.createElement("button");
    el.className = "tag" + (isActive ? " active" : "");
    el.setAttribute("type", "button");
    el.setAttribute("aria-pressed", isActive ? "true" : "false");
    el.setAttribute("data-tag", tag);
    el.innerHTML = `${escapeHtml(tag)} <span class="tag-count">${count}</span>`;
    el.addEventListener("click", () => {
      state.filteredTag = isAll ? null : tag;
      renderTags();
      renderList();
    });
    elements.tagsContainer.appendChild(el);
  }
}

function normalizeString(value) {
  return (value || "").toLowerCase().trim();
}

function updateSearch(query) {
  state.searchQuery = normalizeString(query);
  renderList();
}

function matchesFilters(post) {
  const q = normalizeString(state.searchQuery);
  const text = normalizeString(`${post.slug} ${post.title} ${post.description || ""} ${(post.tags || []).join(" ")}`);
  const matchesQuery = q.length === 0 || text.includes(q);
  const matchesTag = state.filteredTag === null || (post.tags || []).includes(state.filteredTag);
  return matchesQuery && matchesTag;
}

function renderList() {
  const filtered = state.posts.filter(matchesFilters);
  if (filtered.length === 0) {
    const q = state.searchQuery;
    elements.postList.innerHTML = `<div class="card"><h3>No results</h3><p>${q ? `Nothing found for \"${escapeHtml(q)}\"` : "Try another keyword or clear filters."}</p></div>`;
    return;
  }
  elements.postList.innerHTML = filtered.map(post => {
    const tagsHtml = (post.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
    const dateStr = post.date.toISOString().slice(0, 10);
    return `
      <a class="card" href="#/post/${post.slug}">
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.description || "")}</p>
        <div class="meta">
          <span>${dateStr}</span>
          <div class="tags">${tagsHtml}</div>
        </div>
      </a>`;
  }).join("");
}

function escapeHtml(s) {
  return s.replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]));
}

function rewriteRelativeImageSrcs(container, slug) {
  const imgs = container.querySelectorAll("img[src]");
  imgs.forEach(img => {
    const src = img.getAttribute("src") || "";
    // Skip absolute/protocol/data/hash sources
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#|data:)/i.test(src)) return;
    img.setAttribute("src", `./posts/${slug}/${src}`);
  });
}

async function showHome() {
  elements.homeView.classList.remove("view--hidden");
  elements.postView.classList.add("view--hidden");
}

function buildToc(slug) {
  const headings = elements.postContent.querySelectorAll("h2, h3");
  if (!headings.length) {
    elements.toc.innerHTML = "";
    return;
  }
  const links = Array.from(headings).map(h => {
    const id = h.id || h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    h.id = id;
    return `<a href="#/post/${slug}#${id}">${escapeHtml(h.textContent)}</a>`;
  }).join("");
  elements.toc.innerHTML = `<h4>On this page</h4>${links}`;
}

async function showPost(slug, anchorId) {
  const post = state.posts.find(p => p.slug === slug);
  if (!post) {
    elements.postTitle.textContent = "Not found";
    elements.postContent.innerHTML = "<p>Post not found.</p>";
    elements.postDate.textContent = "";
    elements.postTags.innerHTML = "";
    elements.homeView.classList.add("view--hidden");
    elements.postView.classList.remove("view--hidden");
    return;
  }
  const res = await fetch(`./posts/${post.slug}.md`);
  const markdown = await res.text();

  elements.postTitle.textContent = post.title;
  elements.postDate.textContent = post.date.toISOString().slice(0, 10);
  elements.postDate.setAttribute("datetime", post.date.toISOString());
  elements.postTags.innerHTML = (post.tags || []).map(t => `<span class="tag">${t}</span>`).join("");

  // Render markdown safely
  const html = marked.parse(markdown, { mangle: false, headerIds: true });
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true, svg: true } });
  elements.postContent.innerHTML = clean;

  // Rewrite relative image sources to posts/<slug>/
  rewriteRelativeImageSrcs(elements.postContent, post.slug);

  // Build TOC with slug-aware links
  buildToc(slug);

  // Highlight code blocks
  if (window.Prism) {
    Prism.highlightAllUnder(elements.postContent);
  }

  elements.homeView.classList.add("view--hidden");
  elements.postView.classList.remove("view--hidden");

  // Scroll to anchor (if provided or present in hash)
  const hashMatch = (typeof anchorId === 'string' && anchorId) ? [null, anchorId] : location.hash.match(/^#\/post\/[A-Za-z0-9-_]+#([A-Za-z0-9\-]+)/);
  const targetId = (hashMatch && hashMatch[1]) ? hashMatch[1] : null;
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function onHashChange() {
  const hash = location.hash;
  const match = hash.match(/^#\/post\/([A-Za-z0-9-_]+)(?:#([A-Za-z0-9\-]+))?/);
  if (match) {
    showPost(match[1], match[2] || null);
  } else {
    showHome();
  }
}

function initEvents() {
  elements.searchInput.addEventListener("input", e => updateSearch(e.target.value));
  elements.searchInput.addEventListener("search", e => updateSearch(e.target.value));
  elements.searchInput.addEventListener("keydown", e => {
    if (e.key === "Escape") { updateSearch(""); elements.searchInput.value = ""; }
  });

  elements.randomBtn.addEventListener("click", () => {
    if (!state.posts.length) return;
    const idx = Math.floor(Math.random() * state.posts.length);
    location.hash = `#/post/${state.posts[idx].slug}`;
  });
  document.querySelector(".back-link").addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = "";
  });
  window.addEventListener("hashchange", onHashChange);

  if (elements.themeToggle) {
    elements.themeToggle.addEventListener("click", toggleTheme);
  }
}

async function main() {
  // Theme first to avoid flash
  applyTheme(getPreferredTheme());

  await loadManifest();
  renderTags();
  renderList();
  initEvents();
  onHashChange();
}

main().catch(err => {
  console.error(err);
  elements.postList.innerHTML = `<div class="card"><h3>Load error</h3><p>${escapeHtml(String(err.message || err))}</p></div>`;
});


