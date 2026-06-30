#!/usr/bin/env python3
import os
import re
import yaml
from pathlib import Path

def get_status_emoji(status):
    return {
        'done': '✅',
        'active': '🔄',
        'blocked': '⏳',
        'todo': '📋',
        'failed': '❌',
        'pivoted': '🔀'
    }.get(status, '📋')

def build_id_to_file_map(base_dir):
    """Build a mapping from task ID to filename (without extension)"""
    id_map = {}

    # Walk through all task files
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.md'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Extract YAML frontmatter
                    yaml_match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
                    if yaml_match:
                        yaml_content = yaml.safe_load(yaml_match.group(1))
                        task_id = yaml_content.get('id', '')
                        if task_id:
                            # Store filename without extension
                            id_map[task_id] = Path(file).stem
                except Exception:
                    pass

    return id_map

def build_breadcrumb(task_id, title, status, id_map):
    """Build breadcrumb using filename-based links"""
    parts = task_id.split('.')
    links = []

    # Build parent links using actual filenames
    for i in range(len(parts) - 1):
        parent_id = '.'.join(parts[:i+1])
        parent_filename = id_map.get(parent_id, parent_id)
        # Format: [[filename|display_id]]
        links.append(f'[[{parent_filename}|{parent_id}]]')

    # Add current task (bold, not linked)
    emoji = get_status_emoji(status)
    links.append(f'**{task_id} — {title}** {emoji}')

    return f'> [!info] {" / ".join(links)}'

def fix_breadcrumb(filepath, id_map):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract YAML frontmatter
    yaml_match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
    if not yaml_match:
        return

    yaml_content = yaml.safe_load(yaml_match.group(1))
    task_id = yaml_content.get('id', '')
    title = yaml_content.get('title', '')
    status = yaml_content.get('status', 'todo')

    if not task_id or not title:
        return

    # Build new breadcrumb
    new_breadcrumb = build_breadcrumb(task_id, title, status, id_map)

    # Replace old breadcrumb
    pattern = r'^> \[!info\].*$'
    new_content = re.sub(pattern, new_breadcrumb, content, count=1, flags=re.MULTILINE)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f'✓ {Path(filepath).name}')

# Main
base_dir = '/home/philipp.linux/coden/obsidian_test/projects/WideWorker'
print('Building ID map...')
id_map = build_id_to_file_map(base_dir)

print(f'Fixing {len(id_map)} tasks...')
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith('.md') and (file.startswith('task_') or file == 'WideWorker.md'):
            try:
                fix_breadcrumb(os.path.join(root, file), id_map)
            except Exception as e:
                print(f'Error: {file}: {e}')

print('\n✅ Done!')
