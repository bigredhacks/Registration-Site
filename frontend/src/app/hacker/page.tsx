"use client";
import { useState } from "react";
import Layout from "@/components/Layout/Layout";

export default function HackerPage() {
  const [activePage, setActivePage] = useState("/dashboard"); // Initialize state

  return (
    <Layout
      activePage={activePage}
      setActivePage={setActivePage}
      admin={false}
    />
  );
}
