import { LocaleProvider } from '@/context/LocaleContext';
import "@/App.css";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import Listener from "@/pages/Listener";

// Listeners on phones only download the listener page; the operator console
// (dialogs, QR, PDF export…) loads separately.
const OperatorShell = lazy(() => import("@/pages/OperatorShell"));
const Console = lazy(() => import("@/pages/Console"));
const Debug = lazy(() => import("@/pages/Debug"));
const LoadTest = lazy(() => import("@/pages/LoadTest"));
const Screen = lazy(() => import("@/pages/Screen"));
const Loading = () => <div className="min-h-screen bg-[#0A0D14]" aria-busy="true" />;

function App() {
  return (
    <LocaleProvider><ThemeProvider>
      <BrowserRouter>
          <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/e/:id" element={<Listener />} />
            <Route path="/e/:id/screen" element={<Screen />} />
            <Route element={<OperatorShell />}>
              <Route path="/" element={<Console />} />
              <Route path="/debug" element={<Debug />} />
              <Route path="/loadtest" element={<LoadTest />} />
            </Route>
            <Route path="*" element={<p className="p-8">Page not found. <a href="/">Open TranslateBox</a></p>} />
          </Routes>
          </Suspense>
      </BrowserRouter>
    </ThemeProvider></LocaleProvider>
  );
}

export default App;
