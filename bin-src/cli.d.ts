#!/usr/bin/env node
/**
 * MACS CLI v3.0
 *
 * Usage:
 *   macs boot --agent <id> [--capabilities a,b] [--model sonnet]
 *   macs init [project-name]
 *   macs status
 *   macs create <title> [--priority high] [--depends T-001] [--tags auth,backend] [--requires cap1,cap2]
 *   macs claim [task-id]
 *   macs start <task-id>
 *   macs done <task-id> [--summary "..."] [--artifacts file1,file2]
 *   macs block <task-id> --reason "..." --next "..." [--done "..."] [--issue "..."] [--question "..."]
 *   macs cancel <task-id> --reason "..." --next "..." [--agent id]
 *   macs unblock <task-id> [--decision "..."]
 *   macs checkpoint <task-id> --agent <id> --note "✓ done → next ⚠ issue" [--progress 0.6]
 *   macs drift [--threshold 30]
 *   macs decompose <task-id> --into "subtask1,subtask2" [--rationale "..."] [--agent id]
 *   macs review <task-id> --agent <id> --result approve|reject [--note "..."]
 *   macs escalate <task-id> --reason "..." [--to human-id] [--timeout 60] [--agent id]
 *   macs reap [--threshold 45]
 *   macs swarm --agents "name[:caps]|..." [--simulate] [--delay 800]
 *   macs swarm --agents N [--capabilities cap1,cap2] [--simulate] [--delay 800]
 *   macs register <agent-id> --capabilities backend,testing [--model sonnet]
 *   macs log [--limit 20]
 *   macs impact <file-path>
 *   macs inbox <agent-id>
 *   macs send <from> <to> <message> [--type general] [--re T-001]
 *   macs generate
 */
export {};
