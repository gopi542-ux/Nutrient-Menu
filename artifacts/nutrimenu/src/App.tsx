import { useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Check, CheckCircle2, CircleHelp, Download, ExternalLink, Eye, Leaf, LogOut, Menu as MenuIcon, MoreHorizontal, Plus, QrCode, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Store, Utensils, X } from 'lucide-react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useOwnerWorkspace } from '@/hooks/useOwnerWorkspace';
import { usePublicMenuData } from '@/hooks/usePublicMenuData';
import { explainSupabaseError } from '@/lib/nutrimenu-data';
import { supabase } from '@/lib/supabase';
import type { MenuItem, OwnerWorkspace, RestaurantProfile, RestaurantSettings } from '@/lib/types';

const nutrients: (keyof Pick<MenuItem,'calories'|'protein'|'carbohydrates'|'fat'|'fiber'|'sugar'|'sodium'>)[] = ['calories','protein','carbohydrates','fat','fiber','sugar','sodium'];
const labelFor = (key: string) => ({ calories:'Calories', protein:'Protein', carbohydrates:'Carbs', fat:'Fat', fiber:'Fiber', sugar:'Sugar', sodium:'Sodium' } as Record<string,string>)[key] || key;

const money = (n: number) => `$${n.toFixed(2)}`;
const toSlug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function Button({ children, className='', variant='primary', ...props }: { children: ReactNode; className?: string; variant?: 'primary'|'soft'|'outline'|'text'|'danger'; [key:string]: any }) {
  const styles = { primary:'bg-primary text-primary-foreground hover:brightness-95 shadow-sm', soft:'bg-secondary text-secondary-foreground hover:bg-secondary/75', outline:'border border-border bg-card hover:bg-muted', text:'text-muted-foreground hover:text-foreground hover:bg-muted', danger:'bg-destructive text-white hover:brightness-95' };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function Brand({inverse=false}:{inverse?:boolean}) {
  return <Link href="/" data-testid="link-home" className={`flex items-center gap-2.5 font-semibold ${inverse?'text-[#f7f3e7]':'text-foreground'}`}>
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ddecce] text-[#225c42]"><Leaf size={19}/></span>
    <span className="text-[19px] tracking-[-.04em]">nutri<span className="text-[#d87752]">menu</span></span>
  </Link>;
}

function PlateArt({ item, large=false }: { item: MenuItem; large?: boolean }) {
  const palettes: Record<string,string[]> = {
    citrus:['#d8e8b7','#f3c777','#eb8c61'],salmon:['#efad89','#e4c87d','#adc89b'],wrap:['#cad899','#e2ba72','#db8c70'],soup:['#e99d66','#d6bc72','#c3d39c'],
    broccoli:['#91b47a','#dfc97d','#f0dfc9'],chicken:['#e1aa70','#d7c777','#a7bd8a'],soba:['#a8c48a','#e6bf70','#db9479'],bites:['#a77d5d','#d6ac76','#72936d'],
    pear:['#d9dfab','#dfb977','#91aa7b'],tacos:['#e7c36d','#b4c17d','#da8f65'],juice:['#e8a958','#d5c074','#e78c58'],cake:['#f0d8a4','#d89068','#99aa76']
  };
  const colors = palettes[item.image] || palettes.citrus;
  return <div className={`relative isolate overflow-hidden ${large?'h-full min-h-[300px]':'h-full min-h-[170px]'} bg-[#eee5cf]`} aria-label={`${item.name} dish illustration`} data-testid={`img-dish-${item.id}`}>
    {/^https?:\/\//i.test(item.image) && <img src={item.image} alt={item.name} loading="lazy" className="absolute inset-0 z-10 h-full w-full object-cover" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>}
    <div className="absolute inset-0 opacity-60" style={{background:`radial-gradient(ellipse at 15% 20%,${colors[0]} 0%,transparent 48%),radial-gradient(ellipse at 88% 80%,${colors[1]} 0%,transparent 52%),linear-gradient(130deg,#f0e7d4,#ddd5ba)`}}/>
    <div className="absolute left-1/2 top-1/2 aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[9px] border-[#fffaf0]/75 bg-[#f6f0df] shadow-[0_20px_40px_-20px_rgba(42,55,37,.35)]" style={{transform:'translate(-50%,-50%) rotate(-8deg)'}}>
      <div className="absolute inset-[10%] rounded-full" style={{background:`radial-gradient(circle at 30% 32%,${colors[0]} 0 13%,transparent 14%),radial-gradient(circle at 69% 36%,${colors[1]} 0 16%,transparent 17%),radial-gradient(circle at 46% 68%,${colors[2]} 0 18%,transparent 19%),radial-gradient(circle at 78% 69%,#72966b 0 12%,transparent 13%),radial-gradient(circle at 22% 72%,#d6a75f 0 10%,transparent 11%),#d9dfbd`}}/>
    </div>
    <span className="absolute bottom-3 left-3 rounded-full bg-[#fffaf0]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.13em] text-[#52644b]">Made with care</span>
  </div>;
}

function DishCard({ item, customer=false, selected=false, onCompare, restaurantSlug='greenbite-kitchen' }: {item:MenuItem; customer?:boolean; selected?:boolean; onCompare?:(item:MenuItem)=>void;restaurantSlug?:string}) {
  return <article className="group overflow-hidden rounded-[22px] border border-border/80 bg-card shadow-sm transition-transform duration-300 hover:-translate-y-1" data-testid={`card-dish-${item.id}`}>
    <Link href={`/menu/${restaurantSlug}/item/${item.slug}`} className="block">
      <div className="relative"><PlateArt item={item}/><span className="absolute right-3 top-3 rounded-full bg-[#fffaf0]/90 px-3 py-1.5 text-xs font-bold text-[#274b3b]">{money(item.price)}</span></div>
    </Link>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-primary">{item.category}</p><Link href={`/menu/${restaurantSlug}/item/${item.slug}`} className="serif text-[20px] leading-tight hover:text-primary" data-testid={`link-dish-${item.id}`}>{item.name}</Link></div>
        {!customer && <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.published?'bg-[#e6f0dd] text-[#42694a]':'bg-muted text-muted-foreground'}`}>{item.published?'Live':'Draft'}</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{automaticBadges(item).slice(0,3).map(b=><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground" key={b}>{b}</span>)}</div>
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
        <p className="text-xs font-semibold text-foreground"><span className="serif text-lg">{item.calories}</span> <span className="font-normal text-muted-foreground">kcal</span></p>
        {customer ? <Button variant={selected?'primary':'outline'} className="px-3 py-1.5 text-xs" onClick={(e: MouseEvent)=>{e.preventDefault();onCompare?.(item)}} data-testid={`button-compare-${item.id}`}>{selected?<Check size={13}/>:<Plus size={13}/>} {selected?'Added':'Compare'}</Button> : <span className="text-xs text-muted-foreground">{item.protein}g protein</span>}
      </div>
    </div>
  </article>;
}

function automaticBadges(item:MenuItem) {
  const tags = item.dietaryOptions.map(option => option === 'Gluten-free' ? 'GLUTEN FREE' : option.toUpperCase().replaceAll('-', ' '));
  if(item.calories <= 400) tags.push('LOW CALORIE');
  if(item.protein >= 20) tags.push('HIGH PROTEIN');
  if(item.sugar <= 10) tags.push('LOW SUGAR');
  if(item.sodium <= 500) tags.push('LOW SODIUM');
  return [...new Set(tags)];
}

function MarketingHome() {
  return <main className="min-h-[100dvh] overflow-hidden bg-[#f8f5eb]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Brand/><nav className="hidden items-center gap-8 text-sm font-medium text-[#52645b] sm:flex"><a href="#how">How it works</a><a href="#for-restaurants">For restaurants</a></nav><div className="flex items-center gap-2"><Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary" data-testid="link-login">Log in</Link><Link href="/register" className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" data-testid="link-register">For restaurants <ArrowRight size={15} className="ml-1 inline"/></Link></div></header>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 md:grid-cols-[1.02fr_.98fr] md:items-center md:px-10 md:pb-24 md:pt-16">
      <div className="page-enter relative z-10"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d4dfc5] bg-[#eef2e5] px-3 py-1.5 text-xs font-semibold text-[#3d674b]"><ShieldCheck size={14}/> Food transparency, served simply</div><h1 className="serif max-w-[650px] text-[clamp(3.4rem,8vw,6.6rem)] leading-[.91] tracking-[-.055em] text-[#233c32]">Know what’s<br/>on your <i className="text-[#d97856]">plate.</i></h1><p className="mt-7 max-w-[470px] text-base leading-7 text-[#64746a]">Good food should come with the full story. Discover thoughtful neighborhood menus with nutrition and ingredients you can trust.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/menu/greenbite-kitchen" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm" data-testid="link-explore-menu">Explore GreenBite Kitchen <ArrowRight size={16}/></Link><Link href="/register" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold hover:bg-secondary" data-testid="link-grow-restaurant">I run a restaurant <ArrowUpRight size={16}/></Link></div><div className="mt-10 flex items-center gap-3"><div className="flex -space-x-2"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f8f5eb] bg-[#e9b995] text-xs">M</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f8f5eb] bg-[#bacb9f] text-xs">A</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f8f5eb] bg-[#e8d58f] text-xs">J</span></div><span className="text-xs text-[#6d7a70]">Transparent menus, more mindful meals.</span></div></div>
      <div className="relative mx-auto w-full max-w-[580px] page-enter"><div className="absolute -right-5 top-0 h-40 w-40 rounded-full bg-[#e5d995]/60 blur-3xl"/><div className="relative rotate-[2deg] rounded-[32px] border border-[#e2decd] bg-[#fffdf6] p-3 shadow-[0_40px_100px_-45px_rgba(52,72,54,.35)]"><div className="overflow-hidden rounded-[24px]"><div className="relative h-[370px] bg-[#dbe5cc]"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_18%,#f6d285_0,transparent_35%),radial-gradient(ellipse_at_90%_76%,#9ab587_0,transparent_40%),linear-gradient(135deg,#d8e3cc,#f0e3ca)]"/><div className="absolute left-[13%] top-[14%] h-[72%] w-[74%] rounded-full border-[15px] border-[#fffaf0] bg-[#f3eedf] shadow-xl"><div className="absolute inset-[9%] rounded-full bg-[radial-gradient(circle_at_30%_30%,#da9b5f_0_11%,transparent_12%),radial-gradient(circle_at_65%_31%,#90aa72_0_15%,transparent_16%),radial-gradient(circle_at_45%_65%,#d8b86c_0_17%,transparent_18%),radial-gradient(circle_at_77%_68%,#d98059_0_11%,transparent_12%),radial-gradient(circle_at_20%_72%,#80996c_0_13%,transparent_14%),#dae0bf]"/></div><div className="absolute bottom-5 left-5 rounded-2xl bg-[#fffaf0]/90 px-4 py-3 shadow-sm backdrop-blur"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7d906e]">GreenBite favorite</div><div className="serif mt-1 text-xl">Citrus Tahini Bowl</div></div></div><div className="flex items-center justify-between px-5 py-4"><div><div className="serif text-xl">A good plate, made clear.</div><div className="mt-1 text-xs text-muted-foreground">Ingredients · nutrition · dietary fit</div></div><div className="flex gap-2"><span className="rounded-full bg-[#e9f0df] px-3 py-1.5 text-xs font-semibold text-[#4c6948]">482 kcal</span><span className="rounded-full bg-[#f7e7d9] px-3 py-1.5 text-xs font-semibold text-[#90563e]">18g protein</span></div></div></div><div className="absolute -left-8 top-12 rounded-2xl border border-[#e6e0cf] bg-[#fffdf6] p-4 shadow-lg"><div className="flex items-center gap-2 text-xs font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#e6f0dd] text-primary"><Leaf size={14}/></span>Dietary fit</div><div className="mt-2 flex gap-1.5"><span className="rounded-full bg-[#eef2e5] px-2 py-1 text-[10px]">Vegan</span><span className="rounded-full bg-[#eef2e5] px-2 py-1 text-[10px]">Dairy-free</span></div></div><div className="absolute -bottom-6 right-0 rounded-2xl bg-[#294d3c] px-5 py-4 text-[#f7f3e7] shadow-lg"><span className="text-[10px] uppercase tracking-[.18em] text-[#c1d4b6]">Every plate has</span><div className="serif mt-1 text-2xl">nothing to hide.</div></div></div></div>
    </section>
    <section id="how" className="border-y border-[#e6e0cf] bg-[#f1eee3]"><div className="mx-auto grid max-w-7xl gap-7 px-5 py-12 md:grid-cols-3 md:px-10 md:py-16">{[['01','Find your fit','Filter neighborhood dishes by what matters to you.'],['02','See the whole plate','Nutrition, allergens and ingredients in plain sight.'],['03','Choose with confidence','Compare a few favorites before you order.']].map(([n,h,p])=><div key={n} className="flex gap-4"><div className="serif text-3xl text-[#d77c59]">{n}</div><div><h3 className="serif text-xl">{h}</h3><p className="mt-2 max-w-[270px] text-sm leading-6 text-muted-foreground">{p}</p></div></div>)}</div></section>
    <section className="mx-auto grid max-w-7xl gap-5 px-5 py-14 md:grid-cols-2 md:px-10 md:py-20">
      <article className="rounded-[28px] border border-[#e5dfcf] bg-[#fffdf6] p-7 md:p-9"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#bd704f]">The problem</p><h2 className="serif mt-3 text-3xl leading-tight md:text-4xl">A menu shouldn’t make you guess.</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">It can be hard to find a dish that fits your needs when nutrition, allergens, and dietary details are hidden or missing.</p></article>
      <article className="rounded-[28px] bg-[#e8eee0] p-7 md:p-9"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">A clearer way</p><h2 className="serif mt-3 text-3xl leading-tight md:text-4xl">Know your food. Choose better.</h2><p className="mt-4 text-sm leading-7 text-[#5f705f]">NutriMenu helps kitchens share a dish’s full picture, so guests can choose with confidence and enjoy the food that feels right for them.</p></article>
    </section>
    <section className="bg-[#f1eee3] px-5 py-14 md:px-10 md:py-20"><div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Thoughtful details, built in</p><h2 className="serif mt-3 text-3xl leading-tight md:text-4xl">Everything you need for a more thoughtful menu.</h2></div><div className="mt-7 grid gap-3 md:grid-cols-3"><article className="rounded-2xl border border-[#e4dfd2] bg-[#fffdf6] p-5"><ShieldCheck className="text-primary" size={19}/><h3 className="serif mt-4 text-xl">Nutrition at a glance</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Calories, macros, fiber, sugar, sodium, and more for every dish.</p></article><article className="rounded-2xl border border-[#e4dfd2] bg-[#fffdf6] p-5"><SlidersHorizontal className="text-primary" size={19}/><h3 className="serif mt-4 text-xl">Filters that fit</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Find vegan, gluten-free, lower-calorie, and high-protein options.</p></article><article className="rounded-2xl border border-[#e4dfd2] bg-[#fffdf6] p-5"><Utensils className="text-primary" size={19}/><h3 className="serif mt-4 text-xl">One link, always current</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Update a dish once and share the latest menu by link or QR code.</p></article></div></div></section>
    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-2 md:px-10 md:py-20">
      <article className="rounded-[28px] border border-[#e5dfcf] bg-[#fffdf6] p-7 md:p-9"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">For guests</p><h2 className="serif mt-3 text-3xl">A little more clarity. A lot more confidence.</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">See nutrition, ingredients, allergens, and dietary details before you order. Compare favorites side by side and choose what works for you.</p></article>
      <article className="rounded-[28px] border border-[#e5dfcf] bg-[#fffdf6] p-7 md:p-9"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">For restaurant teams</p><h2 className="serif mt-3 text-3xl">Spend less time explaining. Share more of your story.</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Keep menu details together, spotlight dietary options, and give guests an easy way to find answers at the table.</p></article>
    </section>
    <section id="for-restaurants" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-[1fr_auto] md:items-center md:px-10 md:py-20"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">For independent kitchens</p><h2 className="serif mt-3 max-w-2xl text-4xl leading-tight md:text-5xl">A better menu starts with a little more honesty.</h2><p className="mt-4 max-w-xl leading-7 text-muted-foreground">Keep your dishes current, make nutrition understandable, and give guests a menu worth coming back to.</p></div><Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[#d87855] px-6 py-3.5 font-semibold text-white" data-testid="link-start-owner">Set up your menu <ArrowRight size={16}/></Link></section>
    <footer className="flex flex-col items-start justify-between gap-4 border-t border-border px-5 py-7 text-xs text-muted-foreground md:flex-row md:items-center md:px-10"><Brand/><span>Food clarity for neighborhood tables. © 2025 NutriMenu</span><Link href="/menu/greenbite-kitchen" className="font-semibold text-primary" data-testid="link-footer-menu">Preview a menu</Link></footer>
  </main>;
}

function AuthPage({ register=false }: {register?:boolean}) {
  const [,setLocation] = useLocation();
  const [restaurantName,setRestaurantName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      if(register){
        const {data,error:authError}=await supabase.auth.signUp({email,password,options:{data:{restaurant_name:restaurantName.trim()}}});
        if(authError)throw authError;
        if(data.session)setLocation('/dashboard');
        else setNotice('Account created. Check your email to confirm it, then sign in to open your restaurant workspace.');
      } else {
        const {error:authError}=await supabase.auth.signInWithPassword({email,password});
        if(authError)throw authError;
        setLocation('/dashboard');
      }
    } catch(reason) {
      setError(explainSupabaseError(reason));
    } finally {
      setBusy(false);
    }
  };
  return <main className="grid min-h-[100dvh] md:grid-cols-[1.04fr_.96fr]">
    <section className="relative hidden overflow-hidden bg-[#294e3c] px-12 py-10 text-[#f7f3e7] md:flex md:flex-col md:justify-between"><Brand inverse/><div className="relative z-10 mb-14 max-w-lg"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-[#d7e5ca]"><Leaf size={14}/> GOOD FOOD. CLEAR FACTS.</div><h1 className="serif text-6xl leading-[1.03]">Give every<br/>dish a <i className="text-[#e6a27e]">story.</i></h1><p className="mt-6 max-w-sm leading-7 text-[#cad7c6]">Your menu is more than a list. Make the thought behind every plate visible.</p></div><div className="absolute -right-32 top-1/3 h-[430px] w-[430px] rounded-full border border-white/10"/><div className="absolute -right-16 top-[38%] h-[310px] w-[310px] rounded-full border border-white/10"/><p className="text-xs text-[#c2d0bf]">NutriMenu for independent restaurants</p></section>
    <section className="flex min-h-[100dvh] items-center justify-center px-5 py-10"><div className="w-full max-w-[410px] page-enter"><div className="mb-9 md:hidden"><Brand/></div><Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15}/> Back to NutriMenu</Link><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">{register?'A clearer kind of menu':'Welcome back'}</p><h2 className="serif mt-3 text-4xl">{register?'Start with your menu.':'Good to see you.'}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{register?'Create your restaurant workspace and put your best dishes in the spotlight.':'Sign in to keep your menu fresh and transparent.'}</p><form className="mt-8 space-y-4" onSubmit={submit}>{register&&<label className="block text-sm font-semibold">Restaurant name<input required value={restaurantName} onChange={e=>setRestaurantName(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Your kitchen" data-testid="input-restaurant-name"/></label>}<label className="block text-sm font-semibold">Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="you@restaurant.com" data-testid="input-email"/></label><label className="block text-sm font-semibold">Password<input required type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="At least 6 characters" data-testid="input-password"/></label><Button className="mt-3 w-full py-3.5" type="submit" disabled={busy} data-testid="button-auth-submit">{busy?'Working…':register?'Create restaurant account':'Sign in'} <ArrowRight size={16}/></Button></form>{error&&<p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="mt-4 rounded-xl bg-[#e8f0de] px-4 py-3 text-sm text-[#315a42]">{notice}</p>}<p className="mt-6 text-center text-sm text-muted-foreground">{register?'Already have an account?':'New to NutriMenu?'} <Link href={register?'/login':'/register'} className="font-semibold text-primary" data-testid="link-auth-alternate">{register?'Sign in':'Create an account'}</Link></p><div className="mt-9 rounded-2xl bg-secondary/65 p-4 text-xs leading-5 text-muted-foreground"><CircleHelp size={15} className="mr-1 inline text-primary"/> Accounts and restaurant workspaces are managed by Supabase Auth. Your account can only edit its own restaurant data.</div></div></section>
  </main>;
}

const ownerNav = [
  {label:'Overview',href:'/dashboard',icon:BarChart3},
  {label:'Menu items',href:'/dashboard/menu',icon:Utensils},
  {label:'Categories',href:'/dashboard/categories',icon:SlidersHorizontal},
  {label:'Analytics',href:'/dashboard/analytics',icon:BarChart3},
  {label:'QR menu',href:'/dashboard/qr-menu',icon:QrCode},
  {label:'Restaurant profile',href:'/dashboard/restaurant',icon:Store},
  {label:'Settings',href:'/dashboard/settings',icon:Settings}
];

function OwnerShell({children, title, restaurant, email, saveError, onSignOut}: {children:ReactNode;title:string;restaurant:RestaurantProfile;email?:string;saveError:string;onSignOut:()=>void}) {
  const [location] = useLocation();
  const [mobileOpen,setMobileOpen]=useState(false);
  const initials=restaurant.name.trim().slice(0,2).toUpperCase()||'NM';
  return <div className="min-h-[100dvh] bg-[#f6f4ec] md:flex">
    <aside className="hidden w-[248px] shrink-0 border-r border-[#e5e1d5] bg-[#f9f7f0] px-4 py-5 md:flex md:flex-col">
      <div className="px-3"><Brand/></div>
      <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Workspace</div>
      <nav className="mt-3 space-y-1">{ownerNav.map(({label,href,icon:Icon})=><Link key={href} href={href} data-testid={`nav-${toSlug(label)}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${location===href?'bg-[#e8eedf] text-[#315a42]':'text-[#67746a] hover:bg-[#efeee5] hover:text-foreground'}`}><Icon size={17}/>{label}</Link>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#e8ede0] p-4"><div className="flex items-center gap-2 text-xs font-bold text-[#46664b]"><Sparkles size={14}/> Menu health</div><p className="mt-2 text-xs leading-5 text-[#647363]">Your menu is looking fresh. Check nutrition before your next update.</p><Link href="/dashboard/menu" className="mt-3 inline-flex text-xs font-bold text-primary">Review menu <ArrowRight size={13}/></Link></div>
      <div className="mt-5 flex items-center gap-3 border-t border-border px-2 pt-4"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e3c6a2] text-sm font-bold text-[#563c29]">{initials}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{restaurant.name}</div><div className="truncate text-[10px] text-muted-foreground">{email||'Owner workspace'}</div></div><button onClick={onSignOut} title="Sign out" data-testid="link-signout"><LogOut size={15} className="text-muted-foreground"/></button></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#e7e3d7] bg-[#f9f7f0]/95 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3"><button onClick={()=>setMobileOpen(!mobileOpen)} className="rounded-lg p-2 hover:bg-secondary md:hidden" aria-label="Open navigation" data-testid="button-mobile-nav"><MenuIcon size={20}/></button><div className="hidden text-xs text-muted-foreground md:block">{restaurant.name} <span className="mx-2">/</span> <span className="font-semibold text-foreground">{title}</span></div><div className="md:hidden"><Brand/></div></div>
        <div className="flex items-center gap-2"><Link href={`/menu/${restaurant.slug}`} className="hidden items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary sm:inline-flex" data-testid="link-live-menu"><Eye size={14}/> View live menu <ArrowUpRight size={13}/></Link><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e3c6a2] text-xs font-bold text-[#563c29]">{initials}</div></div>
      </header>
      {mobileOpen&&<div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={()=>setMobileOpen(false)}><nav className="h-full w-[290px] bg-[#f9f7f0] p-5" onClick={e=>e.stopPropagation()}><div className="mb-7 flex items-center justify-between"><Brand/><button onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><X/></button></div>{ownerNav.map(({label,href,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-secondary"><Icon size={17}/>{label}</Link>)}</nav></div>}
      <main className="mx-auto max-w-[1450px] px-4 py-6 md:px-8 md:py-9">{saveError&&<div role="alert" className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{saveError}</div>}{children}</main>
    </div>
  </div>;
}

function PageHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:ReactNode}) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow&&<p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}<h1 className="serif text-3xl tracking-[-.03em] md:text-[38px]" data-testid="text-page-title">{title}</h1>{description&&<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function Metric({label,value,change,icon:Icon}:{label:string;value:string;change:string;icon:any}) {
  return <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f0df] text-primary"><Icon size={17}/></span></div><div className="serif mt-4 text-3xl" data-testid={`metric-${toSlug(label)}`}>{value}</div><div className="mt-1 text-xs text-[#567650]">{change}</div></div>;
}

const chartData = [{day:'Mon',views:84,orders:24},{day:'Tue',views:108,orders:31},{day:'Wed',views:97,orders:27},{day:'Thu',views:142,orders:42},{day:'Fri',views:169,orders:52},{day:'Sat',views:218,orders:68},{day:'Sun',views:184,orders:59}];

function DashboardOverview({items}:{items:MenuItem[]}) {
  const [period,setPeriod]=useState('This week');
  const live=items.filter(i=>i.published).length;
  const averageCalories=items.length?Math.round(items.reduce((sum,item)=>sum+item.calories,0)/items.length):0;
  const averageProtein=items.length?(items.reduce((sum,item)=>sum+item.protein,0)/items.length).toFixed(1):'0';
  return <><PageHeading eyebrow="Tuesday, April 15" title="A good day to grow." description="Here's the latest from your menu. Small details add up to a better guest experience." action={<select className="rounded-full border border-border bg-card px-4 py-2.5 text-sm" value={period} onChange={e=>setPeriod(e.target.value)} data-testid="select-period"><option>This week</option><option>This month</option><option>This year</option></select>}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total menu items" value={String(items.length)} change="Across all categories" icon={Utensils}/><Metric label="Published items" value={`${live} / ${items.length}`} change={`${items.length-live} drafts`} icon={CheckCircle2}/><Metric label="Menu views" value="1,284" change="+12.8% vs last week" icon={Eye}/><Metric label="Average calories" value={`${averageCalories} kcal`} change="Per menu item" icon={Leaf}/><Metric label="Average protein" value={`${averageProtein} g`} change="Per menu item" icon={Sparkles}/></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]"><section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-start justify-between"><div><h2 className="serif text-xl">Menu attention</h2><p className="mt-1 text-xs text-muted-foreground">Guest views and saves · {period.toLowerCase()}</p></div><button className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Chart options" data-testid="button-chart-options"><MoreHorizontal size={18}/></button></div><div className="mt-6 h-[255px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:8,left:-20,bottom:0}}><defs><linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#477958" stopOpacity={.22}/><stop offset="95%" stopColor="#477958" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8e4d9"/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#849085'}}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#849085'}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #e5e1d5',fontSize:12}}/><Area type="monotone" dataKey="views" stroke="#477958" strokeWidth={2.5} fill="url(#viewsFill)"/><Area type="monotone" dataKey="orders" stroke="#d9825f" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer></div><div className="mt-2 flex gap-5 text-xs text-muted-foreground"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#477958]"/>Menu views</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#d9825f]"/>Dish saves</span></div></section>
     <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="serif text-xl">Recent menu items</h2><p className="mt-1 text-xs text-muted-foreground">The latest dishes in your collection</p></div><Link href="/dashboard/menu" className="text-xs font-semibold text-primary">Manage menu <ArrowRight className="ml-1 inline" size={13}/></Link></div><div className="mt-5 space-y-3">{items.slice(0,5).map(item=><div key={item.id} className="flex items-center gap-3 rounded-xl bg-muted/45 p-2"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl"><PlateArt item={item}/></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{item.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.category} · {money(item.price)}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.published?'bg-[#e6f0dd] text-[#42694a]':'bg-muted text-muted-foreground'}`}>{item.published?'Published':'Draft'}</span></div>)}</div></section></div>
    <section className="mt-5 rounded-2xl border border-[#e2dfd0] bg-[#e9efe2] p-5 md:flex md:items-center md:justify-between md:px-7"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d8e5cc] text-primary"><Sparkles size={19}/></span><div><h3 className="font-semibold">One quick menu check</h3><p className="mt-1 text-sm text-[#647363]">{items.filter(i=>!i.published).length} dishes are still drafts. Make sure your best work is visible.</p></div></div><Link href="/dashboard/menu" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground md:mt-0" data-testid="link-review-drafts">Review menu <ArrowRight size={14}/></Link></section>
  </>;
}

function MenuManagement({items,setItems,restaurantSlug}:{items:MenuItem[];setItems:(items:MenuItem[])=>Promise<void>;restaurantSlug:string}) {
  const [search,setSearch]=useState('');const [category,setCategory]=useState('All categories');const [status,setStatus]=useState('All dishes');const [notice,setNotice]=useState('');
  const filtered=items.filter(i=>(i.name.toLowerCase().includes(search.toLowerCase())||i.description.toLowerCase().includes(search.toLowerCase()))&&(category==='All categories'||i.category===category)&&(status==='All dishes'||(status==='Published'?i.published:!i.published)));
  const toggle=(it:MenuItem)=>{void setItems(items.map(i=>i.id===it.id?{...i,published:!i.published}:i)).catch(()=>{});setNotice(`${it.name} ${it.published?'moved to drafts':'published'} successfully.`);setTimeout(()=>setNotice(''),2400);};
  const remove=(it:MenuItem)=>{if(window.confirm(`Delete "${it.name}" from your menu?`))void setItems(items.filter(i=>i.id!==it.id)).catch(()=>{});};
  return <><PageHeading eyebrow="Your collection" title="Menu items" description="Keep your menu current and give every dish the details it deserves." action={<Link href="/dashboard/menu/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" data-testid="link-add-dish"><Plus size={16}/> Add a dish</Link>}/>
    {notice&&<div role="status" className="mb-4 rounded-xl bg-[#e8f0de] px-4 py-3 text-sm text-[#315a42]">{notice}</div>}
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl bg-muted/70 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Search dishes…" data-testid="input-menu-search"/></label><select className="rounded-xl border border-input bg-card px-3 py-2 text-sm" value={category} onChange={e=>setCategory(e.target.value)} data-testid="filter-category"><option>All categories</option>{[...new Set(items.map(i=>i.category))].map(x=><option key={x}>{x}</option>)}</select><select className="rounded-xl border border-input bg-card px-3 py-2 text-sm" value={status} onChange={e=>setStatus(e.target.value)} data-testid="filter-publish-status"><option>All dishes</option><option>Published</option><option>Drafts</option></select></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item=><div key={item.id} className="relative"><DishCard item={item} restaurantSlug={restaurantSlug}/><div className="flex justify-between px-1 pt-2"><Link href={`/dashboard/menu/${item.id}/edit`} className="text-xs font-semibold text-primary" data-testid={`link-edit-${item.id}`}>Edit details <ArrowRight className="ml-1 inline" size={13}/></Link><div className="flex gap-3"><button onClick={()=>toggle(item)} className="text-xs font-semibold text-muted-foreground hover:text-primary" data-testid={`button-publish-${item.id}`}>{item.published?'Unpublish':'Publish'}</button><button onClick={()=>remove(item)} className="text-xs font-semibold text-destructive" data-testid={`button-delete-${item.id}`}>Delete</button></div></div></div>)}</div>
    {filtered.length===0&&<div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><Search/></span><h3 className="serif mt-4 text-2xl">No dishes found.</h3><p className="mt-2 text-sm text-muted-foreground">Try another search or adjust your filters.</p><Button className="mt-4" variant="outline" onClick={()=>{setSearch('');setCategory('All categories');setStatus('All dishes')}} data-testid="button-clear-filters">Clear filters</Button></div>}
  </>;
}

const blankItem=():MenuItem=>({id:'',name:'',slug:'',description:'',price:0,servingSize:'',category:'Bowls',image:'citrus',calories:0,protein:0,carbohydrates:0,fat:0,fiber:0,sugar:0,sodium:0,cholesterol:0,saturatedFat:0,dietaryOptions:[],allergens:[],published:false,createdAt:new Date().toISOString().slice(0,10)});

function ItemEditor({items,setItems,categories}:{items:MenuItem[];setItems:(items:MenuItem[])=>Promise<void>;categories:string[]}) {
  const params=useParams<{id:string}>();const id=params.id;const editing=!!id&&id!=='new';const existing=items.find(i=>i.id===id);const [,setLocation]=useLocation();
  const [form,setForm]=useState<MenuItem>(existing?{...existing}:blankItem());const [saved,setSaved]=useState(false);const [saveError,setSaveError]=useState('');
  useEffect(()=>{if(existing)setForm({...existing});},[id]);
  const update=(key:keyof MenuItem,value:any)=>setForm(f=>({...f,[key]:value}));
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaveError('');const item={...form,id:editing?id:crypto.randomUUID(),slug:toSlug(form.name),createdAt:editing?form.createdAt:new Date().toISOString().slice(0,10)};try{await setItems(editing?items.map(i=>i.id===id?item:i):[item,...items]);setSaved(true);setTimeout(()=>setLocation('/dashboard/menu'),550);}catch(reason){setSaveError(reason instanceof Error?reason.message:'Could not save this dish.');}};
  const options=['Vegan','Vegetarian','Gluten-free','Dairy-free','High-protein'];
  return <><PageHeading eyebrow="Menu studio" title={editing?'Edit dish':'Add a dish'} description="A complete plate has a name, a little story, and nutrition guests can trust." action={<Link href="/dashboard/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={15}/> Back to menu</Link>}/>
    {!existing&&editing ? <div className="rounded-2xl bg-card p-10 text-center"><h2 className="serif text-2xl">We couldn’t find that dish.</h2><Link className="mt-4 inline-block text-sm font-semibold text-primary" href="/dashboard/menu">Return to menu</Link></div> : <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1.5fr_.8fr]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-7">
          <h2 className="serif text-xl">The essentials</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">Dish name<input required value={form.name} onChange={e=>update('name',e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Garden grain bowl" data-testid="input-dish-name"/></label>
            <label className="text-xs font-semibold">Category<select value={form.category} onChange={e=>update('category',e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal" data-testid="select-dish-category">{categories.map(c=><option key={c}>{c}</option>)}</select></label>
            <label className="text-xs font-semibold sm:col-span-2">Description<textarea required value={form.description} onChange={e=>update('description',e.target.value)} rows={3} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="What makes this dish special?" data-testid="input-dish-description"/></label>
            <label className="text-xs font-semibold">Price<input required min="0" step=".01" type="number" value={form.price} onChange={e=>update('price',Number(e.target.value))} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal" data-testid="input-dish-price"/></label>
            <label className="text-xs font-semibold">Serving size<input value={form.servingSize} onChange={e=>update('servingSize',e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal" placeholder="350 g" data-testid="input-serving-size"/></label>
            <label className="text-xs font-semibold sm:col-span-2">Dish image URL <span className="font-normal text-muted-foreground">(optional)</span><input type="url" value={form.image.startsWith('http')?form.image:''} onChange={e=>update('image',e.target.value||'citrus')} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal" placeholder="https://example.com/dish-photo.jpg" data-testid="input-dish-image"/><span className="mt-1 block font-normal text-muted-foreground">Leave blank to use the illustrated preview.</span></label>
          </div>
        </section>
      <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-7"><div className="flex items-center justify-between"><div><h2 className="serif text-xl">Nutrition per serving</h2><p className="mt-1 text-xs text-muted-foreground">Numbers guests can use to choose confidently.</p></div><span className="rounded-full bg-[#e8f0de] px-3 py-1.5 text-[10px] font-bold text-primary">Required for transparency</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[...nutrients,'cholesterol','saturatedFat'].map((key)=> <label key={key} className="text-xs font-semibold">{labelFor(key)}<div className="relative mt-2"><input min="0" type="number" value={form[key as keyof MenuItem] as number} onChange={e=>update(key as keyof MenuItem,Number(e.target.value))} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 pr-9 text-sm font-normal" data-testid={`input-nutrition-${key}`}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{key==='calories'?'kcal':key==='sodium'||key==='cholesterol'||key==='saturatedFat'?'mg':'g'}</span></div></label>)}</div></section>
      <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-7"><h2 className="serif text-xl">Dietary details</h2><p className="mt-1 text-xs text-muted-foreground">Select every tag that applies to this dish.</p><div className="mt-4 flex flex-wrap gap-2">{options.map(option=><label key={option} className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition ${form.dietaryOptions.includes(option)?'border-primary bg-[#e8f0de] text-primary':'border-border hover:bg-muted'}`}><input type="checkbox" className="sr-only" checked={form.dietaryOptions.includes(option)} onChange={e=>update('dietaryOptions',e.target.checked?[...form.dietaryOptions,option]:form.dietaryOptions.filter(x=>x!==option))} data-testid={`checkbox-diet-${toSlug(option)}`}/>{option}</label>)}</div><label className="mt-5 block text-xs font-semibold">Allergens <input value={form.allergens.join(', ')} onChange={e=>update('allergens',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))} className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-normal" placeholder="e.g. sesame, wheat" data-testid="input-allergens"/></label></section></div>
      <aside className="space-y-4"><section className="overflow-hidden rounded-2xl border border-border/70 bg-card"><div className="h-48"><PlateArt item={{...form,name:form.name||'Your dish'}}/></div><div className="p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Menu preview</p><h3 className="serif mt-2 text-xl">{form.name||'Your dish name'}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{form.description||'A thoughtful description goes here.'}</p><p className="mt-3 text-sm font-semibold">{money(Number(form.price)||0)} <span className="font-normal text-muted-foreground">· {form.calories||0} kcal</span></p></div></section>
      <section className="rounded-2xl border border-border/70 bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-primary"/><h3 className="text-sm font-semibold">Publishing</h3></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Published dishes appear on your public guest menu.</p><label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-muted/70 px-3 py-3 text-sm font-semibold"><span>{form.published?'Published':'Save as draft'}</span><input type="checkbox" checked={form.published} onChange={e=>update('published',e.target.checked)} className="h-4 w-4 accent-[#32684c]" data-testid="checkbox-published"/></label></section>
       <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={()=>setLocation('/dashboard/menu')} data-testid="button-cancel-dish">Cancel</Button><Button type="submit" disabled={saved} data-testid="button-save-dish">{saved?<><Check size={15}/> Saved</>:<>{editing?'Save changes':'Add dish'} <ArrowRight size={15}/></>}</Button></div>{saveError&&<p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{saveError}</p>}</aside>
    </form>}
  </>;
}

function CategoriesPage({items,setItems,categories,setCategories}:{items:MenuItem[];setItems:(items:MenuItem[])=>Promise<void>;categories:string[];setCategories:(categories:string[])=>Promise<void>}) {
  const [name,setName]=useState('');const [rename,setRename]=useState<string|null>(null);const [renameValue,setRenameValue]=useState('');
  const add=(e:FormEvent)=>{e.preventDefault();if(name.trim()&&!categories.some(c=>c.toLowerCase()===name.trim().toLowerCase()))void setCategories([...categories,name.trim()]).catch(()=>{});setName('');};
  const deleteCat=(cat:string)=>{if(items.some(i=>i.category===cat)){alert('Move the dishes in this category before deleting it.');return;}if(window.confirm(`Delete ${cat}?`))void setCategories(categories.filter(c=>c!==cat)).catch(()=>{});};
  const renameCategory=(current:string,next:string)=>{const value=next.trim();if(!value){setRename(null);return;}if(categories.some(c=>c!==current&&c.toLowerCase()===value.toLowerCase())){setRename(null);return;}void setCategories(categories.map(c=>c===current?value:c)).catch(()=>{});void setItems(items.map(item=>item.category===current?{...item,category:value}:item)).catch(()=>{});setRename(null);};
  return <>
    <PageHeading eyebrow="Organize your menu" title="Categories" description="A little structure makes it easier for guests to find their next favorite."/>
    <form onSubmit={add} className="mb-6 flex max-w-xl gap-2"><input value={name} onChange={e=>setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-input bg-card px-4 py-3 text-sm" placeholder="New category name" data-testid="input-category-name"/><Button type="submit" data-testid="button-add-category"><Plus size={16}/> Add category</Button></form>
    <div className="space-y-3">{categories.map(cat=><div key={cat} className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f0de] text-primary"><Utensils size={18}/></span>
      <div className="min-w-0 flex-1">{rename===cat?<form className="flex gap-2" onSubmit={e=>{e.preventDefault();renameCategory(cat,renameValue)}}><input value={renameValue} onChange={e=>setRenameValue(e.target.value)} className="rounded-lg border border-input px-2 py-1 text-sm" autoFocus/><Button className="px-3 py-1.5 text-xs">Save</Button></form>:<><div className="font-semibold">{cat}</div><div className="mt-1 text-xs text-muted-foreground">{items.filter(i=>i.category===cat).length} dishes</div></>}</div>
      <button onClick={()=>{setRename(cat);setRenameValue(cat)}} className="text-xs font-semibold text-primary" data-testid={`button-rename-category-${toSlug(cat)}`}>Rename</button>
      <button onClick={()=>deleteCat(cat)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${cat}`} data-testid={`button-delete-category-${toSlug(cat)}`}><X size={16}/></button>
    </div>)}</div>
  </>;
}

function AnalyticsPage({items}:{items:MenuItem[]}) {
  const [range,setRange]=useState('Last 7 days');
  return <><PageHeading eyebrow="The numbers behind your menu" title="Analytics" description="A clearer look at what guests are exploring, saving and sharing." action={<select value={range} onChange={e=>setRange(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm" data-testid="select-analytics-range"><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select>}/><div className="grid gap-4 sm:grid-cols-3"><Metric label="Menu visitors" value="1,284" change="+12.8% from previous period" icon={Eye}/><Metric label="Dish detail opens" value="792" change="61.7% of menu visitors" icon={Utensils}/><Metric label="Compare sessions" value="184" change="Guests comparing with care" icon={SlidersHorizontal}/></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-border/70 bg-card p-5"><h2 className="serif text-xl">Daily guest interest</h2><p className="mt-1 text-xs text-muted-foreground">Menu page visits this week</p><div className="mt-5 h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="#e8e4d9" strokeDasharray="3 5"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#849085'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#849085'}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #e5e1d5',fontSize:12}}/><Bar dataKey="views" fill="#477958" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div></section><section className="rounded-2xl border border-border/70 bg-card p-5"><h2 className="serif text-xl">Dishes guests revisit</h2><p className="mt-1 text-xs text-muted-foreground">Most detail views in selected period</p><div className="mt-5 space-y-3">{items.slice(0,6).map((i,n)=><div className="flex items-center gap-3 rounded-xl bg-muted/55 p-2.5" key={i.id}><span className="w-5 text-center text-xs font-bold text-muted-foreground">{n+1}</span><div className="h-10 w-10 overflow-hidden rounded-lg"><PlateArt item={i}/></div><span className="flex-1 truncate text-xs font-semibold">{i.name}</span><span className="text-xs font-semibold">{[326,271,229,184,152,118][n]} <span className="text-muted-foreground">views</span></span></div>)}</div></section></div><div className="mt-5 rounded-2xl border border-[#e2dfd0] bg-[#e9efe2] p-5"><h3 className="font-semibold">A note on these numbers</h3><p className="mt-1 text-sm leading-6 text-[#647363]">Menu data is saved in Supabase. Guest activity figures are sample data until event tracking is connected.</p></div></>;
}

function makeQrMatrix(value: string): boolean[][] {
  const version = 6;
  const size = 17 + version * 4;
  const dataCapacity = 108;
  const ecPerBlock = 16;
  const blockCount = 4;
  const bytes = Array.from(new TextEncoder().encode(value));
  const bits: number[] = [];
  const appendBits = (number: number, count: number) => { for (let i=count-1;i>=0;i--) bits.push((number >>> i) & 1); };
  appendBits(4,4); appendBits(bytes.length,8);
  bytes.forEach(byte=>appendBits(byte,8));
  for(let i=0;i<Math.min(4,dataCapacity*8-bits.length);i++)bits.push(0);
  while(bits.length%8)bits.push(0);
  const data:number[]=[];
  for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
  for(let pad=0;data.length<dataCapacity;pad++)data.push(pad%2?0x11:0xec);
  const mul=(x:number,y:number)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}return z;};
  const divisor=(degree:number)=>{let result=Array(degree).fill(0);result[degree-1]=1;let root=1;for(let i=0;i<degree;i++){for(let j=0;j<degree;j++){result[j]=mul(result[j],root);if(j+1<degree)result[j]^=result[j+1];}root=mul(root,2);}return result;};
  const generator=divisor(ecPerBlock);
  const remainder=(block:number[])=>{const result=Array(ecPerBlock).fill(0);block.forEach(byte=>{const factor=byte^result[0];result.shift();result.push(0);for(let i=0;i<ecPerBlock;i++)result[i]^=mul(generator[i],factor);});return result;};
  const blocks=Array.from({length:blockCount},(_,i)=>data.slice(i*27,(i+1)*27));
  const ecc=blocks.map(remainder);
  const codewords:number[]=[];
  for(let i=0;i<27;i++)for(const block of blocks)codewords.push(block[i]);
  for(let i=0;i<ecPerBlock;i++)for(const block of ecc)codewords.push(block[i]);
  const matrix=Array.from({length:size},()=>Array(size).fill(false) as boolean[]);
  const locked=Array.from({length:size},()=>Array(size).fill(false) as boolean[]);
  const set=(x:number,y:number,dark:boolean)=>{if(x>=0&&y>=0&&x<size&&y<size){matrix[y][x]=dark;locked[y][x]=true;}};
  const finder=(x:number,y:number)=>{for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const d=Math.max(Math.abs(dx-3),Math.abs(dy-3));set(x+dx,y+dy,dx>=0&&dx<=6&&dy>=0&&dy<=6&&(d===3||d<=1));}};
  finder(0,0);finder(size-7,0);finder(0,size-7);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(34+dx,34+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  for(let i=8;i<size-8;i++){if(!locked[6][i])set(i,6,i%2===0);if(!locked[i][6])set(6,i,i%2===0);}
  // Format areas are reserved before placing payload bits.
  for(let i=0;i<15;i++){
    if(i<6)set(8,i,false);else if(i<8)set(8,i+1,false);else if(i===8)set(7,8,false);else set(14-i,8,false);
    if(i<8)set(size-1-i,8,false);else set(size-15+i,8,false);
  }
  set(8,size-8,true);
  const payload:number[]=[];for(const word of codewords)for(let bit=7;bit>=0;bit--)payload.push((word>>>bit)&1);
  let bitIndex=0;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    const upward=((right+1)&2)===0;
    for(let vert=0;vert<size;vert++)for(let col=0;col<2;col++){
      const x=right-col;const y=upward?size-1-vert:vert;
      if(!locked[y][x]&&bitIndex<payload.length){const masked=payload[bitIndex++]^((x+y)%2===0?1:0);matrix[y][x]=masked===1;}
    }
  }
  // M-level, mask 0 format word with the standard BCH remainder and mask.
  const formatData=0;
  let rem=formatData<<10;
  for(let i=14;i>=10;i--)if((rem>>>i)&1)rem^=0x537<<(i-10);
  const format=((formatData<<10)|rem)^0x5412;
  for(let i=0;i<15;i++){
    const bit=((format>>>i)&1)===1;
    if(i<6)matrix[i][8]=bit;else if(i<8)matrix[i+1][8]=bit;else if(i===8)matrix[8][7]=bit;else matrix[8][14-i]=bit;
    if(i<8)matrix[8][size-1-i]=bit;else matrix[size-15+i][8]=bit;
  }
  matrix[size-8][8]=true;
  return matrix;
}

function QRPage({restaurant}:{restaurant:RestaurantProfile}) {
  const url=`${window.location.origin}/menu/${restaurant.slug}`;
  const [copied,setCopied]=useState(false);
  const matrix=useMemo(()=>makeQrMatrix(url),[url]);
  const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setCopied(false);}};
  return <><PageHeading eyebrow="Your menu, one scan away" title="QR menu" description="Set this at the table, on a takeaway bag, or by the door. Guests land straight on the live menu."/><div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><section className="rounded-3xl border border-border/70 bg-card p-6 text-center shadow-sm md:p-10"><svg className="mx-auto aspect-square w-full max-w-[310px] rounded-2xl bg-white p-3" viewBox={`0 0 ${matrix.length+8} ${matrix.length+8}`} role="img" aria-label={`Scannable QR code for the ${restaurant.name} menu`} data-testid="qr-menu-code"><rect width="100%" height="100%" fill="white"/>{matrix.flatMap((row,r)=>row.map((cell,c)=>cell?<rect key={`${r}-${c}`} x={c+4} y={r+4} width="1" height="1" fill="#234c39"/>:null))}</svg><h2 className="serif mt-6 text-2xl">{restaurant.name}</h2><p className="mt-1 text-xs text-muted-foreground">Scan to explore our menu</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={()=>window.print()} variant="outline" data-testid="button-print-qr"><Download size={15}/> Print QR menu</Button><Button onClick={copy} data-testid="button-copy-menu-link">{copied?<Check size={15}/>:<ExternalLink size={15}/>} {copied?'Link copied':'Copy menu link'}</Button></div></section><div className="space-y-4"><section className="rounded-2xl border border-border/70 bg-card p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f0de] text-primary"><QrCode size={21}/></span><h2 className="serif mt-4 text-2xl">A menu that moves with you.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This code points directly to your public menu. Publish changes whenever you need — there’s nothing new to print.</p><div className="mt-5 rounded-xl bg-muted/65 p-3"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Public menu URL</div><div className="mt-2 break-all text-xs font-semibold text-primary" data-testid="text-menu-url">{url}</div></div></section><section className="rounded-2xl border border-border/70 bg-card p-6"><h3 className="font-semibold">Before printing</h3><div className="mt-3 space-y-3 text-sm text-muted-foreground"><p className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-primary"/>Your menu link is public and ready to share.</p><p className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-primary"/>Try a test scan from your phone first.</p><p className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-primary"/>Keep enough contrast around the code.</p></div></section></div></div></>;
}

function RestaurantPage({restaurant,saveProfile}:{restaurant:RestaurantProfile;saveProfile:(values:Pick<RestaurantProfile,'name'|'description'|'location'|'website'>)=>Promise<RestaurantProfile>}) {
  const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const [name,setName]=useState(restaurant.name);const [description,setDescription]=useState(restaurant.description);const [location,setProfileLocation]=useState(restaurant.location);const [website,setWebsite]=useState(restaurant.website);
  useEffect(()=>{setName(restaurant.name);setDescription(restaurant.description);setProfileLocation(restaurant.location);setWebsite(restaurant.website);},[restaurant.id]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{await saveProfile({name,description,location,website});setSaved(true);setTimeout(()=>setSaved(false),2200);}catch(reason){setError(reason instanceof Error?reason.message:'Could not save profile.');}finally{setSaving(false);}};
  return <><PageHeading eyebrow="Tell your story" title="Restaurant profile" description="Give guests a sense of the people and values behind the food."/><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><form onSubmit={submit} className="rounded-2xl border border-border/70 bg-card p-5 md:p-7"><label className="block text-xs font-semibold">Restaurant name<input required value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal" data-testid="input-profile-name"/></label><label className="mt-5 block text-xs font-semibold">About your kitchen<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal leading-6" data-testid="input-profile-description"/></label><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Neighborhood<input value={location} onChange={e=>setProfileLocation(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal" data-testid="input-profile-location"/></label><label className="text-xs font-semibold">Website<input value={website} onChange={e=>setWebsite(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-normal" data-testid="input-profile-website"/></label></div><Button className="mt-6" disabled={saving} type="submit" data-testid="button-save-profile">{saved?<><Check size={15}/> Saved</>:saving?'Saving…':'Save profile'}</Button>{error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</form><aside className="overflow-hidden rounded-2xl border border-border/70 bg-card"><div className="relative h-52 bg-[#e3e8d2]"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,#e9bb7b,transparent_37%),radial-gradient(ellipse_at_84%_76%,#a8bd8a,transparent_42%),linear-gradient(130deg,#dce5d0,#eee2c8)]"/><div className="absolute inset-0 grid place-items-center"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#fffaf0]/75 text-primary"><Leaf size={30}/></div></div></div><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Guest view</p><h2 className="serif mt-2 text-2xl">{name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><p className="mt-4 text-xs font-semibold text-muted-foreground"><Store size={13} className="mr-1 inline"/> {location}</p></div></aside></div></>;
}

function SettingsPage({settings,restaurant,email,saveSettings,onSignOut}:{settings:RestaurantSettings;restaurant:RestaurantProfile;email?:string;saveSettings:(settings:RestaurantSettings)=>Promise<void>;onSignOut:()=>void}) {
  const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const [notifications,setNotifications]=useState(settings.menuUpdateReminders);
  const [units,setUnits]=useState<RestaurantSettings['nutritionUnits']>(settings.nutritionUnits);
  useEffect(()=>{setNotifications(settings.menuUpdateReminders);setUnits(settings.nutritionUnits);},[settings]);
  const save=async()=>{setSaving(true);setError('');try{await saveSettings({nutritionUnits:units,menuUpdateReminders:notifications});setSaved(true);setTimeout(()=>setSaved(false),2000);}catch(reason){setError(reason instanceof Error?reason.message:'Could not save preferences.');}finally{setSaving(false);}};
  const initials=restaurant.name.trim().slice(0,2).toUpperCase()||'NM';
  return <><PageHeading eyebrow="Your workspace" title="Settings" description="A few preferences to make NutriMenu feel right for your kitchen."/><div className="max-w-3xl space-y-4"><section className="rounded-2xl border border-border/70 bg-card p-5 md:p-7"><h2 className="serif text-xl">Menu preferences</h2><label className="mt-5 flex items-center justify-between gap-4 border-b border-border/70 pb-5"><span><span className="block text-sm font-semibold">Nutrition units</span><span className="mt-1 block text-xs text-muted-foreground">Choose how nutrition values are displayed.</span></span><select value={units} onChange={e=>setUnits(e.target.value as RestaurantSettings['nutritionUnits'])} className="rounded-xl border border-input bg-background px-3 py-2 text-xs" data-testid="select-units"><option>US customary</option><option>Metric</option></select></label><label className="flex cursor-pointer items-center justify-between gap-4 pt-5"><span><span className="block text-sm font-semibold">Menu update reminders</span><span className="mt-1 block text-xs text-muted-foreground">A gentle nudge when menu details might need a refresh.</span></span><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)} className="h-5 w-5 accent-[#32684c]" data-testid="checkbox-reminders"/></label></section><section className="rounded-2xl border border-border/70 bg-card p-5 md:p-7"><h2 className="serif text-xl">Account</h2><div className="mt-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#e3c6a2] font-bold text-[#563c29]">{initials}</div><div><div className="text-sm font-semibold">{restaurant.name}</div><div className="text-xs text-muted-foreground">{email||'Restaurant owner'}</div></div></div><button onClick={onSignOut} className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted" data-testid="link-settings-signout"><LogOut size={14}/> Sign out</button></section><Button onClick={save} disabled={saving} data-testid="button-save-settings">{saved?<><Check size={15}/> Preferences saved</>:saving?'Saving…':'Save preferences'}</Button>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div></>;
}

function PublicMenu({items,restaurant}:{items:MenuItem[];restaurant:RestaurantProfile}) {
  const [search,setSearch]=useState('');const [category,setCategory]=useState('All');const [diet,setDiet]=useState('');const [selected,setSelected]=useState<string[]>([]);
  const published=items.filter(i=>i.published);
  const categories=['All',...new Set(published.map(i=>i.category))];
  const matchesFilter=(item:MenuItem)=>{
    switch(diet){
      case 'vegan': return item.dietaryOptions.includes('Vegan');
      case 'vegetarian': return item.dietaryOptions.includes('Vegetarian');
      case 'gluten-free': return item.dietaryOptions.includes('Gluten-free');
      case 'under-300': return item.calories<300;
      case 'under-500': return item.calories<500;
      case 'high-protein': return item.protein>=20;
      case 'low-sugar': return item.sugar<=10;
      case 'low-sodium': return item.sodium<=500;
      default: return true;
    }
  };
  const filtered=published.filter(i=>(i.name.toLowerCase().includes(search.toLowerCase())||i.description.toLowerCase().includes(search.toLowerCase()))&&(category==='All'||i.category===category)&&matchesFilter(i));
  const toggleCompare=(item:MenuItem)=>setSelected(s=>{const next=s.includes(item.id)?s.filter(x=>x!==item.id):s.length>=3?s:[...s,item.id];sessionStorage.setItem('nutrimenu.compare',JSON.stringify(next));return next;});
  return <main className="min-h-[100dvh] bg-[#f8f5eb]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Brand/><Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold" data-testid="link-owner-login">Restaurant owner <ArrowUpRight size={14}/></Link></header>
    <section className="relative mx-auto max-w-7xl overflow-hidden px-5 pb-8 pt-8 md:px-10 md:pb-12"><div className="absolute right-[8%] top-4 h-48 w-48 rounded-full bg-[#e5dcaa]/40 blur-3xl"/><div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full bg-[#e9f0df] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-[#75a06d]"/> {restaurant.location||'Neighborhood kitchen'}</div><h1 className="serif mt-5 text-5xl leading-[.98] tracking-[-.04em] md:text-7xl" data-testid="text-restaurant-title">{restaurant.name}</h1><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{restaurant.description}</p></div><div className="flex gap-2"><Link href={`/menu/${restaurant.slug}/compare`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold" data-testid="link-compare-page"><SlidersHorizontal size={14}/> Compare dishes {selected.length>0&&<span className="rounded-full bg-primary px-1.5 text-[10px] text-white">{selected.length}</span>}</Link><Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground" data-testid="link-owner-dashboard">Owner dashboard <ArrowUpRight size={14}/></Link></div></div>
       <div className="mt-8 grid gap-2 rounded-2xl border border-[#e5e1d5] bg-[#fffdf6] p-3 md:grid-cols-[1fr_auto_auto]"><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find something good…" className="w-full rounded-xl bg-transparent py-3 pl-9 pr-3 text-sm outline-none" data-testid="input-customer-search"/></label><select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-border bg-[#fffdf6] px-3 py-2.5 text-sm" data-testid="filter-customer-category">{categories.map(c=><option key={c}>{c}</option>)}</select><select value={diet} onChange={e=>setDiet(e.target.value)} aria-label="Filter by diet or nutrition" className="rounded-xl border border-border bg-[#fffdf6] px-3 py-2.5 text-sm" data-testid="filter-diet"><option value="">Any dietary fit</option><option value="vegan">Vegan</option><option value="vegetarian">Vegetarian</option><option value="gluten-free">Gluten free</option><option value="under-300">Under 300 calories</option><option value="under-500">Under 500 calories</option><option value="high-protein">High protein</option><option value="low-sugar">Low sugar</option><option value="low-sodium">Low sodium</option></select></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${category===c?'bg-primary text-primary-foreground':'bg-[#ece9de] text-[#657368] hover:bg-[#e2e4d6]'}`} data-testid={`filter-chip-${toSlug(c)}`}>{c}</button>)}</div>
    </section>
    <section className="mx-auto max-w-7xl px-5 pb-20 md:px-10"><div className="mb-5 flex items-center justify-between"><div><h2 className="serif text-2xl">{search||diet||category!=='All'?'The good stuff':'Made for your day'}</h2><p className="mt-1 text-xs text-muted-foreground">{filtered.length} dishes with the full picture</p></div><span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><ShieldCheck size={14} className="text-primary"/> Nutrition shared with care</span></div>{filtered.length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(item=><DishCard item={item} restaurantSlug={restaurant.slug} customer key={item.id} selected={selected.includes(item.id)} onCompare={toggleCompare}/>)}</div>:<div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><h3 className="serif text-2xl">No dishes on that plate.</h3><p className="mt-2 text-sm text-muted-foreground">Try another filter or search term.</p><Button variant="outline" className="mt-4" onClick={()=>{setSearch('');setDiet('');setCategory('All')}} data-testid="button-reset-customer-filters">Show every dish</Button></div>}
    </section>
    <footer className="border-t border-border bg-[#f2efe5] px-5 py-7 text-center text-xs text-muted-foreground">A little more clarity. A lot more confidence. <Brand/></footer>
    {selected.length>0&&<div className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between rounded-2xl bg-[#294e3c] px-4 py-3 text-white shadow-xl"><span className="text-xs font-semibold">{selected.length} dish{selected.length>1?'es':''} ready to compare</span><div className="flex gap-2"><button onClick={()=>setSelected([])} className="rounded-full px-3 py-2 text-xs text-white/75 hover:bg-white/10" data-testid="button-clear-compare">Clear</button><Link href={`/menu/${restaurant.slug}/compare`} className="inline-flex items-center gap-1 rounded-full bg-[#e4aa83] px-4 py-2 text-xs font-bold text-[#34291f]" data-testid="link-compare-selected">Compare now <ArrowRight size={13}/></Link></div></div>}
  </main>;
}

function DishDetail({items,restaurant,itemSlug}:{items:MenuItem[];restaurant:RestaurantProfile;itemSlug:string}) {
  const item=items.find(i=>i.slug===itemSlug);const [,setLocation]=useLocation();
  if(!item)return <NotFound/>;
  const addCompare=()=>{try{const old=JSON.parse(sessionStorage.getItem('nutrimenu.compare')||'[]') as string[];sessionStorage.setItem('nutrimenu.compare',JSON.stringify([...new Set([...old,item.id])].slice(-3)));}catch{}setLocation(`/menu/${restaurant.slug}/compare`);};
  return <main className="min-h-[100dvh] bg-[#f8f5eb]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Brand/><Link href={`/menu/${restaurant.slug}`} className="text-sm font-semibold text-muted-foreground" data-testid="link-back-menu"><ArrowLeft className="mr-1 inline" size={15}/> Menu</Link></header><div className="mx-auto max-w-6xl px-5 pb-16 md:px-10"><div className="mb-5 text-xs text-muted-foreground"><Link href={`/menu/${restaurant.slug}`} className="hover:text-primary">{restaurant.name}</Link><span className="mx-2">/</span>{item.category}</div><div className="grid gap-6 lg:grid-cols-[1.03fr_.97fr]"><div className="overflow-hidden rounded-[28px]"><PlateArt item={item} large/></div><section className="flex flex-col justify-center rounded-[28px] border border-border/70 bg-card p-6 md:p-9"><span className="w-fit rounded-full bg-[#e8f0de] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-primary">{item.category} · {item.servingSize}</span><h1 className="serif mt-4 text-4xl leading-tight md:text-5xl" data-testid="text-item-title">{item.name}</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">{item.description}</p><div className="mt-5 flex flex-wrap gap-2">{automaticBadges(item).map(b=><span key={b} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">{b}</span>)}</div><div className="mt-7 flex items-center justify-between border-y border-border py-4"><span className="text-sm text-muted-foreground">A thoughtful plate for</span><span className="serif text-3xl">{money(item.price)}</span></div><div className="mt-5 flex gap-2"><Button onClick={addCompare} data-testid="button-add-to-comparison"><SlidersHorizontal size={15}/> Compare this dish</Button><Link href={`/menu/${restaurant.slug}`} className="inline-flex items-center rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted" data-testid="link-all-dishes">All dishes</Link></div></section></div>
      <section className="mt-6 rounded-[28px] border border-border/70 bg-card p-6 md:p-9"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">The full picture</p><h2 className="serif mt-2 text-3xl">Nutrition per serving</h2></div><span className="text-xs text-muted-foreground">Serving size: {item.servingSize}</span></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{nutrients.map(key=><div key={key} className={`rounded-2xl p-4 ${key==='calories'?'bg-[#e9f0df]':'bg-muted/70'}`}><div className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{labelFor(key)}</div><div className="serif mt-2 text-2xl" data-testid={`nutrition-${key}`}>{item[key]}<span className="ml-1 text-xs font-sans">{key==='calories'?'kcal':key==='sodium'?'mg':'g'}</span></div></div>)}</div><div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2"><div><h3 className="text-xs font-bold uppercase tracking-[.12em]">Dietary options</h3><div className="mt-3 flex flex-wrap gap-2">{item.dietaryOptions.length?item.dietaryOptions.map(x=><span className="rounded-full bg-[#e8f0de] px-3 py-1.5 text-xs font-semibold text-primary" key={x}>{x}</span>):<span className="text-sm text-muted-foreground">No specific dietary claims.</span>}</div></div><div><h3 className="text-xs font-bold uppercase tracking-[.12em]">Allergens</h3><p className="mt-3 text-sm text-muted-foreground">{item.allergens.length?item.allergens.join(' · '):'No declared allergens.'}</p></div></div><p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={15} className="shrink-0 text-primary"/> Nutrition values are estimates per serving. Please speak with our team about allergies or ingredient questions.</p></section>
    </div></main>;
}

function ComparePage({items,restaurant}:{items:MenuItem[];restaurant:RestaurantProfile}) {
  const [ids,setIds]=useState<string[]>(()=>{try{return JSON.parse(sessionStorage.getItem('nutrimenu.compare')||'[]') as string[]}catch{return[]}});
  const [select,setSelect]=useState('');
  const chosen=ids.map(id=>items.find(i=>i.id===id)).filter(Boolean) as MenuItem[];
  const add=(id:string)=>{if(id&&!ids.includes(id)&&ids.length<3){const next=[...ids,id];setIds(next);sessionStorage.setItem('nutrimenu.compare',JSON.stringify(next));}setSelect('');};
  const remove=(id:string)=>{const next=ids.filter(x=>x!==id);setIds(next);sessionStorage.setItem('nutrimenu.compare',JSON.stringify(next));};
  const metrics:[string,(i:MenuItem)=>number,string][]=[['Calories',i=>i.calories,'kcal'],['Protein',i=>i.protein,'g'],['Carbs',i=>i.carbohydrates,'g'],['Fat',i=>i.fat,'g'],['Fiber',i=>i.fiber,'g'],['Sugar',i=>i.sugar,'g'],['Sodium',i=>i.sodium,'mg']];
  return <main className="min-h-[100dvh] bg-[#f8f5eb]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10"><Brand/><Link href={`/menu/${restaurant.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground" data-testid="link-compare-back"><ArrowLeft size={15}/> Menu</Link></header><div className="mx-auto max-w-7xl px-5 pb-16 md:px-10"><PageHeading eyebrow="A side-by-side look" title="Compare your plates." description="Different dishes, one clear view. Add up to three dishes to weigh what matters to you."/><div className="mb-5 flex flex-wrap items-center gap-3"><select value={select} onChange={e=>add(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm" disabled={chosen.length>=3} data-testid="select-add-compare"><option value="">Add a dish to compare…</option>{items.filter(i=>i.published&&!ids.includes(i.id)).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><Link href={`/menu/${restaurant.slug}`} className="text-xs font-semibold text-primary">Browse all dishes <ArrowRight className="ml-1 inline" size={13}/></Link></div>{!chosen.length?<div className="rounded-3xl border border-dashed border-border bg-card px-6 py-20 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f0de] text-primary"><SlidersHorizontal/></span><h2 className="serif mt-4 text-2xl">Start with a couple of favorites.</h2><p className="mt-2 text-sm text-muted-foreground">Choose dishes from the menu or use the selector above to compare nutrition side by side.</p><Link href={`/menu/${restaurant.slug}`} className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" data-testid="link-browse-for-compare">Browse the menu <ArrowRight className="ml-2" size={15}/></Link></div>:<div className="overflow-x-auto rounded-3xl border border-border/70 bg-card"><div className="min-w-[760px]"><div className="grid border-b border-border" style={{gridTemplateColumns:`170px repeat(${chosen.length},minmax(190px,1fr))`}}><div className="p-5 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Nutrition</div>{chosen.map(i=><div key={i.id} className="border-l border-border p-4"><button onClick={()=>remove(i.id)} className="float-right rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label={`Remove ${i.name}`} data-testid={`button-remove-compare-${i.id}`}><X size={15}/></button><div className="h-[105px] overflow-hidden rounded-xl"><PlateArt item={i}/></div><h3 className="serif mt-3 pr-5 text-lg leading-tight">{i.name}</h3><p className="mt-1 text-xs text-muted-foreground">{money(i.price)} · {i.servingSize}</p></div>)}</div>{metrics.map(([label,get,unit],n)=><div key={label} className={`grid border-b border-border last:border-0 ${n===0?'bg-[#eef2e5]':''}`} style={{gridTemplateColumns:`170px repeat(${chosen.length},minmax(190px,1fr))`}}><div className="flex items-center px-5 py-4 text-xs font-semibold">{label}</div>{chosen.map(i=><div key={i.id} className="flex items-center justify-between border-l border-border px-5 py-4"><span className="serif text-xl" data-testid={`compare-${toSlug(label)}-${i.id}`}>{get(i)}<small className="ml-1 font-sans text-[10px] text-muted-foreground">{unit}</small></span>{n===0&&<span className="text-[10px] text-muted-foreground">per serving</span>}</div>)}</div>)}</div></div>}<p className="mt-4 text-xs leading-5 text-muted-foreground"><ShieldCheck size={14} className="mr-1 inline text-primary"/> Values are estimates per serving. Talk with the kitchen about allergies and ingredient questions.</p></div></main>;
}

function NotFound() {
  return <main className="grid min-h-[100dvh] place-items-center px-5 text-center"><div><div className="serif text-7xl text-primary">404</div><h1 className="serif mt-3 text-3xl">This plate isn't on the menu.</h1><p className="mt-2 text-sm text-muted-foreground">That page may have moved or is still cooking.</p><Link href="/" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Back to home</Link></div></main>;
}

function FullPageMessage({title,message,loading=false}:{title:string;message:string;loading?:boolean}) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#f8f5eb] px-5 text-center"><div className="max-w-xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f0de] text-primary">{loading?<Utensils size={21}/>:<CircleHelp size={21}/>}</div><h1 className="serif mt-4 text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p><Link href="/" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Back to NutriMenu</Link></div></main>;
}

function PublicMenuRoute({page}:{page:'menu'|'dish'|'compare'}) {
  const params=useParams<{restaurantSlug:string;itemSlug?:string}>();
  const data=usePublicMenuData(params.restaurantSlug);
  if(data.loading)return <FullPageMessage loading title="Loading menu" message="Fetching the latest published dishes."/>;
  if(data.error)return <FullPageMessage title="Menu unavailable" message={data.error}/>;
  if(!data.restaurant)return <NotFound/>;
  if(page==='dish')return <DishDetail items={data.items} restaurant={data.restaurant} itemSlug={params.itemSlug||''}/>;
  if(page==='compare')return <ComparePage items={data.items} restaurant={data.restaurant}/>;
  return <PublicMenu items={data.items} restaurant={data.restaurant}/>;
}

function AppRoutes() {
  const {session,loading:authLoading}=useAuthSession();
  const workspaceState=useOwnerWorkspace(session?.user??null);
  const {workspace,loading:workspaceLoading,loadError,saveError,setItems,setCategories,saveProfile,saveSettings}=workspaceState;
  const [,setLocation]=useLocation();
  const [signOutError,setSignOutError]=useState('');
  const handleSignOut=async()=>{
    const {error}=await supabase.auth.signOut();
    if(error){setSignOutError(explainSupabaseError(error));return;}
    setLocation('/login');
  };
  const ownerRoute=(title:string,render:(workspace:OwnerWorkspace)=>ReactNode)=>{
    if(authLoading)return <FullPageMessage loading title="Checking your account" message="Restoring your secure restaurant session."/>;
    if(!session)return <Redirect to="/login"/>;
    if(workspaceLoading)return <FullPageMessage loading title="Loading your workspace" message="Fetching your restaurant profile and menu from Supabase."/>;
    if(loadError)return <FullPageMessage title="Workspace unavailable" message={loadError}/>;
    if(!workspace)return <FullPageMessage title="Workspace unavailable" message="No restaurant workspace is linked to this account. Register a restaurant account or contact the workspace owner."/>;
    return <OwnerShell title={title} restaurant={workspace.restaurant} email={session.user.email} saveError={saveError||signOutError} onSignOut={handleSignOut}>{render(workspace)}</OwnerShell>;
  };
  return <div className="grain">
    <Switch>
      <Route path="/" component={MarketingHome}/>
      <Route path="/login" component={()=>authLoading?<FullPageMessage loading title="Checking your account" message="Restoring your secure restaurant session."/>:session?<Redirect to="/dashboard"/>:<AuthPage/>}/>
      <Route path="/register" component={()=>authLoading?<FullPageMessage loading title="Checking your account" message="Restoring your secure restaurant session."/>:session?<Redirect to="/dashboard"/>:<AuthPage register/>}/>
      <Route path="/menu/:restaurantSlug/item/:itemSlug" component={()=> <PublicMenuRoute page="dish"/>}/>
      <Route path="/menu/:restaurantSlug/compare" component={()=> <PublicMenuRoute page="compare"/>}/>
      <Route path="/menu/:restaurantSlug" component={()=> <PublicMenuRoute page="menu"/>}/>
      <Route path="/dashboard" component={()=>ownerRoute('Overview',ws=><DashboardOverview items={ws.items}/>)}/>
      <Route path="/dashboard/menu" component={()=>ownerRoute('Menu items',ws=><MenuManagement items={ws.items} setItems={setItems} restaurantSlug={ws.restaurant.slug}/>)}/>
      <Route path="/dashboard/menu/new" component={()=>ownerRoute('Add a dish',ws=><ItemEditor items={ws.items} setItems={setItems} categories={ws.categories}/>)}/>
      <Route path="/dashboard/menu/:id/edit" component={()=>ownerRoute('Edit dish',ws=><ItemEditor items={ws.items} setItems={setItems} categories={ws.categories}/>)}/>
      <Route path="/dashboard/categories" component={()=>ownerRoute('Categories',ws=><CategoriesPage items={ws.items} setItems={setItems} categories={ws.categories} setCategories={setCategories}/>)}/>
      <Route path="/dashboard/analytics" component={()=>ownerRoute('Analytics',ws=><AnalyticsPage items={ws.items}/>)}/>
      <Route path="/dashboard/qr-menu" component={()=>ownerRoute('QR menu',ws=><QRPage restaurant={ws.restaurant}/>)}/>
      <Route path="/dashboard/restaurant" component={()=>ownerRoute('Restaurant profile',ws=><RestaurantPage restaurant={ws.restaurant} saveProfile={saveProfile}/>)}/>
      <Route path="/dashboard/settings" component={()=>ownerRoute('Settings',ws=><SettingsPage settings={ws.settings} restaurant={ws.restaurant} email={session?.user.email} saveSettings={saveSettings} onSignOut={handleSignOut}/>)}/>
      <Route component={NotFound}/>
    </Switch>
  </div>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><AppRoutes/></WouterRouter>;
}

export default App;
