import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, hasSupabaseEnv } from './supabaseClient';

const categories = [
  'Food','Transport','Housing','Utilities','Shopping','Entertainment','Health','Education','Other'
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (_) { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) {} }, [key, state]);
  return [state, setState];
}

// Currency handling (restricted to five options)
const ALLOWED_CURRENCIES = [
  { code: 'USD', label: 'Dollars (USD)' },
  { code: 'GBP', label: 'Pounds (GBP)' },
  { code: 'RUB', label: 'Ruble (RUB)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'INR', label: 'Indian Rupee (INR)' },
];
const ALLOWED_CODES = ALLOWED_CURRENCIES.map(c => c.code);

function inferCurrency(locale) {
  const region = (locale.split('-')[1] || '').toUpperCase();
  const map = { US: 'USD', GB: 'GBP', IE: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR',
    RU: 'RUB', IN: 'INR' };
  return map[region] || 'USD';
}

function useSettings() {
  const defaultLocale = navigator.language || 'en-US';
  const inferred = inferCurrency(defaultLocale);
  const [settings, setSettings] = useLocalStorage('et_settings', { locale: defaultLocale, currency: ALLOWED_CODES.includes(inferred) ? inferred : 'USD' });
  useEffect(() => { if (!ALLOWED_CODES.includes(settings.currency)) setSettings(s => ({ ...s, currency: 'USD' })); }, []);
  return [settings, setSettings];
}

function useCurrencyFormatter(currency, locale) {
  return useMemo(() => {
    try {
      const nf = new Intl.NumberFormat(locale || undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
      return (n) => nf.format(Number(n || 0));
    } catch {
      const nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
      return (n) => nf.format(Number(n || 0));
    }
  }, [currency, locale]);
}

function monthKeyFromDateStr(dateStr) { return (dateStr || '').slice(0, 7); }
function formatDDMM(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  } catch {
    return '';
  }
}
function shiftMonth(key, delta) { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); return `${yy}-${mm}`; }

function Header({ spent, budget, month, setMonth, fmt }) {
  const remaining = Math.max(0, budget - spent);
  const over = budget > 0 && spent > budget;
  const isAll = month === 'All';
  return (
    <div className="header">
      <div className="title">
        <span className="badge" />
        <div>
          <div style={{ fontSize: 18 }}>Carbon Purse</div>
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div className="row" style={{ alignItems: 'center', gap: 14 }}>
          <button className="btn ghost" onClick={() => setMonth('All')} title="View all months">All Months</button>
          <div className="btn-group">
            <button className="btn ghost icon" onClick={() => !isAll && setMonth(shiftMonth(month, -1))} disabled={isAll}>{'<'}</button>
            <button className="btn ghost icon" onClick={() => !isAll && setMonth(shiftMonth(month, 1))} disabled={isAll}>{'>'}</button>
          </div>
          <input
            className="input"
            type="month"
            value={isAll ? new Date().toISOString().slice(0,7) : month}
            disabled={isAll}
            onChange={e => setMonth(e.target.value)}
            /* Allow full month names without clipping while staying responsive */
            style={{ width: 200, minWidth: 200, maxWidth: '100%' }}
          />
        </div>
        <span className="pill stat">Spent: {fmt(spent || 0)}</span>
        <span className="pill stat">Budget: {fmt(budget || 0)}</span>
        <span className="pill stat" style={{ borderColor: over ? 'rgba(239,68,68,.35)' : undefined, color: over ? '#fda4af' : undefined }}>Remaining: {fmt(remaining)}{over ? ' (over)' : ''}</span>
      </div>
    </div>
  );
}

function BudgetCard({ budget, onUpdate, spent, fmt, editable = true }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget || 0);
  useEffect(() => setValue(budget || 0), [budget]);
  const remaining = Math.max(0, (budget || 0) - (spent || 0));
  const over = (budget || 0) < (spent || 0);
  return (
    <div className="card col-12">
      <div className="card-header">
        <h3>Budget</h3>
        {editable && (!editing ? (
          <button className="btn ghost" onClick={() => setEditing(true)}>Edit</button>
        ) : (
          <div className="row">
            <button className="btn ghost" onClick={() => { setEditing(false); setValue(budget || 0); }}>Cancel</button>
            <button className="btn" onClick={() => { onUpdate(Math.max(0, Number(value) || 0)); setEditing(false); }}>Save</button>
          </div>
        ))}
      </div>
      {!editing || !editable ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
          <div className="card" style={{ gridColumn: 'span 4', background: 'transparent', borderStyle: 'dashed' }}>
            <div className="stat"><div className="value">{fmt(budget || 0)}</div><div className="sub">Total</div></div>
          </div>
          <div className="card" style={{ gridColumn: 'span 4', background: 'transparent', borderStyle: 'dashed' }}>
            <div className="stat"><div className="value" style={{ color: over ? '#fb7185' : '#a3e635' }}>{fmt(spent || 0)}</div><div className="sub">Spent</div></div>
          </div>
          <div className="card" style={{ gridColumn: 'span 4', background: 'transparent', borderStyle: 'dashed' }}>
            <div className="stat"><div className="value" style={{ color: 'var(--danger)' }}>{fmt(remaining)}</div><div className="sub">Remaining</div></div>
          </div>
        </div>
      ) : (
        <div className="row">
          <input className="input" type="number" step="0.01" min="0" value={value} onChange={e => setValue(e.target.value)} placeholder="Enter total budget" />
        </div>
      )}
    </div>
  );
}

function AddExpense({ onAdd, month, nameInputRef }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [monthOnly, setMonthOnly] = useState(() => new Date().toISOString().slice(0,7));
  const [errors, setErrors] = useState({});
  const dateInputRef = useRef(null);
  // Always reflect today's date/month on mount; don't follow the header month filter
  // Month field stays synced to the selected date below
  // Keep month-only input in sync when date changes manually
  useEffect(() => { setMonthOnly((date || '').slice(0,7)); }, [date]);
  function submit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Field required';
    if (String(amount).trim() === '') nextErrors.amount = 'Field required';
    const amt = Number(amount);
    if (!nextErrors.amount && (!Number.isFinite(amt) || amt <= 0)) nextErrors.amount = 'Enter a positive amount';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    onAdd({ id: uid(), name: name.trim(), amount: Math.round(amt * 100) / 100, category, date });
    setName(''); setAmount(''); setErrors({});
  }
  return (
    <form id="add-expense-form" className="card col-12 lg-col-7" onSubmit={submit}>
      <div className="card-header"><h3>Add Expense</h3></div>
      <div className="grid add-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div className="add-name" style={{ gridColumn: 'span 4' }}>
          <div className="field">
            <label className="label" htmlFor="add-name">Expense</label>
            <input
              className={`input${errors.name ? ' error' : ''}`}
              placeholder="What did you spend on?"
              value={name}
              ref={nameInputRef}
              id="add-name"
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
              aria-invalid={!!errors.name}
            />
            {errors.name ? <div className="field-error">{errors.name}</div> : null}
          </div>
        </div>
        <div className="add-amount" style={{ gridColumn: 'span 2' }}>
          <div className="field">
            <label className="label" htmlFor="add-amount">Amount</label>
            <input
              className={`input${errors.amount ? ' error' : ''}`}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              id="add-amount"
              onChange={e => { setAmount(e.target.value); if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined })); }}
              aria-invalid={!!errors.amount}
            />
            {errors.amount ? <div className="field-error">{errors.amount}</div> : null}
          </div>
        </div>
        <div className="add-category" style={{ gridColumn: 'span 2' }}>
          <div className="field">
            <label className="label" htmlFor="add-category">Category</label>
            <select id="add-category" className="select" value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {/* Month selector next to category */}
        <div className="add-month" style={{ gridColumn: 'span 2' }}>
          <div className="field">
            <label className="label" htmlFor="add-month">Month</label>
            <input
              id="add-month"
              className="input"
              type="month"
              value={monthOnly}
              onChange={e => {
                const nextMonth = e.target.value; // YYYY-MM
                setMonthOnly(nextMonth);
                // Keep the same day when possible; clamp to the month's last day if needed
                const currentDay = Number(((date || '').slice(8,10)) || '01');
                const [yStr, mStr] = nextMonth.split('-');
                const y = Number(yStr);
                const m = Number(mStr);
                // last day of month: day 0 of next month
                const lastDay = new Date(y, m, 0).getDate();
                const clampedDay = Math.min(Math.max(currentDay, 1), lastDay);
                const dd = String(clampedDay).padStart(2, '0');
                const nextDate = `${nextMonth}-${dd}`;
                setDate(nextDate);
              }}
            />
          </div>
        </div>
        {/* Exact date selection with custom DD/MM display (year hidden) */}
        <div className="add-date" style={{ gridColumn: 'span 2' }}>
          <div className="field">
            <label className="label" htmlFor="add-date">Date</label>
            <div className="date-input-wrap">
              <input
                id="add-date"
                ref={dateInputRef}
                className="input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                aria-label="Select date"
              />
              {/* Overlay the date as DD/MM only (no year) */}
              <div className="date-overlay" aria-hidden="true">
                <span className="date-ddmm">{formatDDMM(date)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="foot">
        <span className="meta">Quick-add an expense to track spending.</span>
        <button className="btn" type="submit">Add Expense</button>
      </div>
    </form>
  );
}

function Filters({ query, setQuery, cat, setCat, className = '' }) {
  return (
    <div className={`card col-12 lg-col-5${className ? ' ' + className : ''}`}>
      <div className="row" style={{ alignItems: 'center' }}>
        <input className="input" placeholder="Search by name" value={query} onChange={e => setQuery(e.target.value)} />
        <select className="select" value={cat} onChange={e => setCat(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="All">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
}

function ExpenseItem({ exp, onDelete, onUpdate, fmt }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(exp.name);
  const [amount, setAmount] = useState(String(exp.amount));
  const [category, setCategory] = useState(exp.category);
  const [date, setDate] = useState(exp.date);
  const dateRef = useRef(null);
  function save() {
    const amt = Number(amount);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) return;
    onUpdate({ ...exp, name: name.trim(), amount: Math.round(amt * 100) / 100, category, date });
    setEdit(false);
  }
  return (
    <div className="item">
      {!edit ? (
        <>
          <div>
            <div className="name">{exp.name}</div>
            <div className="meta">{exp.id.slice(-6)}</div>
          </div>
          <div className="amount">{fmt(exp.amount)}</div>
          <div className="pill" style={{ justifySelf: 'start', textAlign: 'center' }}>{exp.category}</div>
          <div className="meta"><span aria-hidden="true">📅</span> {formatDDMM(exp.date)}</div>
          <div className="controls">
            <button className="btn ghost" onClick={() => setEdit(true)}>Edit</button>
            <button className="btn danger" onClick={() => onDelete(exp.id)}>Remove</button>
          </div>
        </>
      ) : (
        <>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
          <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="date-input-wrap">
            <input ref={dateRef} className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <div className="date-overlay" aria-hidden="true">
              <span className="date-ddmm">{formatDDMM(date)}</span>
              <span className="date-year">{(() => { try { const d = new Date(date); return isNaN(d) ? '' : d.getFullYear(); } catch { return ''; } })()}</span>
            </div>
          </div>
          <div className="controls">
            <button className="btn ghost" onClick={() => { setEdit(false); setName(exp.name); setAmount(String(exp.amount)); setCategory(exp.category); setDate(exp.date); }}>Cancel</button>
            <button className="btn" onClick={save}>Save</button>
          </div>
        </>
      )}
    </div>
  );
}

function ExpenseList({ items, onDelete, onUpdate, fmt }) {
  if (!items.length) return (
    <div className="card col-12" style={{ textAlign: 'center', color: 'var(--muted)' }}>
      No expenses yet — add your first above.
    </div>
  );
  return (
    <div className="card col-12 lg-col-8">
      <div className="card-header"><h3>Expenses</h3><span className="pill">{items.length} item(s)</span></div>
      <div className="list">
        {items.map(e => (
          <ExpenseItem key={e.id} exp={e} onDelete={onDelete} onUpdate={onUpdate} fmt={fmt} />
        ))}
      </div>
    </div>
  );
}

function Summary({ expenses, fmt }) {
  const byCat = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      const amt = Number(e.amount) || 0;
      map.set(e.category, (map.get(e.category) || 0) + amt);
    }
    return [...map.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [expenses]);
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return (
    <div className="card col-12 lg-col-4">
      <div className="card-header"><h3>Summary</h3></div>
      <div className="summary-top">
        <div className="stat summary-spent">
          <div className="value">{fmt(total)}</div>
          <div className="sub">Total Spent</div>
        </div>
        <div className="summary-pills">
          {byCat.map(([c, v]) => (
            <span key={c} className="pill">{c}: {fmt(v)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ settings, setSettings, onExport, onImport, onExportCSV }) {
  const { locale, currency } = settings;
  return (
    <div className="card col-12">
      <div className="card-header"><h3>Settings</h3></div>
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <div className="pill">Locale: {locale}</div>
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <label className="meta" style={{ minWidth: 70 }}>Currency</label>
            <select className="select" value={currency} onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))} style={{ width: 180 }}>
              {ALLOWED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={onExportCSV}>Export CSV</button>
          <button className="btn ghost" onClick={onExport}>Export JSON</button>
          <button className="btn" onClick={onImport}>Import JSON</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Toasts
  const [toasts, setToasts] = useState([]);
  function notify(message, type = 'info', ttlMs = 3200) {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, ttlMs);
  }

  // Auth session
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App state (server-backed)
  const [budgets, setBudgets] = useState({}); // map of YYYY-MM -> amount
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useSettings(); // keep locale/currency in localStorage too
  const [month, setMonth] = useLocalStorage('et_month', new Date().toISOString().slice(0,7));
  // Ensure the app opens on the present month instead of an old persisted value
  useEffect(() => {
    const current = new Date().toISOString().slice(0,7);
    if (month !== current) setMonth(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const addNameRef = React.useRef(null);

  // Setup auth session and listener
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session || null);
      setAuthLoading(false);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
    });
    return () => { subscription.unsubscribe(); mounted = false; };
  }, []);

  // Fetch server data when session present
  useEffect(() => {
    if (!session) { setExpenses([]); setBudgets({}); return; }
    let cancelled = false;
    async function load() {
      const userId = session.user.id;
      // budgets
      const { data: bRows, error: bErr } = await supabase.from('budgets').select('*').eq('user_id', userId);
      // expenses
      const { data: eRows, error: eErr } = await supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false });
      // settings (optional, fallback to local settings)
      const { data: sRows } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();

      if (bErr || eErr) {
        console.error('Failed to load data', bErr || eErr);
        notify('Failed to load data. Try again.', 'error');
        return;
      }
      if (cancelled) return;

      const map = {};
      for (const r of bRows || []) map[r.month] = Number(r.amount) || 0;
      setBudgets(map);
      setExpenses((eRows || []).map(r => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount) || 0,
        category: r.category,
        date: r.date,
      })));
      if (sRows) {
        setSettings(prev => {
          const next = { ...prev };
          if (typeof sRows.locale === 'string' && sRows.locale) next.locale = sRows.locale;
          if (ALLOWED_CODES.includes(sRows.currency)) next.currency = sRows.currency;
          return next;
        });
      }

      // Optional: migrate from localStorage if server is empty and local has data
      try {
        const localExpensesRaw = localStorage.getItem('et_expenses');
        const localBudgetsRaw = localStorage.getItem('et_budgets');
        const hasServer = (eRows && eRows.length) || (bRows && bRows.length);
        if (!hasServer && (localExpensesRaw || localBudgetsRaw)) {
          // Ensure we don't prompt repeatedly: remember per-user decision
          const migrationFlagKey = `et_migration_${userId}`;
          const migrationFlag = localStorage.getItem(migrationFlagKey);
          if (!migrationFlag) {
            if (confirm('Import your local data to your account?')) {
              const localExpenses = localExpensesRaw ? JSON.parse(localExpensesRaw) : [];
              const localBudgets = localBudgetsRaw ? JSON.parse(localBudgetsRaw) : {};
              if (Array.isArray(localExpenses) && localExpenses.length) {
                const payload = localExpenses.map(e => ({ user_id: userId, name: e.name, amount: e.amount, category: e.category, date: e.date }));
                // insert in chunks of 200
                for (let i = 0; i < payload.length; i += 200) {
                  await supabase.from('expenses').insert(payload.slice(i, i + 200));
                }
              }
              const budgetRows = Object.entries(localBudgets).map(([m, a]) => ({ user_id: userId, month: m, amount: Number(a) || 0 }));
              if (budgetRows.length) await supabase.from('budgets').upsert(budgetRows, { onConflict: 'user_id,month' });
              await supabase.from('settings').upsert({ user_id: userId, locale: settings.locale, currency: settings.currency });
              // Clear local-only copies now that data is on the server
              try { localStorage.removeItem('et_expenses'); } catch {}
              try { localStorage.removeItem('et_budgets'); } catch {}
              // Mark migration as completed to avoid future prompts
              try { localStorage.setItem(migrationFlagKey, 'done'); } catch {}
              notify('Import complete. Reloading data...', 'success');
              load();
            } else {
              // User dismissed — don't ask again automatically
              try { localStorage.setItem(migrationFlagKey, 'dismissed'); } catch {}
            }
          }
        }
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, [session]);

  const fmt = useCurrencyFormatter(settings.currency, settings.locale);
  const filteredMonthly = useMemo(() => month === 'All' ? expenses.slice() : expenses.filter(e => monthKeyFromDateStr(e.date) === month), [expenses, month]);
  const spent = useMemo(() => filteredMonthly.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filteredMonthly]);
  const filtered = useMemo(() => filteredMonthly.filter(e => (cat === 'All' || e.category === cat)).filter(e => e.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => (a.date < b.date ? 1 : -1)), [filteredMonthly, cat, query]);

  async function addExpense(e) {
    if (!session) return;
    const userId = session.user.id;
    const { data, error } = await supabase.from('expenses').insert({ user_id: userId, name: e.name, amount: e.amount, category: e.category, date: e.date }).select('*').single();
    if (error) { notify('Failed to add expense', 'error'); return; }
    setExpenses(prev => [{ id: data.id, name: data.name, amount: Number(data.amount) || 0, category: data.category, date: data.date }, ...prev]);
  }
  async function deleteExpense(id) {
    if (!session) return;
    const userId = session.user.id;
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId);
    if (error) { notify('Failed to remove expense', 'error'); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
  }
  async function updateExpense(next) {
    if (!session) return;
    const userId = session.user.id;
    const { error } = await supabase.from('expenses').update({ name: next.name, amount: next.amount, category: next.category, date: next.date }).eq('id', next.id).eq('user_id', userId);
    if (error) { notify('Failed to save expense', 'error'); return; }
    setExpenses(prev => prev.map(e => e.id === next.id ? next : e));
  }

  const monthBudget = useMemo(() => month === 'All' ? Object.values(budgets || {}).reduce((s, v) => s + (Number(v) || 0), 0) : Number(budgets[month] || 0), [budgets, month]);
  async function updateMonthBudget(val) {
    if (!session) return;
    const userId = session.user.id;
    const amount = Math.max(0, Number(val) || 0);
    const { error } = await supabase.from('budgets').upsert({ user_id: userId, month, amount }, { onConflict: 'user_id,month' });
    if (error) { notify('Failed to save budget', 'error'); return; }
    setBudgets(prev => ({ ...prev, [month]: amount }));
  }

  function doExport() {
    const data = { budgets, expenses, settings, month };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expense-tracker-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click(); a.remove();
  }
  function doImport() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files && input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          if (!parsed || typeof parsed !== 'object') throw new Error('Invalid');
          if (!parsed.expenses || !Array.isArray(parsed.expenses)) throw new Error('Missing expenses');
          if (!parsed.budgets || typeof parsed.budgets !== 'object') throw new Error('Missing budgets');
          if (!parsed.settings || typeof parsed.settings !== 'object') throw new Error('Missing settings');
          if (!confirm('Import will replace current data. Continue?')) return;
          if (!session) throw new Error('Login required');
          const userId = session.user.id;

          // Replace server data with imported data
          (async () => {
            await supabase.from('expenses').delete().eq('user_id', userId);
            await supabase.from('budgets').delete().eq('user_id', userId);
            const expPayload = parsed.expenses.map(e => ({ user_id: userId, name: e.name, amount: Number(e.amount) || 0, category: e.category, date: e.date }));
            for (let i = 0; i < expPayload.length; i += 200) {
              await supabase.from('expenses').insert(expPayload.slice(i, i + 200));
            }
            const bRows = Object.entries(parsed.budgets).map(([m, a]) => ({ user_id: userId, month: m, amount: Number(a) || 0 }));
            if (bRows.length) await supabase.from('budgets').upsert(bRows, { onConflict: 'user_id,month' });
            const nextSettings = { ...settings, ...(parsed.settings || {}) };
            if (!ALLOWED_CODES.includes(nextSettings.currency)) nextSettings.currency = 'USD';
            if (typeof nextSettings.locale !== 'string' || !nextSettings.locale) nextSettings.locale = settings.locale;
            await supabase.from('settings').upsert({ user_id: userId, locale: nextSettings.locale, currency: nextSettings.currency });
            setSettings(nextSettings);
            if (parsed.month && typeof parsed.month === 'string') setMonth(parsed.month);
            notify('Import successful', 'success');
            // reload from server
            const { data: eRows } = await supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false });
            setExpenses((eRows || []).map(r => ({ id: r.id, name: r.name, amount: Number(r.amount) || 0, category: r.category, date: r.date })));
            const { data: bRows2 } = await supabase.from('budgets').select('*').eq('user_id', userId);
            const map = {}; for (const r of bRows2 || []) map[r.month] = Number(r.amount) || 0; setBudgets(map);
          })().catch(() => notify('Import failed during upload', 'error'));
        } catch {
          notify('Failed to import JSON', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  function doExportCSV() {
    const data = filtered.map(e => ({ id: e.id, name: e.name, category: e.category, date: e.date, amount: e.amount, month: monthKeyFromDateStr(e.date), currency: settings.currency }));
    const headers = ['id','name','category','date','amount','month','currency'];
    const escape = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = [headers.join(',')].concat(data.map(row => headers.map(h => escape(row[h])).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const scope = month === 'All' ? 'all' : month; a.download = `expenses-${scope}-${settings.currency}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Auth UI
  function AuthGate() {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    async function submit(e) {
      e.preventDefault(); setLoading(true);
      try {
        if (mode === 'signup') {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          notify('Check your email to confirm sign up (if required).', 'info', 5000);
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
      } catch (err) {
        notify(err.message || 'Auth error', 'error');
      } finally { setLoading(false); }
    }
    return (
      <div className="container">
        {/* Brand heading above auth area */}
        <div className="auth-brand">
          <div className="auth-logo" aria-hidden="true" />
          <div className="auth-title">Carbon Purse</div>
          <div className="auth-subtitle">( Your expense Tracker )</div>
        </div>
        {!hasSupabaseEnv ? (
          <div className="card" style={{ maxWidth: 680, margin: '16px auto', borderColor: 'rgba(245, 158, 11, 0.35)' }}>
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="row" style={{ alignItems: 'center' }}>
                <span className="pill" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: '#fcd34d' }}>Warning</span>
                <span className="meta">Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.</span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="card auth-card">
          <div className="card-header">
            <h3>{mode === 'signup' ? 'Create Account' : 'Sign In'}</h3>
            <button className="btn ghost" onClick={() => setMode(m => m === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? 'Have an account?' : 'Create account'}
            </button>
          </div>
          <form onSubmit={submit} className="row" style={{ flexDirection: 'column' }}>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Please wait…' : (mode === 'signup' ? 'Sign Up' : 'Sign In')}</button>
          </form>
        </div>
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
          ))}
        </div>
      </div>
    );
  }

  if (authLoading) return null;
  if (!session) return <AuthGate />;

  return (
    <div className="container">
      <Header spent={spent} budget={monthBudget} month={month} setMonth={setMonth} fmt={fmt} />
      <div className="grid">
        <BudgetCard budget={monthBudget} onUpdate={updateMonthBudget} spent={spent} fmt={fmt} editable={month !== 'All'} />
        <AddExpense onAdd={addExpense} month={month} nameInputRef={addNameRef} />
        {/* Show grid filters on desktop only */}
        <Filters query={query} setQuery={setQuery} cat={cat} setCat={setCat} className="hide-mobile" />
        <Summary expenses={filtered} fmt={fmt} />
        <SettingsCard
          settings={settings}
          setSettings={(updater) => {
            setSettings(prev => {
              const next = typeof updater === 'function' ? updater(prev) : updater;
              if (session) {
                supabase
                  .from('settings')
                  .upsert({ user_id: session.user.id, locale: next.locale, currency: next.currency })
                  .catch(() => notify('Failed to save settings', 'error'));
              }
              return next;
            });
          }}
          onExport={doExport}
          onImport={doImport}
          onExportCSV={doExportCSV}
        />
        <ExpenseList items={filtered} onDelete={deleteExpense} onUpdate={updateExpense} fmt={fmt} />
      </div>
      <div className="foot">
        <span>Signed in as {session.user.email}</span>
        <div className="row">
          <button className="btn warning" onClick={async () => {
            if (!session) return;
            if (confirm('Reset all data? This cannot be undone.')) {
              const userId = session.user.id;
              try {
                await supabase.from('expenses').delete().eq('user_id', userId);
                await supabase.from('budgets').delete().eq('user_id', userId);
                setBudgets({}); setExpenses([]);
                notify('All data cleared for this account', 'success');
              } catch {
                notify('Failed to reset data', 'error');
              }
            }
          }}>Reset</button>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* Mobile floating actions */}
      <button
        className="btn fab show-mobile"
        aria-label="Quick add expense"
        onClick={() => {
          const el = document.getElementById('add-expense-form');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.setTimeout(() => { try { addNameRef.current && addNameRef.current.focus(); } catch {} }, 350);
        }}
      >+
      </button>
      <button
        className="fab secondary show-mobile"
        aria-label="Open filters"
        onClick={() => setFiltersOpen(true)}
      >Filters
      </button>

      {/* Mobile Filters Drawer */}
      {filtersOpen ? (
        <>
          <div className="drawer-backdrop show-mobile" onClick={() => setFiltersOpen(false)} />
          <div className="drawer-panel open show-mobile" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h3>Filters</h3>
              <button className="btn ghost" onClick={() => setFiltersOpen(false)}>Close</button>
            </div>
            <Filters query={query} setQuery={setQuery} cat={cat} setCat={setCat} />
          </div>
        </>
      ) : null}
    </div>
  );
}
