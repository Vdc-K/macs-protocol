"""
PyMACS - Python SDK for MACS (Multi-Agent Collaboration System)

Usage:
    from pymacs import MACS

    # Initialize
    macs = MACS.init("My Project", path="./my-project")

    # Query
    changes = macs.query_changelog(type='feat', since='2026-02-20')

    # Update
    macs.add_changelog(
        type='feat',
        content='Implemented new feature',
        author='langchain-agent',
        tags=['#dev', '#api']
    )
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Literal

ChangeType = Literal['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'perf', 'style', 'ops', 'escalation']
TaskStatus = Literal['pending', 'in_progress', 'blocked', 'completed']


class MACS:
    """MACS (Multi-Agent Collaboration System) Python SDK"""

    def __init__(self, project_path: str = "."):
        self.project_path = Path(project_path).resolve()
        self.task_file = self.project_path / "TASK.md"
        self.changelog_file = self.project_path / "CHANGELOG.md"
        self.context_file = self.project_path / "CONTEXT.md"
        self.index_file = self.project_path / ".macs" / "index.json"

    @classmethod
    def init(cls, project_name: str, path: str = ".") -> 'MACS':
        """Initialize MACS in a project directory"""
        project_path = Path(path).resolve()
        project_path.mkdir(parents=True, exist_ok=True)

        macs = cls(path)

        # Create MACS files from templates
        # TODO: Copy templates from macs/templates/
        # For now, create basic structure

        if not macs.task_file.exists():
            macs.task_file.write_text(f"""# Task Board

> Project: {project_name}

## 🔥 Current Tasks

- [ ] First task here

## ✅ Completed Tasks

(Empty)
""")

        if not macs.changelog_file.exists():
            macs.changelog_file.write_text(f"""# Changelog

> Project: {project_name}

## {datetime.now().strftime('%Y-%m-%d')}

- [✨ feat] Initialized project - by pymacs #setup
""")

        if not macs.context_file.exists():
            macs.context_file.write_text(f"""# Project Context

> Project: {project_name}

## Overview

(To be filled)
""")

        return macs

    def query_changelog(
        self,
        type: Optional[ChangeType] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        author: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Query changelog entries with filters

        Returns list of changelog entries matching filters.
        If index exists, queries index (fast). Otherwise reads file (slow).
        """
        if self.index_file.exists():
            return self._query_from_index(type, since, until, author, tags, limit)
        else:
            return self._query_from_file(type, since, until, author, tags, limit)

    def _query_from_index(self, type, since, until, author, tags, limit):
        """Query from .macs/index.json (fast, 99% token reduction)"""
        with open(self.index_file) as f:
            index = json.load(f)

        entries = index.get('changelog', [])

        # Apply filters
        if type:
            entries = [e for e in entries if e['type'] == type]
        if since:
            entries = [e for e in entries if e['date'] >= since]
        if until:
            entries = [e for e in entries if e['date'] <= until]
        if author:
            entries = [e for e in entries if e.get('author') == author]
        if tags:
            entries = [e for e in entries if any(tag in e.get('tags', []) for tag in tags)]
        if limit:
            entries = entries[:limit]

        return entries

    def _query_from_file(self, type, since, until, author, tags, limit):
        """Query from CHANGELOG.md (slow, reads entire file)"""
        # TODO: Implement markdown parsing
        # For now, return empty
        return []

    def add_changelog(
        self,
        type: ChangeType,
        content: str,
        author: str,
        tags: Optional[List[str]] = None
    ):
        """Add entry to CHANGELOG.md"""
        tags_str = ' '.join(tags) if tags else ''
        emoji = self._get_type_emoji(type)

        entry = f"- [{emoji} {type}] {content} - by {author} {tags_str}\n"

        # Read existing content
        existing = self.changelog_file.read_text()

        # Find today's section or create it
        today = datetime.now().strftime('%Y-%m-%d')
        if f"## {today}" in existing:
            # Append to today's section
            lines = existing.split('\n')
            insert_idx = None
            for i, line in enumerate(lines):
                if line.startswith(f"## {today}"):
                    insert_idx = i + 2  # After date heading + blank line
                    break
            if insert_idx:
                lines.insert(insert_idx, entry.rstrip())
                existing = '\n'.join(lines)
        else:
            # Create new section
            # Insert after format section, before first date
            parts = existing.split('---\n')
            if len(parts) >= 2:
                header = parts[0] + '---\n'
                body = '---\n'.join(parts[1:])
                existing = header + f"\n## {today}\n\n{entry}\n" + body

        self.changelog_file.write_text(existing)

        # Invalidate index (needs regeneration)
        if self.index_file.exists():
            self.index_file.unlink()

    def query_tasks(
        self,
        status: Optional[TaskStatus] = None,
        assignee: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Query tasks from TASK.md"""
        if self.index_file.exists():
            with open(self.index_file) as f:
                index = json.load(f)

            tasks = index.get('tasks', [])

            if status:
                tasks = [t for t in tasks if t['status'] == status]
            if assignee:
                tasks = [t for t in tasks if t.get('assignee') == assignee]
            if tags:
                tasks = [t for t in tasks if any(tag in t.get('tags', []) for tag in tags)]

            return tasks
        else:
            # TODO: Parse from TASK.md
            return []

    def generate_index(self):
        """Generate .macs/index.json from markdown files

        This enables fast querying and 99% token reduction.
        Requires macs CLI tool to be installed.
        """
        import subprocess

        # Check if macs CLI is available
        try:
            subprocess.run(['macs', 'index', str(self.project_path)], check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Warning: macs CLI not found. Install from: https://github.com/your-org/macs")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get project statistics"""
        if self.index_file.exists():
            with open(self.index_file) as f:
                index = json.load(f)
            return index.get('stats', {})
        else:
            return {}

    @staticmethod
    def _get_type_emoji(type: ChangeType) -> str:
        """Get emoji for change type"""
        emojis = {
            'feat': '✨',
            'fix': '🐛',
            'docs': '📝',
            'refactor': '♻️',
            'test': '🧪',
            'chore': '🔧',
            'perf': '⚡',
            'style': '💄',
            'ops': '🔧',
            'escalation': '🚨'
        }
        return emojis.get(type, '🔧')


# ========== LangChain Integration ==========

try:
    from langchain.agents import Tool
    from langchain.memory import ConversationBufferMemory

    def create_macs_tools(project_path: str = ".") -> List[Tool]:
        """Create LangChain tools for MACS operations"""
        macs = MACS(project_path)

        return [
            Tool(
                name="query_recent_changes",
                func=lambda _: str(macs.query_changelog(limit=5)),
                description="Query recent 5 changelog entries. Returns list of recent changes."
            ),
            Tool(
                name="query_active_tasks",
                func=lambda _: str(macs.query_tasks(status='in_progress')),
                description="Query active tasks. Returns list of tasks in progress."
            ),
            Tool(
                name="add_changelog_entry",
                func=lambda input: macs.add_changelog(
                    type='feat',  # TODO: parse from input
                    content=input,
                    author='langchain-agent',
                    tags=['#dev']
                ),
                description="Add entry to CHANGELOG.md. Input should be the change description."
            )
        ]

except ImportError:
    pass  # LangChain not installed


# ========== Usage Example ==========

if __name__ == "__main__":
    # Initialize MACS
    macs = MACS.init("Demo Project", path="/tmp/pymacs-demo")

    # Add some changes
    macs.add_changelog(
        type='feat',
        content='Implemented user authentication',
        author='langchain-agent',
        tags=['#dev', '#auth']
    )

    macs.add_changelog(
        type='fix',
        content='Fixed JWT token expiration bug',
        author='langchain-agent',
        tags=['#fix', '#auth']
    )

    # Query
    recent_changes = macs.query_changelog(limit=5)
    print(f"Recent changes: {len(recent_changes)}")

    # Stats
    stats = macs.get_stats()
    print(f"Stats: {stats}")

    print("\n✓ PyMACS demo complete!")
    print(f"Check files in: {macs.project_path}")
