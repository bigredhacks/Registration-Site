"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar/Sidebar";
import DashboardPage from "@/app/dashboard/page";
import ProfilePage from "@/app/profile/page";
import RegisterPage from "@/app/register/page";
import TeamPage from "@/app/team/page";

interface LayoutProps {
  activePage: string;
  setActivePage: (page: string) => void;
  admin: boolean;
}

const HackerLayout: React.FC<LayoutProps> = ({
  activePage,
  setActivePage,
  admin,
}) => {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 p-10">
        {activePage === "/dashboard" && <DashboardPage />}
        {activePage === "/profile" && <ProfilePage />}
        {activePage === "/register" && <RegisterPage />}
        {activePage === "/team" && <TeamPage />}
      </main>
    </div>
  );
};

export default HackerLayout;
