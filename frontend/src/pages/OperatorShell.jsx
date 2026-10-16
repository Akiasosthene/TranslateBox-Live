import React from "react";
import { Outlet } from "react-router-dom";
import { AuthGate } from "@/context/AuthContext";
import { TranslationProvider } from "@/context/TranslationContext";

export default function OperatorShell() {
  return <AuthGate><TranslationProvider><Outlet /></TranslationProvider></AuthGate>;
}
