import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Button, Icon, Wordmark } from './ui.jsx';
import Landing from './pages/Landing.jsx';
import { Forgot, Reset, SignIn, SignUp } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceEditor from './pages/InvoiceEditor.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Clients from './pages/Clients.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  ['/app', 'Home', Icon.home, true],
  ['/app/invoices', 'Invoices', Icon.doc],
  ['/app/clients', 'Clients', Icon.users],
  ['/app/settings', 'Settings', Icon.cog],
];

function Links() {
  return NAV.map(([to, label, Ic, end]) => (
    <NavLink key={to} to={to} end={end} className="nav-link">
      <Ic /> {label}
    </NavLink>
  ));
}

function Shell() {
  const { user, signOut } = useAuth();
  return (
    <div className="shell">
      <aside className="side">
        <Wordmark to="/app" />
        <nav aria-label="Main"><Links /></nav>
        <div className="side__user">
          <div><strong>{user.business_name || user.name}</strong><span>{user.email}</span></div>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <main className="main" id="main"><Outlet /></main>
      <nav className="tabbar" aria-label="Main"><Links /></nav>
    </div>
  );
}

function Protected() {
  const { user, booting } = useAuth();
  const loc = useLocation();
  if (booting) return <div className="boot" role="status" aria-label="Loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  return <Shell />;
}

function Public({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <div className="boot" role="status" aria-label="Loading"><div className="spinner" /></div>;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<Public><SignIn /></Public>} />
      <Route path="/signup" element={<Public><SignUp /></Public>} />
      <Route path="/forgot" element={<Public><Forgot /></Public>} />
      <Route path="/reset/:token" element={<Reset />} />
      <Route path="/app" element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<InvoiceEditor />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/edit" element={<InvoiceEditor />} />
        <Route path="clients" element={<Clients />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="boot">
      <div className="empty">
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>This page isn't here</h1>
        <p>The link may be old, or mistyped.</p>
        <NavLink className="btn" to="/">Back to Folio</NavLink>
      </div>
    </div>
  );
}
