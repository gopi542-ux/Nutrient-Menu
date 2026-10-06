---
name: NutriMenu backend boundary
description: Backend timing and persistence boundary requested for NutriMenu.
---

For the first phase, NutriMenu is frontend-only and uses browser storage for demo data. The user explicitly wants Supabase added as a later backend phase.

**Why:** the user requested no backend yet and named Supabase for later.

**How to apply:** Keep UI work independent of server APIs until the user starts the backend phase. When that phase begins, read the integrations skill and connect the existing typed menu and storage boundary to Supabase.
