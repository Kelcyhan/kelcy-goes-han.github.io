// Breadcrumb generator for task hierarchy
// Usage in task files: `$= dv.view('_system/scripts/breadcrumb', {page: dv.current()})`

function buildBreadcrumb(page) {
    const parts = page.id.split('.');
    const links = [];

    // Build parent links
    for (let i = 0; i < parts.length - 1; i++) {
        const parentId = parts.slice(0, i + 1).join('.');
        links.push(`[[${parentId}]]`);
    }

    // Status emoji
    const statusEmoji = {
        'done': '✅',
        'active': '🔄',
        'blocked': '⏳',
        'todo': '📋',
        'failed': '❌',
        'pivoted': '🔀'
    };

    const status = statusEmoji[page.status] || '📋';

    // Add current task (bold, not linked)
    links.push(`**${page.id} — ${page.title}** ${status}`);

    return `> [!info] ${links.join(' / ')}`;
}

// For DataviewJS view() calls
if (typeof input !== 'undefined' && input.page) {
    dv.paragraph(buildBreadcrumb(input.page));
}

// For direct calls
if (typeof dv !== 'undefined' && typeof input === 'undefined') {
    const page = dv.current();
    dv.paragraph(buildBreadcrumb(page));
}
