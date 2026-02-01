#!/usr/bin/env node

/**
 * Blog Post Automation Script
 * Creates a new blog post with markdown file, directory, updates posts.json, and handles content.
 * Non-interactive: takes all input via command line arguments.
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');

// --- Helper Functions (copied/modified from new-post.js) ---

function getNextBlogNumber() {
  try {
    const postsData = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
    const posts = postsData.posts || [];
    
    // Extract blog numbers from slugs like "blg1-", "blg2-", etc.
    const numbers = posts
      .map(p => {
        const match = p.slug.match(/^blg(\d+)-/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  } catch (error) {
    // If posts.json is missing or invalid, start from 1
    return 1;
  }
}

function generateSlug(title, blogNumber, date) {
  // Format date as DD-MM-YYYY
  const dateParts = date.split('-'); // Assumes YYYY-MM-DD
  const dateSlug = dateParts.reverse().join('-');
  
  // Create slug from title
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50); // Limit length
  
  return `blg${blogNumber}-${dateSlug}-${titleSlug}`;
}

function createMarkdownContent(title, content) {
    // The content argument is expected to be the full markdown body.
    // We trust that the caller has included the necessary H1 (or H2)
    // for the post's main title within the 'content' string itself.
    return content;
}

function main() {
  const argv = yargs(process.argv.slice(2))
    .option('title', {
      alias: 't',
      description: 'Title of the blog post',
      type: 'string',
      demandOption: true,
    })
    .option('content', {
      alias: 'c',
      description: 'Full markdown content of the blog post',
      type: 'string',
      demandOption: true,
    })
    .option('description', {
      alias: 'd',
      description: 'Short description for the posts.json entry',
      type: 'string',
    })
    .option('tags', {
      alias: 'g',
      description: 'Comma-separated tags (e.g., "cybersecurity,linux")',
      type: 'string',
    })
    .option('date', {
      alias: 'D',
      description: 'Publication date (YYYY-MM-DD)',
      type: 'string',
      default: new Date().toISOString().split('T')[0],
    })
    .help()
    .alias('h', 'help')
    .argv;
    
  const title = argv.title;
  const rawContent = argv.content;
  const description = argv.description || title;
  const dateInput = argv.date;
  const tags = argv.tags ? argv.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];


  // 1. Validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    console.error('❌ Invalid date format! Please use YYYY-MM-DD');
    process.exit(1);
  }

  // 2. Generation
  const blogNumber = getNextBlogNumber();
  const slug = generateSlug(title, blogNumber, dateInput);

  console.log(`\n📋 Generated slug: ${slug}`);

  // 3. Create Directory
  const postDir = path.join(POSTS_DIR, slug);
  if (!fs.existsSync(postDir)) {
    fs.mkdirSync(postDir, { recursive: true });
    console.log(`✅ Created directory: ${postDir}`);
  } else {
    console.warn(`⚠️ Directory already exists: ${postDir}`);
  }

  // 4. Create Markdown File
  const markdownFile = path.join(POSTS_DIR, `${slug}.md`);
  const markdownContent = createMarkdownContent(title, rawContent);
  fs.writeFileSync(markdownFile, markdownContent, 'utf8');
  console.log(`✅ Created markdown file: ${markdownFile}`);

  // 5. Placeholder for Cover Image (Agent will place the image here)
  const coverPath = path.join(postDir, 'cover.jpg');
  console.log(`📸 Cover image expected at: ${coverPath}`);
  
  // 6. Update posts.json
  const postsData = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
  const newPost = {
    slug: slug,
    title: title,
    description: description,
    date: dateInput,
    tags: tags
  };

  // Add to beginning of posts array (newest first)
  postsData.posts.unshift(newPost);
  
  // Write back to file with proper formatting
  fs.writeFileSync(
    POSTS_JSON,
    JSON.stringify(postsData, null, 2) + '\n',
    'utf8'
  );
  console.log(`✅ Updated posts.json`);

  console.log(`\n✨ Automation complete for post: ${title}`);
  console.log(`OUTPUT_PATH:${postDir}`);
}

main();
