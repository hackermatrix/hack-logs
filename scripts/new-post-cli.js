#!/usr/bin/env node

/**
 * Blog Post Initialization Script (CLI Version)
 * Updates posts.json based on command-line arguments.
 * Usage: node new-post-cli.js --title="Blog Title" --date="YYYY-MM-DD" --tags="tag1,tag2" --description="Post Description"
 */

const fs = require('fs');
const path = require('path');

// --- Configuration ---
const POSTS_DIR = path.join(__dirname, '..', 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');
const ARGS = parseArgs(process.argv.slice(2));

// --- Helper Functions ---

function parseArgs(args) {
  const result = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      if (parts.length > 1) {
        result[parts[0]] = parts.slice(1).join('=');
      } else {
        result[parts[0]] = true; // Boolean flag
      }
    }
  }
  return result;
}

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
    // If file doesn't exist or is invalid, assume starting at 1
    return 1;
  }
}

function generateSlug(title, blogNumber, date) {
  // Format date as DD-MM-YYYY
  const dateStr = date.split('-').reverse().join('-'); // Convert YYYY-MM-DD to DD-MM-YYYY
  const dateSlug = dateStr.replace(/-/g, '-');
  
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

// --- Main Execution ---

function main() {
  // 1. Validate Arguments
  const { title, description, date, tags } = ARGS;
  
  if (!title) {
    console.error('❌ Missing required argument: --title');
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0];
  const dateInput = date || today;
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    console.error('❌ Invalid date format! Please use YYYY-MM-DD');
    process.exit(1);
  }

  const tagsArray = tags 
    ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];
  
  const descriptionText = description || title;

  try {
    // 2. Generate Slug
    const blogNumber = getNextBlogNumber();
    const slug = generateSlug(title, blogNumber, dateInput);

    console.log(`📋 Generated slug: ${slug}`);

    // 3. Ensure Posts Directory Exists (optional, but good practice)
    if (!fs.existsSync(POSTS_DIR)) {
      fs.mkdirSync(POSTS_DIR, { recursive: true });
    }

    // 4. Update posts.json
    let postsData = { posts: [] };
    if (fs.existsSync(POSTS_JSON)) {
      postsData = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
    }

    const newPost = {
      slug: slug,
      title: title,
      description: descriptionText,
      date: dateInput,
      tags: tagsArray
    };

    // Check if post already exists by slug (prevent duplicates)
    if (postsData.posts.some(p => p.slug === slug)) {
      console.warn(`⚠️ Post with slug ${slug} already exists in posts.json. Aborting index update.`);
      return;
    }

    // Add to beginning of posts array (newest first)
    postsData.posts.unshift(newPost);
    
    // Write back to file with proper formatting
    fs.writeFileSync(
      POSTS_JSON,
      JSON.stringify(postsData, null, 2) + '\n',
      'utf8'
    );
    console.log(`✅ Updated posts.json with new post: ${slug}`);
    console.log(`Next step: Move content and cover image to a directory named: ${slug}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
