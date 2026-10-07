-- NutriMenu's Supabase schema and public GreenBite demo menu.
-- Safe to run again: existing tables are kept, and demo rows are inserted once.

create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  location text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  nutrition_units text not null default 'US customary'
    check (nutrition_units in ('US customary', 'Metric')),
  menu_update_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  unique (restaurant_id, name)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  serving_size text not null default '',
  category text not null default '',
  image text not null default 'citrus',
  calories integer not null default 0 check (calories >= 0),
  protein numeric(8,2) not null default 0 check (protein >= 0),
  carbohydrates numeric(8,2) not null default 0 check (carbohydrates >= 0),
  fat numeric(8,2) not null default 0 check (fat >= 0),
  fiber numeric(8,2) not null default 0 check (fiber >= 0),
  sugar numeric(8,2) not null default 0 check (sugar >= 0),
  sodium numeric(8,2) not null default 0 check (sodium >= 0),
  cholesterol numeric(8,2) not null default 0 check (cholesterol >= 0),
  saturated_fat numeric(8,2) not null default 0 check (saturated_fat >= 0),
  dietary_options text[] not null default '{}',
  allergens text[] not null default '{}',
  published boolean not null default false,
  created_at date not null default current_date,
  unique (restaurant_id, slug)
);

create index if not exists menu_items_public_lookup
  on public.menu_items (restaurant_id, published, created_at desc);

alter table public.restaurants enable row level security;
alter table public.restaurant_owners enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.restaurant_categories enable row level security;
alter table public.menu_items enable row level security;

drop policy if exists "Public restaurant profiles are readable" on public.restaurants;
create policy "Public restaurant profiles are readable"
  on public.restaurants for select
  using (true);

drop policy if exists "Owners update their restaurant profile" on public.restaurants;
create policy "Owners update their restaurant profile"
  on public.restaurants for update to authenticated
  using (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurants.id and ro.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurants.id and ro.user_id = (select auth.uid())
  ));

drop policy if exists "Owners can read their ownership link" on public.restaurant_owners;
create policy "Owners can read their ownership link"
  on public.restaurant_owners for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners read their restaurant settings" on public.restaurant_settings;
create policy "Owners read their restaurant settings"
  on public.restaurant_settings for select to authenticated
  using (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurant_settings.restaurant_id
      and ro.user_id = (select auth.uid())
  ));

drop policy if exists "Owners update their restaurant settings" on public.restaurant_settings;
create policy "Owners update their restaurant settings"
  on public.restaurant_settings for update to authenticated
  using (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurant_settings.restaurant_id
      and ro.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurant_settings.restaurant_id
      and ro.user_id = (select auth.uid())
  ));

drop policy if exists "Restaurant categories are public" on public.restaurant_categories;
create policy "Restaurant categories are public"
  on public.restaurant_categories for select
  using (true);

drop policy if exists "Owners manage restaurant categories" on public.restaurant_categories;
create policy "Owners manage restaurant categories"
  on public.restaurant_categories for all to authenticated
  using (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurant_categories.restaurant_id
      and ro.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = restaurant_categories.restaurant_id
      and ro.user_id = (select auth.uid())
  ));

drop policy if exists "Published menu items and owner drafts are readable" on public.menu_items;
create policy "Published menu items and owner drafts are readable"
  on public.menu_items for select
  using (
    published
    or exists (
      select 1 from public.restaurant_owners ro
      where ro.restaurant_id = menu_items.restaurant_id
        and ro.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners manage their menu items" on public.menu_items;
create policy "Owners manage their menu items"
  on public.menu_items for all to authenticated
  using (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = menu_items.restaurant_id
      and ro.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.restaurant_owners ro
    where ro.restaurant_id = menu_items.restaurant_id
      and ro.user_id = (select auth.uid())
  ));

grant usage on schema public to anon, authenticated;
grant select on public.restaurants to anon, authenticated;
grant update on public.restaurants to authenticated;
grant select on public.restaurant_owners to authenticated;
grant select, update on public.restaurant_settings to authenticated;
grant select, insert, update, delete on public.restaurant_categories to anon, authenticated;
grant select, insert, update, delete on public.menu_items to anon, authenticated;

create or replace function public.create_restaurant_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  restaurant_name text;
  restaurant_slug text;
  new_restaurant_id uuid;
begin
  restaurant_name := nullif(trim(new.raw_user_meta_data ->> 'restaurant_name'), '');
  if restaurant_name is null then
    restaurant_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'My Restaurant');
  end if;

  restaurant_slug := trim(both '-' from regexp_replace(lower(restaurant_name), '[^a-z0-9]+', '-', 'g'));
  if restaurant_slug = '' then
    restaurant_slug := 'restaurant';
  end if;
  restaurant_slug := restaurant_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.restaurants (slug, name)
  values (restaurant_slug, restaurant_name)
  returning id into new_restaurant_id;

  insert into public.restaurant_owners (user_id, restaurant_id)
  values (new.id, new_restaurant_id);

  insert into public.restaurant_settings (restaurant_id)
  values (new_restaurant_id);

  insert into public.restaurant_categories (restaurant_id, name, position)
  values
    (new_restaurant_id, 'Bowls', 0),
    (new_restaurant_id, 'Mains', 1),
    (new_restaurant_id, 'Handhelds', 2),
    (new_restaurant_id, 'Soups', 3),
    (new_restaurant_id, 'Salads', 4),
    (new_restaurant_id, 'Noodles', 5),
    (new_restaurant_id, 'Sweets', 6),
    (new_restaurant_id, 'Drinks', 7);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nutrimenu on auth.users;
create trigger on_auth_user_created_nutrimenu
  after insert on auth.users
  for each row execute procedure public.create_restaurant_for_new_user();

-- Public demo restaurant keeps the existing customer preview available.
insert into public.restaurants (id, slug, name, description, location, website)
values (
  '00000000-0000-4000-8000-000000000001',
  'greenbite-kitchen',
  'GreenBite Kitchen',
  'Seasonal, feel-good food made from ingredients we believe in. Take a look at what’s cooking.',
  'Portland, Oregon',
  'greenbitekitchen.example'
)
on conflict (slug) do nothing;

insert into public.restaurant_categories (restaurant_id, name, position)
select '00000000-0000-4000-8000-000000000001'::uuid, category.name, category.position
from (values
  ('Bowls', 0), ('Mains', 1), ('Handhelds', 2), ('Soups', 3),
  ('Salads', 4), ('Noodles', 5), ('Sweets', 6), ('Drinks', 7)
) as category(name, position)
on conflict (restaurant_id, name) do nothing;

insert into public.menu_items (
  restaurant_id, name, slug, description, price, serving_size, category, image,
  calories, protein, carbohydrates, fat, fiber, sugar, sodium, cholesterol, saturated_fat,
  dietary_options, allergens, published, created_at
)
values
  ('00000000-0000-4000-8000-000000000001', 'Citrus Tahini Grain Bowl', 'citrus-tahini-grain-bowl', 'Warm farro, crisp cucumber, roasted chickpeas, pickled fennel and a bright lemon-tahini drizzle.', 15, '420 g', 'Bowls', 'citrus', 482, 18, 64, 17, 12, 8, 640, 0, 2, array['Vegan','Vegetarian','Dairy-free'], array['Sesame','Wheat'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Miso Maple Salmon', 'miso-maple-salmon', 'Responsibly sourced salmon glazed with white miso and maple, served with ginger rice and greens.', 22, '360 g', 'Mains', 'salmon', 556, 38, 48, 22, 5, 11, 790, 78, 4, array['Gluten-free'], array['Fish','Soy'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Green Goddess Chickpea Wrap', 'green-goddess-chickpea-wrap', 'Herby smashed chickpeas, avocado, crunchy greens and house-made green goddess dressing.', 14, '310 g', 'Handhelds', 'wrap', 438, 16, 53, 18, 13, 6, 580, 0, 3, array['Vegan','Vegetarian'], array['Wheat','Sesame'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Roasted Tomato Lentil Soup', 'roasted-tomato-lentil-soup', 'Slow-roasted tomatoes, red lentils and garden herbs with a spoon of cashew cream.', 11, '390 ml', 'Soups', 'soup', 298, 15, 44, 7, 14, 12, 520, 0, 1, array['Vegan','Vegetarian','Gluten-free','Dairy-free'], array['Tree nuts'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Charred Broccoli Caesar', 'charred-broccoli-caesar', 'Smoky broccoli, little gem, sourdough crunch and a sharp cashew-parmesan dressing.', 13, '285 g', 'Salads', 'broccoli', 364, 12, 32, 22, 9, 5, 690, 8, 4, array['Vegetarian'], array['Wheat','Tree nuts'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Golden Harissa Chicken', 'golden-harissa-chicken', 'Free-range chicken with smoky harissa, turmeric couscous and a cooling cucumber yogurt.', 19, '390 g', 'Mains', 'chicken', 518, 42, 48, 16, 7, 9, 735, 105, 4, array['High-protein'], array['Wheat','Dairy'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Sesame Soba Crunch', 'sesame-soba-crunch', 'Buckwheat noodles, edamame, carrot ribbons, cabbage and toasted sesame-ginger sauce.', 16, '400 g', 'Noodles', 'soba', 465, 21, 67, 13, 10, 10, 810, 0, 2, array['Vegan','Vegetarian'], array['Soy','Sesame','Wheat'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Almond-Date Energy Bites', 'almond-date-energy-bites', 'Three soft-baked bites made with Medjool dates, almond butter, cacao and a pinch of sea salt.', 7, '90 g · 3 bites', 'Sweets', 'bites', 242, 7, 31, 12, 6, 20, 85, 0, 2, array['Vegan','Vegetarian','Gluten-free','Dairy-free'], array['Tree nuts'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Market Greens & Pear', 'market-greens-pear', 'Tender greens, ripe pear, toasted walnuts and a cider-mustard vinaigrette.', 14, '270 g', 'Salads', 'pear', 326, 8, 29, 22, 8, 16, 310, 0, 3, array['Vegan','Vegetarian','Gluten-free'], array['Tree nuts'], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Smoky Black Bean Tacos', 'smoky-black-bean-tacos', 'Two corn tortillas filled with smoky black beans, avocado salsa and crunchy cabbage.', 15, '330 g · 2 tacos', 'Handhelds', 'tacos', 412, 17, 58, 14, 16, 7, 610, 0, 2, array['Vegan','Vegetarian','Gluten-free','Dairy-free'], array[]::text[], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Ginger Carrot Glow Juice', 'ginger-carrot-glow-juice', 'Cold-pressed carrot, orange, lemon and a little fresh ginger. Bright by nature.', 8, '350 ml', 'Drinks', 'juice', 132, 2, 31, 0, 2, 24, 95, 0, 0, array['Vegan','Vegetarian','Gluten-free','Dairy-free'], array[]::text[], true, '2025-04-08'),
  ('00000000-0000-4000-8000-000000000001', 'Olive Oil Lemon Cake', 'olive-oil-lemon-cake', 'A tender slice of citrusy olive oil cake finished with seasonal berries and whipped yogurt.', 9, '145 g', 'Sweets', 'cake', 388, 7, 46, 19, 2, 27, 280, 46, 5, array['Vegetarian'], array['Wheat','Eggs','Dairy'], true, '2025-04-08')
on conflict (restaurant_id, slug) do nothing;
