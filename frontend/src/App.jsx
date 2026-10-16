import { LocaleProvider } from '@/context/LocaleContext';
import "@/App.css";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import Listener from "@/pages/Listener";

// Listeners on phones only download the listener page; the operator console
// (dialogs, QR, PDF export…) loads separately.
const OperatorShell = lazy(() => import("@/pages/OperatorShell"));
const Console = lazy(() => import("@/pages/Console"));
const Debug = lazy(() => import("@/pages/Debug"));
const LoadTest = lazy(() => import("@/pages/LoadTest"));
const Screen = lazy(() => import("@/pages/Screen"));
const Booth = lazy(() => import("@/pages/Booth"));
const Join = lazy(() => import("@/pages/Join"));
const Portal = lazy(() => import("@/pages/Portal"));
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const site = () => import("@/pages/SitePages");
const ProductPage = lazy(() => site().then((m) => ({ default: m.ProductPage })));
const ProductsIndex = lazy(() => site().then((m) => ({ default: m.ProductsIndex })));
const UseCasePage = lazy(() => site().then((m) => ({ default: m.UseCasePage })));
const UseCasesIndex = lazy(() => site().then((m) => ({ default: m.UseCasesIndex })));
const FeaturesPage = lazy(() => site().then((m) => ({ default: m.FeaturesPage })));
const HowItWorks = lazy(() => site().then((m) => ({ default: m.HowItWorks })));
const FaqPage = lazy(() => site().then((m) => ({ default: m.FaqPage })));
const SecurityPage = lazy(() => site().then((m) => ({ default: m.SecurityPage })));
const DemoPage = lazy(() => site().then((m) => ({ default: m.DemoPage })));
const Loading = () => <div className="min-h-screen bg-[#0A0D14]" aria-busy="true" />;

function App() {
  return (
    <LocaleProvider><ThemeProvider>
      <BrowserRouter>
          <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/e/:id" element={<Listener />} />
            <Route path="/e/:id/screen" element={<Screen />} />
            <Route path="/e/:id/booth" element={<Booth />} />
            <Route path="/join" element={<Join />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/produits" element={<ProductsIndex />} />
            <Route path="/produits/:slug" element={<ProductPage />} />
            <Route path="/cas-usage" element={<UseCasesIndex />} />
            <Route path="/cas-usage/:slug" element={<UseCasePage />} />
            <Route path="/solutions/*" element={<Navigate to="/cas-usage" replace />} />
            <Route path="/fonctionnalites" element={<FeaturesPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/comment-ca-marche" element={<HowItWorks />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/securite" element={<SecurityPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route element={<OperatorShell />}>
              <Route path="/present" element={<Console />} />
              <Route path="/portal" element={<Portal />} />
              <Route path="/portal/:tab" element={<Portal />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="/loadtest" element={<LoadTest />} />
            </Route>
            <Route path="*" element={<p className="p-8">Page not found. <Link to="/">Open Syntonia</Link></p>} />
          </Routes>
          </Suspense>
      </BrowserRouter>
    </ThemeProvider></LocaleProvider>
  );
}

export default App;
