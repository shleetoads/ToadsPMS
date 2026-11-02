"use client"

import { Button } from "@/components/ui/button"
import { getUserInfo, logout } from "@/lib/auth"
import { Ship, Building2, LogOut, User } from "lucide-react"
import { useEffect, useState } from "react"

interface HeaderProps {
  userType: "ADMIN" | "USER" | "VESSEL"
}

export function Header({ userType }: HeaderProps) {
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    setUserInfo(getUserInfo())
  }, [])

  if (!userInfo) return null

  const Home = () => {
    const uri = userType === "ADMIN" ? "/admin/dashboard" : userType === "USER" ? "/admin/dashboard" : "/ship/dashboard"
    window.location.href = uri;
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Ship className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div onClick={Home} style={{cursor: 'pointer'}}><h1 className="text-xl font-bold text-gray-900">선박 유지보수 관리</h1></div>
            <p className="text-sm text-gray-500">
              {userInfo.user_auth === "ADMIN" ? "본사 관리자" : userInfo.user_auth === "USER" ? "본사 사용자" : `선박 사용자 - ${userInfo.ship_no}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {userInfo.user_auth === "ADMIN" ?  <Building2 className="w-4 h-4 shrink-0" /> : userInfo.user_auth === "USER" ? <Building2 className="w-4 h-4 shrink-0" /> : <Ship className="w-4 h-4 shrink-0" />}
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[12rem] min-w-0">{userInfo.user_name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={logout} style={{cursor: 'pointer'}}>
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  )
}
