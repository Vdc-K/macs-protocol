# Task Board

> **Update Rule**: Move to "Recent Completed" when done. Maintainer archives after 5 items.

## 🔥 Current Tasks (1-3 items)

- [ ] [Task description] - Assigned: [lead model] → Execute: [engineer model] - Status: In Progress

## 🚨 Escalations (Blocked Tasks - Priority Queue)

> **When to escalate**: Engineer encounters architectural decisions, ambiguous requirements, or blocking issues beyond their scope.
> **How to escalate**: Change task status to `[BLOCKED]`, move to this section, add reason.
> **Lead's responsibility**: Review escalations first on next turn, provide guidance, then reassign.

| Task | Blocked By | Reason | Urgency | Next Action |
|------|-----------|--------|---------|-------------|
| [Task] | [model] | [Why blocked - be specific] | High/Med/Low | [What Lead needs to decide] |

**Example**:
| Refactor auth module | engineer-sonnet | Need decision: session-based vs JWT vs OAuth2. Current code assumes sessions but mobile app needs stateless auth. | High | Lead to decide auth strategy + backward compatibility approach |

## 📋 Planned Tasks (Priority sorted)

1. [ ] [Task description]
2. [ ] [Task description]

## ✅ Recent Completed (Keep 5 items)

- [x] [Date] [Task description] - by {model}

---

## Workflow Notes

**For Engineers**:
- If blocked, don't wait silently. Update status to `[BLOCKED]`, move to Escalations, explain why.
- Tag CHANGELOG with `#escalation` when blocking a task.

**For Leads**:
- Check Escalations section FIRST on every turn.
- Provide architectural guidance or decisions.
- Reassign task back to Engineer (or handle yourself if complex).

**Maintenance**: Maintainer (cost-effective model) archives completed tasks to `archive/TASK-YYYY-MM.md` every Sunday.
