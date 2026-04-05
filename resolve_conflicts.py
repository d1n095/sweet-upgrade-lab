import subprocess, re, sys

def get_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def resolve_conflict_blocks(content, strategy):
    """
    strategy: callable(head_lines, theirs_lines) -> chosen_lines
    Returns resolved content.
    """
    result = []
    i = 0
    lines = content.split('\n')
    while i < len(lines):
        if lines[i].startswith('<<<<<<< HEAD'):
            head = []
            theirs = []
            i += 1
            while i < len(lines) and not lines[i].startswith('======='):
                head.append(lines[i])
                i += 1
            i += 1  # skip =======
            while i < len(lines) and not lines[i].startswith('>>>>>>> origin/main'):
                theirs.append(lines[i])
                i += 1
            i += 1  # skip >>>>>>>
            result.extend(strategy(head, theirs))
        else:
            result.append(lines[i])
            i += 1
    return '\n'.join(result)

def take_head(head, theirs): return head
def take_theirs(head, theirs): return theirs

# --- AdminBugReports.tsx: HEAD removed AI enrichment blocks; take HEAD (empty) for those sections ---
path = 'src/components/admin/AdminBugReports.tsx'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_head)
write_file(path, resolved)
print(f"Resolved {path}")

# --- AdminOrderManager.tsx: take theirs (uses safeInvoke not safeFetch) ---
path = 'src/components/admin/AdminOrderManager.tsx'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_theirs)
write_file(path, resolved)
print(f"Resolved {path}")

# --- AdminProductForm.tsx: take theirs (main deleted AiContentGenerator) ---
path = 'src/components/admin/AdminProductForm.tsx'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_theirs)
write_file(path, resolved)
print(f"Resolved {path}")

# --- SafeModePanel.tsx ---
path = 'src/components/admin/SafeModePanel.tsx'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_theirs)
write_file(path, resolved)
print(f"Resolved {path}")

# --- workItemReview.ts: keep HEAD naming ---
path = 'src/lib/workItemReview.ts'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_head)
write_file(path, resolved)
print(f"Resolved {path}")

# --- Checkout.tsx: take theirs ---
path = 'src/pages/Checkout.tsx'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_theirs)
write_file(path, resolved)
print(f"Resolved {path}")

# --- AdminLayout.tsx: take HEAD (our label renames) ---
path = 'src/pages/admin/AdminLayout.tsx'
content = get_file(path)
resolved = resolve_conflict_blocks(content, take_head)
write_file(path, resolved)
print(f"Resolved {path}")

