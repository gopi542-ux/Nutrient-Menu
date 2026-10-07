# Connect NutriMenu to Supabase

NutriMenu uses the Supabase browser SDK for authentication and data access. The app uses only the project's public publishable/anon key; access to restaurant data is enforced by the row-level security policies in `setup.sql`. Never place a `service_role` or secret API key in a `VITE_` variable.

## One-time project setup

1. In Supabase, open the project's **SQL Editor**.
2. Open `artifacts/nutrimenu/supabase/setup.sql` in this workspace, copy the whole file into a new SQL query, and run it.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to the app's published URL. Add the Replit preview URL to the allowed redirect URLs if you plan to confirm accounts from the preview.
4. Ensure email sign-up is enabled under **Authentication → Providers → Email**. If email confirmations are enabled, new owners must confirm their address before signing in.
5. Reload NutriMenu. The public GreenBite demo menu is available at `/menu/greenbite-kitchen`. Registering an owner account creates a separate restaurant workspace and its default categories.

`setup.sql` can be run again without replacing existing menu rows. It creates the tables and ownership trigger, applies row-level security, and inserts the GreenBite demo restaurant and its 12 dishes once.
