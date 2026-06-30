# Automatic Breadcrumb with DataviewJS (v3)

Replace the static breadcrumb line with this DataviewJS block:

```dataviewjs
// Automatic breadcrumb generator (v3: project-scoped)
const current = dv.current();
const links = [];
const statusEmoji = {
    'done': '✅',
    'active': '🔄',
    'blocked': '⏳',
    'todo': '📋',
    'planning': '📝',
    'failed': '❌',
    'pivoted': '🔀'
};

// Build parent chain by traversing up (v3: filter by project_id)
let parentId = current.parent;
const parentChain = [];

while (parentId) {
    const parentFile = dv.pages()
        .where(p => p.project_id === current.project_id && p.id === parentId)
        .first();

    if (parentFile) {
        parentChain.unshift({id: parentId, file: parentFile.file});
        parentId = parentFile.parent;
    } else {
        break;
    }
}

// Build links for all parents
for (const parent of parentChain) {
    links.push(`[[${parent.file.name}|${parent.id}]]`);
}

// Add current task (bold, not linked)
const emoji = statusEmoji[current.status] || '📋';
links.push(`**${current.id} — ${current.title}** ${emoji}`);

// Output as info callout
dv.paragraph(`> [!info] ${links.join(' / ')}`);
```

## v3 Changes from v2

- Added `planning` status with 📝 emoji
- Parent lookup is now project-scoped: `p.project_id === current.project_id`
- This prevents cross-project ID collisions in breadcrumb traversal

## Usage

1. Copy the DataviewJS block above
2. Place it immediately after YAML frontmatter in any task file
3. The breadcrumb will automatically update when parent or status changes
