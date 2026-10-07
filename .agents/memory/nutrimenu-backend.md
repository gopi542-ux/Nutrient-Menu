---
name: NutriMenu Supabase boundary
description: Persistence and access-control decisions for NutriMenu's existing Supabase project.
---

NutriMenu connects directly to the user's existing Supabase project through the browser SDK. Keep restaurant ownership enforced by Supabase Auth and row-level security; do not replace the project with Replit Postgres or expose a service-role key in the web app.

**Why:** the user already has a Supabase project and wants persistent restaurant data and real owner accounts without moving databases or bypassing RLS.

**How to apply:** Use the public client key for browser requests, and make schema or policy changes through the Supabase SQL Editor. Treat the setup SQL as a user-applied migration; never request a service-role credential for routine app access.
