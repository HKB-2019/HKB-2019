/* The shop's motion curves and timings, in one place (Emil Kowalski's rules,
 * .claude/skills/improve-animations/AUDIT.md). The same curves are CSS
 * variables in styles.css: --ease-out, --ease-in-out.
 *
 *   EASE_OUT     things entering or leaving: starts fast, settles softly
 *   EASE_IN_OUT  things moving from one place to another on screen
 *   EASE_SLOW    the home page's few ceremonial moments only (the hero
 *                photo, the title): slow to start on purpose
 *
 * Everyday UI stays under 0.3s, and leaves a little faster than it came. */

export const EASE_OUT = [0.23, 1, 0.32, 1];
export const EASE_IN_OUT = [0.77, 0, 0.175, 1];
export const EASE_SLOW = [0.33, 0.02, 0.18, 1];

export const UI_IN = 0.28;    // panels, modals, menus appearing
export const UI_OUT = 0.18;   // and going
