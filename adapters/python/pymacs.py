"""
PyMACS — MACS Protocol v3.0 Python SDK

Minimal Python wrapper around the `macs` CLI.
Works with LangChain, CrewAI, AutoGen, Ollama, or any Python agent framework.

Usage:
    from pymacs import MACS, MACSAgent

    macs = MACS()
    agent = MACSAgent("engineer-agent", capabilities=["backend", "testing"])
    task = agent.claim_task()
    if task:
        # do work...
        agent.complete_task(task["id"], artifacts=["src/feature.py"])
"""

import json
import subprocess
import os
from typing import Optional, Any
from pathlib import Path


class MACS:
    """Low-level wrapper around the macs CLI."""

    def __init__(self, project_root: Optional[str] = None):
        self.project_root = project_root or os.getcwd()
        self.macs_cmd = os.environ.get("MACS_CMD", "macs")

    def _run(self, *args: str, check: bool = False) -> subprocess.CompletedProcess:
        cmd = [self.macs_cmd, *args]
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=self.project_root,
            check=check,
        )

    def init(self, project_name: Optional[str] = None) -> bool:
        name = project_name or Path(self.project_root).name
        result = self._run("init", name)
        return result.returncode == 0

    def status(self) -> str:
        return self._run("status").stdout

    def get_state(self) -> dict:
        """Read state.json directly (faster than CLI for programmatic use)."""
        state_file = Path(self.project_root) / ".macs" / "protocol" / "state.json"
        if not state_file.exists():
            return {}
        with open(state_file) as f:
            return json.load(f)

    def get_status_text(self) -> str:
        """Get human-readable status for injection into prompts."""
        status_file = Path(self.project_root) / ".macs" / "human" / "STATUS.md"
        if status_file.exists():
            return status_file.read_text()
        return self.status()

    def register_agent(self, agent_id: str, capabilities: list[str],
                       model: Optional[str] = None, role: Optional[str] = None) -> bool:
        args = ["register", agent_id, "--capabilities", ",".join(capabilities)]
        if model:
            args += ["--model", model]
        if role:
            args += ["--role", role]
        return self._run(*args).returncode == 0

    def claim_task(self, agent_id: str, task_id: Optional[str] = None) -> Optional[dict]:
        """Claim a task. Returns task dict or None if no tasks available."""
        args = ["claim", "--agent", agent_id]
        if task_id:
            args = ["claim", task_id, "--agent", agent_id]
        result = self._run(*args)
        if result.returncode != 0 or "No available tasks" in result.stdout:
            return None
        # Parse task from state
        state = self.get_state()
        tasks = state.get("tasks", {})
        for task in tasks.values():
            if task.get("assignee") == agent_id and task.get("status") == "assigned":
                return task
        return None

    def start_task(self, agent_id: str, task_id: str) -> bool:
        return self._run("start", task_id, "--agent", agent_id).returncode == 0

    def complete_task(self, agent_id: str, task_id: str,
                      artifacts: Optional[list[str]] = None,
                      summary: Optional[str] = None) -> bool:
        args = ["done", task_id, "--agent", agent_id]
        if artifacts:
            args += ["--artifacts", ",".join(artifacts)]
        if summary:
            args += ["--summary", summary]
        result = self._run(*args)
        if result.returncode == 0:
            self._run("generate")
        return result.returncode == 0

    def block_task(self, agent_id: str, task_id: str, reason: str,
                   escalate_to: Optional[str] = None) -> bool:
        args = ["block", task_id, "--agent", agent_id, "--reason", reason]
        if escalate_to:
            args += ["--escalate", escalate_to]
        return self._run(*args).returncode == 0

    def unblock_task(self, agent_id: str, task_id: str,
                     decision: Optional[str] = None) -> bool:
        args = ["unblock", task_id, "--agent", agent_id]
        if decision:
            args += ["--decision", decision]
        return self._run(*args).returncode == 0

    def send_message(self, from_id: str, to_id: str, content: str,
                     re: Optional[str] = None, msg_type: str = "general") -> bool:
        args = ["send", from_id, to_id, content, "--type", msg_type]
        if re:
            args += ["--re", re]
        return self._run(*args).returncode == 0

    def get_inbox(self, agent_id: str, unread_only: bool = True) -> list[dict]:
        inbox_file = Path(self.project_root) / ".macs" / "sync" / "inbox" / agent_id / "messages.jsonl"
        if not inbox_file.exists():
            return []
        messages = []
        with open(inbox_file) as f:
            for line in f:
                line = line.strip()
                if line:
                    msg = json.loads(line)
                    if not unread_only or not msg.get("read"):
                        messages.append(msg)
        return messages

    def analyze_impact(self, file_path: str) -> str:
        return self._run("impact", file_path).stdout

    def heartbeat(self, agent_id: str, status: str = "busy",
                  current_task: Optional[str] = None) -> bool:
        # Heartbeat via CLI requires extending CLI — use direct state write for now
        # TODO: add macs heartbeat command
        return True

    def generate(self) -> bool:
        return self._run("generate").returncode == 0


class MACSAgent:
    """
    High-level agent interface. Wraps MACS for easy use in Python agent frameworks.

    Usage:
        agent = MACSAgent("my-agent", capabilities=["backend"])
        task = agent.claim()
        if task:
            result = do_work(task)
            agent.complete(task["id"], artifacts=result.files)
    """

    def __init__(self, agent_id: str, capabilities: Optional[list[str]] = None,
                 model: Optional[str] = None, role: Optional[str] = None,
                 project_root: Optional[str] = None):
        self.agent_id = agent_id
        self.macs = MACS(project_root)
        self.macs.register_agent(
            agent_id,
            capabilities=capabilities or [],
            model=model,
            role=role,
        )

    @property
    def id(self) -> str:
        return self.agent_id

    def claim(self, task_id: Optional[str] = None) -> Optional[dict]:
        return self.macs.claim_task(self.agent_id, task_id)

    def start(self, task_id: str) -> None:
        self.macs.start_task(self.agent_id, task_id)

    def complete(self, task_id: str, artifacts: Optional[list[str]] = None,
                 summary: Optional[str] = None) -> None:
        self.macs.complete_task(self.agent_id, task_id, artifacts=artifacts, summary=summary)

    def block(self, task_id: str, reason: str, escalate_to: Optional[str] = None) -> None:
        self.macs.block_task(self.agent_id, task_id, reason, escalate_to)

    def unblock(self, task_id: str, decision: Optional[str] = None) -> None:
        self.macs.unblock_task(self.agent_id, task_id, decision)

    def send(self, to: str, content: str, re: Optional[str] = None) -> None:
        self.macs.send_message(self.agent_id, to, content, re=re)

    def inbox(self) -> list[dict]:
        return self.macs.get_inbox(self.agent_id, unread_only=True)

    def get_context(self) -> str:
        """Get MACS status text for prompt injection."""
        return self.macs.get_status_text()

    def impact(self, file_path: str) -> str:
        return self.macs.analyze_impact(file_path)

    def run(self, execute_fn: Any, max_tasks: int = 0) -> int:
        """
        Simple agent loop. Claim tasks and execute until done.

        Args:
            execute_fn: Callable(task: dict) -> dict with optional 'artifacts', 'summary' keys
            max_tasks: Stop after this many tasks (0 = unlimited)

        Returns:
            Number of tasks completed
        """
        completed = 0
        while True:
            # Handle inbox
            for msg in self.inbox():
                print(f"[{self.agent_id}] Message from {msg['from']}: {msg.get('data', {}).get('content', '')}")

            # Claim task
            task = self.claim()
            if not task:
                print(f"[{self.agent_id}] No more tasks. Done.")
                break

            print(f"[{self.agent_id}] Working on {task['id']}: {task['title']}")
            self.start(task["id"])

            try:
                result = execute_fn(task) or {}
                self.complete(
                    task["id"],
                    artifacts=result.get("artifacts"),
                    summary=result.get("summary"),
                )
                completed += 1
                print(f"[{self.agent_id}] Completed {task['id']}")
            except Exception as e:
                self.block(task["id"], reason=str(e))
                print(f"[{self.agent_id}] Blocked {task['id']}: {e}")

            if max_tasks and completed >= max_tasks:
                break

        return completed


# ── Framework integrations ─────────────────────────────────

class MACSLangChainTool:
    """LangChain Tool that exposes MACS task operations."""

    @staticmethod
    def get_tools(agent: MACSAgent) -> list:
        try:
            from langchain.tools import Tool
        except ImportError:
            raise ImportError("pip install langchain")

        return [
            Tool(
                name="macs_status",
                description="Get current project status: tasks, agents, progress",
                func=lambda _: agent.get_context(),
            ),
            Tool(
                name="macs_claim_task",
                description="Claim the next available task to work on",
                func=lambda _: str(agent.claim()),
            ),
            Tool(
                name="macs_complete_task",
                description="Mark a task as complete. Input: 'TASK_ID: summary'",
                func=lambda x: str(agent.complete(x.split(":")[0].strip(), summary=x.split(":", 1)[1].strip() if ":" in x else None)),
            ),
            Tool(
                name="macs_impact",
                description="Analyze impact of changing a file. Input: file path",
                func=lambda path: agent.impact(path),
            ),
        ]


class MACSCrewAITool:
    """CrewAI Tool wrapper for MACS."""

    @staticmethod
    def get_tools(agent: MACSAgent) -> list:
        try:
            from crewai.tools import BaseTool
            from pydantic import BaseModel, Field
        except ImportError:
            raise ImportError("pip install crewai")

        class MACSStatusTool(BaseTool):
            name: str = "MACS Status"
            description: str = "Get current project status from MACS coordination system"
            _agent: Any = None

            def _run(self, query: str = "") -> str:
                return self._agent.get_context()

        tool = MACSStatusTool()
        tool._agent = agent
        return [tool]
