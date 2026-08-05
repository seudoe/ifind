**Design Direction: KDE Plasma Inspired UI**

Use the KDE Plasma desktop as the primary design inspiration. The UI should feel polished, modern, lightweight, and quietly elegant rather than flashy. The goal is to create an interface that feels calm, precise, and highly usable.

### Overall Feel
- Minimal but not empty.
- Soft, premium, desktop-application quality.
- Every element should feel intentionally placed.
- Smooth animations everywhere, but never distracting.
- Clean geometry with slightly rounded corners.
- High information density while remaining readable.

### Borders
- Very subtle 1px borders on cards, inputs, buttons, and panels.
- Borders should be slightly lighter than the background in dark mode (or slightly darker in light mode).
- Avoid thick outlines.
- Use borders to define structure rather than create contrast.

### Surfaces
- Multiple elevation levels using slightly different background shades instead of heavy shadows.
- Cards should gently stand out from the page.
- Soft layered panels similar to Plasma settings or Dolphin.
- Large empty surfaces should never be perfectly flat.

### Corners
- Rounded corners between 8px–12px.
- Keep consistency throughout the application.
- No pill-shaped controls unless intentionally used.

### Shadows
- Extremely soft shadows.
- Shadows should mostly communicate elevation rather than decoration.
- Blur should be high with low opacity.
- Avoid harsh drop shadows.

### Colors
- Neutral gray base with subtle blue accents.
- Accent color should be used sparingly for:
  - primary buttons
  - active navigation
  - selected items
  - focus states
- Background should use multiple shades of gray instead of pure black or white.
- Low saturation overall.

### Typography
- Modern sans-serif.
- Medium font weight for headings.
- Comfortable spacing.
- High readability.
- Never oversized.
- Similar density to KDE System Settings.

### Buttons
- Slight gradients are acceptable but extremely subtle.
- Hover:
  - slightly brighter background
  - border becomes a little more visible
- Active:
  - gentle pressed effect
- Disabled:
  - reduced opacity
  - still clearly readable

### Inputs
- Soft bordered inputs.
- Clear focus ring using the accent color.
- Gentle background differentiation.
- Comfortable padding.
- Placeholder text slightly muted.

### Cards
- Slight elevation.
- Thin border.
- Rounded corners.
- Optional very soft glass effect if it doesn't reduce readability.
- Plenty of internal spacing.

### Navigation
- Sidebar should resemble KDE Plasma panels.
- Selected item gets:
  - subtle colored background
  - accent-colored left indicator or border
  - smooth animated transition
- Icons should be simple line icons.

### Motion
Everything should animate smoothly.

Use:
- 150–250ms transitions
- ease-out timing
- subtle fade
- slight scaling (1.00 → 1.02)
- smooth color interpolation

Avoid dramatic animations.

### Hover States
Hover should feel alive without being obvious.

Examples:
- slightly brighter surface
- border becomes more visible
- shadow increases by a tiny amount
- tiny upward movement (1–2px max)

### Layout
- Plenty of breathing room.
- Consistent spacing system (4/8px grid).
- Large sections separated by whitespace instead of heavy dividers.
- Cards align perfectly.
- Strong visual rhythm.

### Icons
- Thin stroke icons.
- Rounded corners where appropriate.
- Similar feel to Breeze Icons.
- Consistent size throughout.

### Scrollbars
- Thin.
- Rounded.
- Blend into the UI.
- Become more visible only on hover.

### Design Principles
- Calm over exciting.
- Elegant over decorative.
- Functional over artistic.
- Consistency over uniqueness.
- Small details matter.
- Every interaction should feel polished.

### Things to Avoid
- Heavy gradients
- Thick borders
- Neon colors
- Glassmorphism everywhere
- Excessive blur
- Loud shadows
- Oversized buttons
- Sharp corners
- Abrupt transitions
- Overly playful animations
- Material Design's large floating elements
- Apple's oversized whitespace aesthetic

### Keywords
KDE Plasma, Breeze, subtle, polished, refined, desktop-quality, understated, layered surfaces, soft borders, smooth transitions, precision, modern Linux desktop, elegant, minimal, responsive, premium, calm, functional, unobtrusive.


---

# Tool to use

For a KDE Plasma–inspired design, I'd choose **Tailwind CSS**, but **not** by stuffing utility classes directly into every element. The best approach is:

> **Tailwind + design tokens + reusable components**

This gives you the speed of Tailwind while keeping the consistency that Plasma's design depends on.

### Why Tailwind works well

KDE Plasma's UI isn't complex because of custom CSS—it's complex because it's **highly consistent**.

Every card has the same border.
Every button has the same radius.
Every hover animation feels identical.
Every spacing increment follows a system.

Tailwind excels at enforcing that consistency.

---

## Recommended structure

```
src/
 ├── components/
 │    ├── ui/
 │    │     Button.tsx
 │    │     Card.tsx
 │    │     Input.tsx
 │    │     Panel.tsx
 │    │     Sidebar.tsx
 │    │     Modal.tsx
 │
 ├── styles/
 │    globals.css
 │    theme.css
 │
 └── app/
```

Then define your design language once.

Example:

```css
:root{
    --radius:12px;

    --bg:#181a1f;
    --surface:#20242b;
    --surface-2:#272c34;

    --border:#343944;

    --primary:#3daee9;

    --shadow:
      0 4px 12px rgba(0,0,0,.15);

    --transition:200ms ease;
}
```

Now every component uses these.

---

## Example Button

Instead of writing

```html
<button class="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700 duration-200 ...">
```

Create

```tsx
<Button>Save</Button>
```

Internally

```tsx
<button className="
rounded-xl
border
border-border
bg-surface
px-4
py-2
transition-all
duration-200
hover:bg-surface-2
hover:border-zinc-500
">
```

Then every button looks identical.

---

## Cards

```tsx
<Card>
...
</Card>
```

```tsx
<div className="
rounded-xl
border
border-border
bg-surface
shadow-sm
transition-all
duration-200
hover:border-zinc-500
">
```

Very Plasma.

---

## Tailwind makes animations easy

Example

```html
hover:scale-[1.01]
hover:-translate-y-0.5
transition-all
duration-200
ease-out
```

That's almost the entire interaction.

---

## Avoid CSS Modules for every component

If you do

```
Button.css
Card.css
Sidebar.css
Input.css
...
```

you'll eventually have

- duplicate colors
- duplicate spacing
- duplicate borders
- inconsistent animations

That's exactly what KDE avoids.

---

## Use CSS only for

- theme variables
- scrollbar styling
- selection styling
- keyframes
- fonts
- complex gradients
- reusable effects

Example

```css
.plasma-card{
    backdrop-filter:blur(8px);
}

.plasma-scrollbar::-webkit-scrollbar{
...
}
```

Everything else stays in Tailwind.

---

## If you're using an AI agent

Tailwind is significantly easier for AI coding tools like Cursor, Claude Code, Windsurf, or ChatGPT because:

- components remain self-contained
- styles are visible where the markup is
- fewer files need to be edited
- easier refactoring
- design systems stay consistent

AI tends to introduce CSS drift when many standalone `.css` files exist.

---

### My recommendation

- ✅ Tailwind CSS
- ✅ CSS variables for colors, spacing, radius, shadows, and transitions
- ✅ Reusable UI components (`Button`, `Card`, `Input`, `Panel`, etc.)
- ✅ A small `globals.css`/`theme.css` for tokens and global styles
- ❌ Avoid large per-component CSS files unless they contain genuinely complex styling

This architecture is close to how modern design systems (like shadcn/ui, Radix-based apps, and many production React applications) are built, and it's an excellent fit for a polished KDE Plasma-inspired interface.

