"use client"

import { Button } from "@/components/ui/button"
import { getUserInfo, logout } from "@/lib/auth"
import { Ship, Building2, LogOut, User, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

interface HeaderProps {
  userType: "ADMIN" | "USER" | "VESSEL"
}

// lastUploadAt/lastDownloadAt/last.finishedAt 중 가장 최근 시각을 HH:MM 으로. 없으면 '없음'.
function lastSyncLabel(status: any): string {
  const cands = [status?.lastUploadAt, status?.lastDownloadAt, status?.last?.finishedAt].filter(Boolean)
  let best: Date | null = null
  for (const c of cands) {
    const d = new Date(c)
    if (!isNaN(d.getTime()) && (!best || d > best)) best = d
  }
  if (!best) return "없음"
  const hh = String(best.getHours()).padStart(2, "0")
  const mm = String(best.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export function Header({ userType }: HeaderProps) {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  const refreshStatus = async () => {
    try {
      const res = await fetch("/api/scheduler/sync")
      const j = await res.json()
      setStatus(j)
    } catch {
      /* 상태 조회 실패는 무시(버튼만 숨겨짐) */
    }
  }

  useEffect(() => {
    setUserInfo(getUserInfo())
    void refreshStatus()
  }, [])

  if (!userInfo) return null

  const Home = () => {
    const uri = userType === "ADMIN" ? "/admin/dashboard" : userType === "USER" ? "/admin/dashboard" : "/ship/dashboard"
    window.location.href = uri;
  }

  // 엣지 서버 + 선박 계정(ADMIN/USER 가 아닌 선박 권한)일 때만 수동 동기화 노출
  const showSync =
    status?.edge === true && userInfo.user_auth !== "ADMIN" && userInfo.user_auth !== "USER"
  const running = syncing || status?.running === true
  const pending: number = status?.pending ?? 0

  const handleSync = async () => {
    if (running) return
    setSyncing(true)
    try {
      const res = await fetch("/api/scheduler/sync?trigger=manual", { method: "POST" })
      const j: any = await res.json().catch(() => ({}))
      if (res.status === 409) {
        alert(j?.message || "동기화가 이미 진행 중입니다.")
      } else if (res.ok && j?.success) {
        alert(`동기화 완료\n보냄 ${j.uploaded}건 / 받음 ${j.downloaded}건`)
        if (j.downloaded > 0) {
          window.location.reload()
          return
        }
      } else {
        alert(`동기화 실패\n${j?.message || `HTTP ${res.status}`}`)
      }
    } catch (err) {
      alert(`동기화 실패\n${(err as Error).message}`)
    } finally {
      setSyncing(false)
      void refreshStatus()
    }
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
          {showSync && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={running}
                title={pending > 0 ? `중앙으로 보낼 변경 ${pending}건` : undefined}
                style={{cursor: 'pointer'}}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
                {pending > 0 ? `동기화 (${pending})` : "동기화"}
              </Button>
              <span className="hidden md:inline text-xs text-gray-400 whitespace-nowrap">마지막 동기화 {lastSyncLabel(status)}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={logout} style={{cursor: 'pointer'}}>
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  )
}
