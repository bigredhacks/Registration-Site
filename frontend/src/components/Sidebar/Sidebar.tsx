"use client"; // Ensure it runs on the client side
import { useState } from "react";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: "home.png" },
  { name: "Profile", href: "/profile", icon: "home.png" },
  { name: "Register", href: "/register", icon: "home.png" },
  { name: "Team", href: "/team", icon: "home.png" },
];

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export default function Sidebar({ activePage, setActivePage }: SidebarProps) {
  return (
    <div className="h-screen w-64 rounded-r-xl bg-red-light text-white flex flex-col py-6 px-6">
      {/* Logo */}
      <div className="mb-6 flex justify-center">
        <img
          src="/brh-horizontal-white.png"
          alt="BigRed//Hacks Logo"
          className="h-20 w-auto"
          draggable="false"
        />
      </div>

      {/* Menu */}
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.href}
            onClick={() => setActivePage(item.href)}
            className={`w-full flex items-center space-x-3 px-6 py-2 rounded-lg  text-left transition-colors
        ${
          activePage === item.href
            ? "bg-white text-red-light"
            : "hover:bg-red-light-medium text-white"
        }`}
          >
            {/* TODO: Item icon does not change color yet, need square SVG or library */}
            <img src={`/${item.icon}`} alt={item.name} className="w-6 h-6" />
            <span className="text-lg">{item.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
