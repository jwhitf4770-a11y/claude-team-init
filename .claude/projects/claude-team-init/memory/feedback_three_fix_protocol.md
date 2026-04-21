---
name: Three-Fix Protocol enforcement feedback
description: User called out skipping the Three-Fix Protocol — oscillated 3x on area floor without it. Follow protocol for judgment calls, skip ceremony only for obvious wiring.
type: feedback
originSessionId: cc246e93-1732-48d1-ba48-96509b53922a
---
Follow the Three-Fix Protocol for ANY threshold/gate change in the face detection pipeline. I oscillated 3 times on the area floor (add → remove → add back) because I skipped the planner each time and guessed instead of measuring.

**Why:** The protocol exists to prevent exactly this pattern — each "quick fix" broke something the previous one fixed. The user got frustrated: "this is another step backwards on what was WORKING."

**How to apply:** 
- Obvious wiring fixes (missing abort signal, missing import) → ship autonomously
- Threshold/gate/filter changes (area floor, quality floor, NMS params) → ALWAYS spawn planner, present 3 candidates, get approval
- When unsure → check git history and prod code BEFORE writing any fix. "you re guessing and not researching past commits and prod vs now"
