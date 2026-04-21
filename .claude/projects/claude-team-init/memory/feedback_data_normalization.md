---
name: Data Normalization Rule
description: Database design must follow proper normalization (3NF minimum) to avoid data redundancy and ensure consistency
type: feedback
---

## Rule: Data Normalization is Non-Negotiable

**The Principle:**  
All database schemas MUST follow proper normalization principles (at minimum 3NF - Third Normal Form). This is foundational to database development, not optional.

**Why:**
- Prevents data redundancy (same data stored multiple times = inconsistency)
- Ensures referential integrity (relationships stay consistent)
- Makes updates/deletes/inserts atomic and safe
- Reduces storage footprint
- Improves query performance (no data duplication to scan)

**How to Apply:**
- Before writing ANY schema, design for 3NF
- Separate concerns: users ≠ profiles ≠ sessions
- Use surrogate keys (IDs) for relationships, never embed data
- Eliminate transitive dependencies
- Create junction tables for many-to-many relationships
- Validate normalization BEFORE implementation

**Example (Wrong vs Right):**

❌ **Denormalized (bad):**
```
workouts table:
  id, user_id, user_name, user_email, exercise_1, exercise_2, exercise_3, ...
```
→ User data repeated in every row. If email changes, update everywhere.

✅ **Normalized (good):**
```
users: id, name, email
programs: id, user_id (FK), name, goal
exercises: id, name, description
program_exercises: id, program_id (FK), exercise_id (FK), week, day
set_logs: id, session_id (FK), exercise_id (FK), weight, reps, rpe
```
→ User info stored once. Relationships via IDs. Single source of truth.

**For LiftUp DB:**
- Users table (auth only)
- Programs table (program metadata, not the week structure)
- Program_weeks table (week data, separate)
- Program_days table (day data, separate)
- Program_exercises table (exercise assignments)
- Workout_sessions table (session metadata)
- Set_logs table (individual set data)
- Users_workouts table (many-to-many: user can have many sessions)

No denormalization. No embedded arrays or JSON for relational data (unless analytical).
