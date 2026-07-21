import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "@/pages/NotFound";
import { AboutPage, BalancePaymentPage, BookingPage, ConfirmationPage, FAQPage, PetPolicyPage, PoliciesPage, RoomsPage, VisitorGuidePage } from "@/pages/InnPages";
import OwnerPage from "@/pages/OwnerPage";
import InnkeeperAccessPage from "@/pages/InnkeeperAccessPage";
import InnkeeperInvitePage from "@/pages/InnkeeperInvitePage";
import { Menu, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className="site-header"><div className="container site-header__inner">
    <Link href="/" className="wordmark" onClick={close}><span>Old Northside</span><small>Bed and Breakfast · Indianapolis</small></Link>
    <button className="menu-toggle" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="site-navigation" aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X /> : <Menu />}</button>
    <nav id="site-navigation" className={`site-nav ${open ? "site-nav--open" : ""}`}>
      <Link href="/about" onClick={close}>The House</Link><Link href="/rooms" onClick={close}>Rooms</Link><a href="https://www.visitindy.com/" target="_blank" rel="noopener noreferrer" onClick={close}>Visitor Guide</a><Link href="/booking" onClick={close}>Reservations</Link><a href="tel:+13176359123" onClick={close}><Phone size={15} /> (317) 635‑9123</a><Link href="/booking" onClick={close} className="site-nav__book">Book Direct</Link>
    </nav>
  </div></header>;
}

function SiteFooter() {
  return <footer className="site-footer"><div className="container site-footer__grid"><div><p className="wordmark"><span>Old Northside</span><small>Bed and Breakfast · Indianapolis</small></p><p className="site-footer__copy">A personal stay in the historic Dewenter-Greenen House.</p><Link href="/" className="site-footer__logo-link" aria-label="Return to the Old Northside Bed and Breakfast homepage"><img src="/manus-storage/old-northside-footer-logo_9f8b55b3.png" alt="Old Northside Bed and Breakfast" /></Link></div><div><h3>Visit</h3><p>1340 North Alabama Street<br/>Indianapolis, IN 46202</p><p><a href="tel:+13176359123">(317) 635‑9123</a><br/><a href="mailto:reservations@oldnorthsidebedandbreakfast.com">reservations@oldnorthsidebedandbreakfast.com</a></p></div><div><h3>Plan</h3><Link href="/rooms">Rooms</Link><Link href="/booking">Reservations</Link><a href="https://www.visitindy.com/" target="_blank" rel="noopener noreferrer">Visitor Guide</a><Link href="/about">The House</Link></div><div><h3>Information</h3><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms & Conditions</Link><Link href="/pet-policy">Pet Policy</Link><a href="/owner">Innkeeper sign in</a></div></div><div className="container site-footer__legal">© {new Date().getFullYear()} Old Northside Bed and Breakfast. All rights reserved.</div></footer>;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function Router() {
  return <Switch>
    <Route path="/" component={Home} /><Route path="/about" component={AboutPage} /><Route path="/visitor-guide" component={VisitorGuidePage} /><Route path="/faq" component={FAQPage} /><Route path="/rooms" component={RoomsPage} /><Route path="/booking" component={BookingPage} /><Route path="/booking/confirmation" component={ConfirmationPage} /><Route path="/booking/balance" component={BalancePaymentPage} /><Route path="/owner/invite" component={InnkeeperInvitePage} /><Route path="/owner/access" component={InnkeeperAccessPage} /><Route path="/owner" component={OwnerPage} /><Route path="/pet-policy" component={PetPolicyPage} /><Route path="/privacy">{() => <PoliciesPage kind="privacy" />}</Route><Route path="/terms">{() => <PoliciesPage kind="terms" />}</Route><Route path="/404" component={NotFound} /><Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><ScrollToTop /><div className="site-shell"><SiteHeader /><Router /><SiteFooter /></div></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
