---
name: UI design preferences
description: User prefers warm Japanese illustration style with hand-drawn watercolor icons, no emoji-only UI
type: feedback
---

User chose hand-drawn sketch + soft watercolor coloring style (Gemini-generated) for grocery icons over pixel art and 3D clay styles.

**Why:** Pixel art lacked recognizability for irregular items (meat); 3D clay was considered but sketch+watercolor won on warmth and illustration identity. The user wants icons that are both realistic (recognizable at a glance) and cute/special.

**How to apply:**
- App theme: warm paper-like gradient background (#faf6f0 → #f3ede4), semi-transparent cards, category color bars
- Icons: use `mix-blend-mode: multiply` to blend white backgrounds into the warm theme
- No Japanese text subtitles — keep it clean Chinese
- Use custom modals (ConfirmModal) instead of browser native confirm/alert dialogs
- Light version preferred over dark
- Icons generated via Gemini with the standard prompt template in icon-prompts.md
