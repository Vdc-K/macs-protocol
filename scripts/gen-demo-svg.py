#!/usr/bin/env python3
"""Generate an animated SVG terminal demo for MACS README."""

WIDTH = 720
LINE_H = 22
PADDING_X = 20
PADDING_Y = 50  # below title bar
FONT = "13px 'Cascadia Code', 'Fira Code', 'Menlo', monospace"
BG = "#0d1117"
TITLE_BG = "#161b22"
BORDER = "#30363d"

# Colors
C = {
    "prompt": "#58a6ff",
    "cmd": "#e6edf3",
    "dim": "#6e7681",
    "green": "#3fb950",
    "yellow": "#d29922",
    "blue": "#58a6ff",
    "white": "#e6edf3",
    "check": "#3fb950",
    "spin": "#58a6ff",
    "header": "#f0883e",
}

# Each entry: (text, color_key, delay_seconds)
LINES = [
    # Command
    ("$ macs swarm --agents \"lead:architect|eng1:backend,api|eng2:frontend,ui|qa:testing|devops:infra\" --simulate", "prompt", 0.0),
    ("", "dim", 0.3),
    # Header
    ("🐝 MACS Swarm — 5 agents | 12 tasks | simulate mode", "header", 0.5),
    ("────────────────────────────────────────────────────", "dim", 0.7),
    ("  🤖 lead    (architect, planner)", "white", 0.9),
    ("  🤖 eng1    (backend, api)", "white", 1.1),
    ("  🤖 eng2    (frontend, ui)", "white", 1.3),
    ("  🤖 qa      (testing, e2e)", "white", 1.5),
    ("  🤖 devops  (infra, deploy)", "white", 1.7),
    ("", "dim", 1.9),
    # Round 1
    ("▶ Round 1  — Foundation", "blue", 2.1),
    ("  🔄 lead    → T-001: Design system architecture", "spin", 2.4),
    ("  🔄 eng1    → T-002: Set up database schema", "spin", 2.6),
    ("  🔄 devops  → T-003: Configure CI/CD pipeline", "spin", 2.8),
    ("  ✓  lead    ← T-001 done", "check", 3.4),
    ("  ✓  eng1    ← T-002 done", "check", 3.6),
    ("  ✓  devops  ← T-003 done", "check", 3.8),
    ("", "dim", 4.0),
    # Round 2
    ("▶ Round 2  — T-001 + T-002 unlocked 4 tasks", "blue", 4.2),
    ("  🔄 lead    → T-004: Implement auth API", "spin", 4.5),
    ("  🔄 eng1    → T-005: User CRUD endpoints", "spin", 4.7),
    ("  🔄 eng2    → T-006: React auth components", "spin", 4.9),
    ("  🔄 qa      → T-007: Integration test suite", "spin", 5.1),
    ("  ✓  all 4 done", "check", 5.9),
    ("", "dim", 6.1),
    # Round 3
    ("▶ Round 3  — Final wave", "blue", 6.3),
    ("  🔄 eng2    → T-010: Dashboard UI", "spin", 6.6),
    ("  🔄 qa      → T-011: E2E tests", "spin", 6.8),
    ("  🔄 devops  → T-012: Deploy to staging", "spin", 7.0),
    ("  ✓  all done", "check", 7.8),
    ("", "dim", 8.0),
    # Footer
    ("────────────────────────────────────────────────────", "dim", 8.2),
    ("✅ 12/12 tasks complete | 3 rounds | 0 conflicts", "green", 8.5),
    ("   Zero merge conflicts. Zero orphaned tasks. Zero chaos.", "dim", 8.9),
]

TOTAL_LINES = len(LINES)
HEIGHT = PADDING_Y + TOTAL_LINES * LINE_H + 30
TOTAL_DURATION = 12.0  # seconds before loop


def escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def build_svg():
    parts = []

    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">')

    # Styles
    parts.append(f"""<style>
  .terminal {{ font: {FONT}; }}
  .line {{ opacity: 0; }}
  .cursor {{ animation: blink 1s step-end infinite; }}
  @keyframes blink {{ 50% {{ opacity: 0; }} }}
</style>""")

    # Background
    parts.append(f'<rect width="{WIDTH}" height="{HEIGHT}" rx="8" fill="{BG}" stroke="{BORDER}" stroke-width="1"/>')

    # Title bar
    parts.append(f'<rect width="{WIDTH}" height="32" rx="8" fill="{TITLE_BG}"/>')
    parts.append(f'<rect y="24" width="{WIDTH}" height="8" fill="{TITLE_BG}"/>')
    # Traffic lights
    for i, color in enumerate(["#ff5f57", "#febc2e", "#28c840"]):
        parts.append(f'<circle cx="{16 + i * 20}" cy="16" r="6" fill="{color}"/>')
    # Title
    parts.append(f'<text x="{WIDTH//2}" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="{C["dim"]}">macs swarm — simulate</text>')

    # Lines
    for i, (text, color_key, delay) in enumerate(LINES):
        y = PADDING_Y + i * LINE_H
        color = C[color_key]
        safe_text = escape(text)

        # Animation: fade in at delay, stay visible until TOTAL_DURATION, then reset
        # Using keyframes percentage
        appear_pct = delay / TOTAL_DURATION * 100
        end_pct = 96.0  # hold until near end
        reset_pct = 99.0

        anim_id = f"l{i}"
        parts.append(f"""<style>
  @keyframes {anim_id} {{
    0%, {appear_pct:.1f}% {{ opacity: 0; }}
    {min(appear_pct + 0.5, end_pct):.1f}%, {end_pct:.1f}% {{ opacity: 1; }}
    {reset_pct:.1f}%, 100% {{ opacity: 0; }}
  }}
</style>""")
        parts.append(
            f'<text class="terminal" x="{PADDING_X}" y="{y}" fill="{color}" '
            f'style="animation: {anim_id} {TOTAL_DURATION}s linear infinite;">'
            f'{safe_text}</text>'
        )

    # Blinking cursor after last line
    last_y = PADDING_Y + (TOTAL_LINES - 1) * LINE_H
    cursor_delay = LINES[-1][2]
    cursor_appear_pct = cursor_delay / TOTAL_DURATION * 100
    parts.append(f"""<style>
  @keyframes cursor_anim {{
    0%, {cursor_appear_pct:.1f}% {{ opacity: 0; }}
    {min(cursor_appear_pct + 0.5, 96):.1f}%, 96% {{ opacity: 1; }}
    99%, 100% {{ opacity: 0; }}
  }}
  @keyframes cursor_blink {{
    50% {{ opacity: 0; }}
  }}
</style>""")
    parts.append(
        f'<rect x="{PADDING_X}" y="{last_y + 10}" width="8" height="14" fill="{C["prompt"]}" '
        f'style="animation: cursor_anim {TOTAL_DURATION}s linear infinite, cursor_blink 1s step-end infinite;"/>'
    )

    parts.append("</svg>")
    return "\n".join(parts)


if __name__ == "__main__":
    import os
    out_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "demo.svg")
    svg = build_svg()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated: {out_path}")
