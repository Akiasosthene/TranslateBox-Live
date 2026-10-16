import React from "react";
import { Outlet } from "react-router-dom";
import OperatorAccess from "@/components/OperatorAccess";
import { TranslationProvider } from "@/context/TranslationContext";

export default function OperatorShell() {
  return <OperatorAccess><TranslationProvider><Outlet /></TranslationProvider></OperatorAccess>;
}
