#!/usr/bin/env node

/**
 * Blog Post Initialization Script
 * Creates a new blog post with markdown file, directory, and updates posts.json
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
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

function createMarkdownTemplate(title) {
  return `# ${title}

## Introduction

Write your introduction here...

## Main Content

Start writing your blog post content here...

## Conclusion

Wrap up your thoughts here...

`;
}

async function main() {
  console.log('\n🚀 Blog Post Initialization Script\n');
  console.log('This script will help you create a new blog post.\n');

  try {
    // Get blog post details
    const title = await question('📝 Enter blog post title: ');
    if (!title.trim()) {
      console.error('❌ Title is required!');
      process.exit(1);
    }

    const description = await question('📄 Enter description (optional): ') || '';
    
    // Get date (default to today)
    const today = new Date().toISOString().split('T')[0];
    const dateInput = await question(`📅 Enter date (YYYY-MM-DD) [${today}]: `) || today;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      console.error('❌ Invalid date format! Please use YYYY-MM-DD');
      process.exit(1);
    }

    // Get tags
    const tagsInput = await question('🏷️  Enter tags (comma-separated): ') || '';
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Generate slug
    const blogNumber = getNextBlogNumber();
    const slug = generateSlug(title, blogNumber, dateInput);

    console.log(`\n📋 Generated slug: ${slug}\n`);

    // Confirm
    const confirm = await question('✅ Create this post? (y/n): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled.');
      rl.close();
      return;
    }

    // Create directory
    const postDir = path.join(POSTS_DIR, slug);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
      console.log(`✅ Created directory: ${postDir}`);
    }

    // Create markdown file
    const markdownFile = path.join(POSTS_DIR, `${slug}.md`);
    const markdownContent = createMarkdownTemplate(title);
    fs.writeFileSync(markdownFile, markdownContent, 'utf8');
    console.log(`✅ Created markdown file: ${markdownFile}`);

    // Create placeholder cover.jpg note
    const coverPath = path.join(postDir, 'cover.jpg');
    console.log(`📸 Note: Add your cover image at: ${coverPath}`);

    // Update posts.json
    const postsData = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
    const newPost = {
      slug: slug,
      title: title,
      description: description || title,
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

    console.log('\n✨ Blog post created successfully!\n');
    console.log(`📝 Edit your post: ${markdownFile}`);
    console.log(`🖼️  Add cover image: ${coverPath}`);
    console.log(`\n🎉 Happy writing!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

