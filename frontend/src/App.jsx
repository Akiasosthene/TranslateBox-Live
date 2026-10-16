import { LocaleProvider } from '@/context/LocaleContext';
import "@/App.css";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
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
const Solutions = lazy(() => import("@/pages/Solutions"));
const Security = lazy(() => import("@/pages/Security"));
const Demo = lazy(() => import("@/pages/Demo"));
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
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/securite" element={<Security />} />
            <Route path="/security" element={<Security />} />
            <Route path="/demo" element={<Demo />} />
            <Route element={<OperatorShell />}>
              <Route path="/present" element={<Console />} />
              <Route path="/portal" element={<Portal />} />
              <Route path="/portal/:tab" element={<Portal />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="/loadtest" element={<LoadTest />} />
            </Route>
            <Route path="*" element={<p className="p-8">Page not found. <Link to="/">Open TranslateBox</Link></p>} />
          </Routes>
          </Suspense>
      </BrowserRouter>
    </ThemeProvider></LocaleProvider>
  );
}

export default App;
