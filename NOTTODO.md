# NOTTODO.md

> **Sahakari Sathi UI & Development Constraints**
>
> This document defines what developers and AI agents **MUST NOT** do while developing or refactoring the project. The goal is to maintain a consistent, enterprise-grade banking experience throughout the application.

---

# ❌ DO NOT CHANGE THE DESIGN LANGUAGE

The application already has an established design language.

Do not redesign pages unnecessarily.

Do not introduce new design systems.

Improve existing UI instead of replacing it.

---

# ❌ DO NOT USE BRIGHT BLUE BACKGROUNDS

Avoid large blue backgrounds.

❌ Don't

- Blue page backgrounds
- Blue dashboard backgrounds
- Blue login backgrounds
- Blue cards

Use white or neutral backgrounds instead.

Preferred

```
Page Background

White (#FFFFFF)

or

Light Gray (#F8FAFC)

or

#FAFAFA
```

Dark mode should use neutral dark colors instead of saturated blue.

---

# ❌ DO NOT MIX DIFFERENT UI STYLES

Avoid having different pages look like different applications.

Every page must follow the same:

- spacing
- typography
- border radius
- shadows
- buttons
- cards
- icons

The entire application should feel like one product.

---

# ❌ DO NOT USE RANDOM COLORS

Colors should have meaning.

Only use colors for semantic purposes.

Green
Success

Red
Error

Orange
Warning

Blue
Primary Actions

Gray
Neutral

Never use random gradients or colorful cards.

---

# ❌ DO NOT OVERUSE GRADIENTS

Avoid gradient backgrounds.

Avoid gradient cards.

Avoid gradient tables.

Gradients may only be used for:

- Logo
- Landing page hero
- Small decorative elements

Enterprise software should remain clean and professional.

---

# ❌ DO NOT USE DIFFERENT BORDER RADIUS VALUES

Maintain consistency.

Examples

Buttons

12px

Cards

16px

Inputs

12px

Dialogs

20px

Do not randomly use

4px

8px

24px

32px

on different screens.

---

# ❌ DO NOT USE MULTIPLE BUTTON STYLES

Use only one primary button style.

One secondary button style.

One danger button style.

One ghost button style.

No page-specific button designs.

---

# ❌ DO NOT CREATE INCONSISTENT TABLES

Every table should use:

Same header height

Same row height

Same hover effect

Same padding

Same typography

Same action buttons

---

# ❌ DO NOT CREATE DIFFERENT FORM DESIGNS

Every form should share:

Same label style

Same input height

Same spacing

Same validation messages

Same required indicator

---

# ❌ DO NOT USE DIFFERENT ICON STYLES

Use Lucide Icons only.

Do not mix:

Material Icons

Bootstrap Icons

Heroicons

FontAwesome

Feather

Use a single icon system.

---

# ❌ DO NOT CREATE LARGE MONOLITHIC COMPONENTS

Maximum

300–400 lines

Split components into:

Header

Toolbar

Table

Filters

Dialogs

Cards

Forms

Hooks

Services

---

# ❌ DO NOT PUT BUSINESS LOGIC INSIDE COMPONENTS

Components should only render UI.

Business logic belongs in:

Services

Hooks

Repositories

Controllers

---

# ❌ DO NOT DUPLICATE CODE

If code is repeated twice,

Create:

Reusable component

Reusable hook

Utility function

---

# ❌ DO NOT HARDCODE VALUES

Never hardcode:

Interest Rates

Fiscal Years

PEARLS Values

Loan Types

Savings Types

Status Lists

User Roles

Move them into configuration.

---

# ❌ DO NOT HARDCODE COLORS

Never use

```
text-blue-600

bg-blue-500

text-red-600
```

Create semantic tokens.

Example

```
Primary

Secondary

Success

Danger

Warning

Info

Muted

Border

Surface
```

---

# ❌ DO NOT USE INLINE STYLES

Avoid

style={{}}

Use Tailwind utility classes or reusable component variants.

---

# ❌ DO NOT CREATE MULTIPLE MODAL DESIGNS

Use one modal component everywhere.

Same:

Animation

Padding

Close button

Footer

Buttons

Backdrop

---

# ❌ DO NOT CREATE DIFFERENT PAGE HEADERS

Every page should have:

Title

Description

Breadcrumb (optional)

Primary Action

Secondary Action

Search (if needed)

Filters (if needed)

Same layout everywhere.

---

# ❌ DO NOT USE RANDOM SPACING

Use spacing scale only.

Examples

```
4

8

12

16

20

24

32

40

48
```

Never use arbitrary spacing.

---

# ❌ DO NOT CHANGE TYPOGRAPHY RANDOMLY

Use one typography scale.

Example

```
Page Title

Section Title

Card Title

Body

Caption

Label
```

No random font sizes.

---

# ❌ DO NOT CREATE DIFFERENT CARD STYLES

All cards should have:

Same border

Same radius

Same padding

Same shadow

Same hover effect

---

# ❌ DO NOT CREATE DIFFERENT DASHBOARD WIDGETS

Widgets should share:

Header

Icon placement

Padding

Footer

Actions

Chart style

---

# ❌ DO NOT USE EXCESSIVE ANIMATIONS

Animations should be subtle.

Allowed:

Fade

Slide

Scale

Hover

Avoid:

Bounce

Spin

Flash

Elastic

Excessive motion

Enterprise software should feel stable.

---

# ❌ DO NOT BREAK RESPONSIVENESS

Every page must support:

Desktop

Laptop

Tablet

Mobile

No horizontal scrolling.

---

# ❌ DO NOT SACRIFICE ACCESSIBILITY

Always include:

Keyboard navigation

Focus states

ARIA labels

Screen reader support

Proper contrast ratio

---

# ❌ DO NOT BREAK DARK MODE

Every component must support:

Light Mode

Dark Mode

without visual inconsistencies.

---

# ❌ DO NOT CHANGE EXISTING FEATURES

Never remove:

Business logic

Workflows

Permissions

Calculations

Financial rules

Improve them only.

---

# ❌ DO NOT INTRODUCE BREAKING CHANGES

Maintain backward compatibility.

Existing users should not lose data.

Existing APIs should continue working.

---

# ❌ DO NOT COMMIT WITHOUT VALIDATION

Before every commit ensure:

- TypeScript passes
- ESLint passes
- Build succeeds
- Tests pass
- No console errors
- No console warnings

---

# Enterprise Design Principles

The application should always feel like:

- Microsoft Dynamics 365
- Oracle NetSuite
- SAP Business One
- Odoo Enterprise
- Zoho Books
- TallyPrime (Modern UI)

Characteristics:

- Clean
- Minimal
- White-first interface
- Professional
- Consistent
- Fast
- Accessible
- Predictable
- Enterprise-grade

---

# Golden Rule

> **Consistency is more important than creativity.**

Every new screen should look like it was designed by the same designer, built by the same engineer, and belong to the same enterprise product.