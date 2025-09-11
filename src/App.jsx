import React, { useEffect, useMemo, useState } from 'react';

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

// Currency handling (restricted to four options)
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
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
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
            style={{ width: 160, minWidth: 160 }}
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
    <div className="card" style={{ gridColumn: 'span 12' }}>
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

function AddExpense({ onAdd, month }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  useEffect(() => {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0,7);
    if (month === 'All' || month === currentMonth) setDate(today.toISOString().slice(0,10));
    else setDate(`${month}-01`);
  }, [month]);
  function submit(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) return;
    onAdd({ id: uid(), name: name.trim(), amount: Math.round(amt * 100) / 100, category, date });
    setName(''); setAmount('');
  }
  return (
    <form className="card" onSubmit={submit} style={{ gridColumn: 'span 12' }}>
      <div className="card-header"><h3>Add Expense</h3></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div style={{ gridColumn: 'span 5' }}>
          <input className="input" placeholder="What did you spend on?" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 3' }}>
          <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="foot">
        <span className="meta">Quick-add an expense to track spending.</span>
        <button className="btn" type="submit">Add Expense</button>
      </div>
    </form>
  );
}

function Filters({ query, setQuery, cat, setCat }) {
  return (
    <div className="card" style={{ gridColumn: 'span 12' }}>
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
            <div className="meta">{exp.id.slice(-6)} • {exp.date}</div>
          </div>
          <div className="amount">{fmt(exp.amount)}</div>
          <div className="pill" style={{ justifySelf: 'start', textAlign: 'center' }}>{exp.category}</div>
          <div className="meta">{new Date(exp.date).toLocaleDateString()}</div>
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
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
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
    <div className="card" style={{ gridColumn: 'span 12', textAlign: 'center', color: 'var(--muted)' }}>
      No expenses yet — add your first above.
    </div>
  );
  return (
    <div className="card" style={{ gridColumn: 'span 12' }}>
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
    for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return [...map.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [expenses]);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <div className="card" style={{ gridColumn: 'span 12' }}>
      <div className="card-header"><h3>Summary</h3></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
        <div style={{ gridColumn: 'span 6' }}>
          <div className="stat"><div className="value">{fmt(total)}</div><div className="sub">Total Spent</div></div>
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {byCat.map(([c, v]) => (<span key={c} className="pill">{c}: {fmt(v)}</span>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ settings, setSettings, onExport, onImport, onExportCSV }) {
  const { locale, currency } = settings;
  return (
    <div className="card" style={{ gridColumn: 'span 12' }}>
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
  const [budgets, setBudgets] = useLocalStorage('et_budgets', {});
  const [expenses, setExpenses] = useLocalStorage('et_expenses', []);
  const [settings, setSettings] = useSettings();
  const [month, setMonth] = useLocalStorage('et_month', new Date().toISOString().slice(0,7));
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  // migrate legacy single budget
  useEffect(() => {
    try {
      const legacy = localStorage.getItem('et_budget');
      if (legacy != null) {
        const val = Number(JSON.parse(legacy)) || 0;
        setBudgets(prev => ({ ...prev, [new Date().toISOString().slice(0,7)]: val }));
        localStorage.removeItem('et_budget');
      }
    } catch {}
  }, []);

  const fmt = useCurrencyFormatter(settings.currency, settings.locale);
  const filteredMonthly = useMemo(() => month === 'All' ? expenses.slice() : expenses.filter(e => monthKeyFromDateStr(e.date) === month), [expenses, month]);
  const spent = useMemo(() => filteredMonthly.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filteredMonthly]);
  const filtered = useMemo(() => filteredMonthly.filter(e => (cat === 'All' || e.category === cat)).filter(e => e.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => (a.date < b.date ? 1 : -1)), [filteredMonthly, cat, query]);

  function addExpense(e) { setExpenses(prev => [e, ...prev]); }
  function deleteExpense(id) { setExpenses(prev => prev.filter(e => e.id !== id)); }
  function updateExpense(next) { setExpenses(prev => prev.map(e => e.id === next.id ? next : e)); }

  const monthBudget = useMemo(() => month === 'All' ? Object.values(budgets || {}).reduce((s, v) => s + (Number(v) || 0), 0) : Number(budgets[month] || 0), [budgets, month]);
  function updateMonthBudget(val) { setBudgets(prev => ({ ...prev, [month]: Math.max(0, Number(val) || 0) })); }

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
          setBudgets(parsed.budgets || {});
          setExpenses(parsed.expenses || []);
          setSettings(prev => ({ ...prev, ...(parsed.settings || {}) }));
          if (parsed.month && typeof parsed.month === 'string') setMonth(parsed.month);
          alert('Import successful');
        } catch {
          alert('Failed to import JSON');
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

  return (
    <div className="container">
      <Header spent={spent} budget={monthBudget} month={month} setMonth={setMonth} fmt={fmt} />
      <div className="grid">
        <BudgetCard budget={monthBudget} onUpdate={updateMonthBudget} spent={spent} fmt={fmt} editable={month !== 'All'} />
        <AddExpense onAdd={addExpense} month={month} />
        <Filters query={query} setQuery={setQuery} cat={cat} setCat={setCat} />
        <Summary expenses={filtered} fmt={fmt} />
        <SettingsCard settings={settings} setSettings={setSettings} onExport={doExport} onImport={doImport} onExportCSV={doExportCSV} />
        <ExpenseList items={filtered} onDelete={deleteExpense} onUpdate={updateExpense} fmt={fmt} />
      </div>
      <div className="foot">
        <span>Data saved locally in your browser.</span>
        <button className="btn warning" onClick={() => { if (confirm('Reset all data? This cannot be undone.')) { setBudgets({}); setExpenses([]); } }}>Reset</button>
      </div>
    </div>
  );
}
