"use client"

import { useEffect, useState } from "react"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Ship, AlertTriangle, Calendar, CheckCircle, Clock, Users, Wrench } from "lucide-react"
import { Vessel } from '@/types/dashboard/vessel'; // ✅ interface import
import EquipmentRuntime from "@/components/layout/equipmentRuntime/equipmentRuntime"

export default function AdminDashboard() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [vesselItems, setVesselItems] = useState<Vessel[]>([]);

  const totalShips = vesselItems.length
  const totalDelayedTasks = vesselItems.reduce((sum, ship) => sum + Number(ship.delayed_tasks), 0)
  const totalWeeklyTasks = vesselItems.reduce((sum, ship) => sum + Number(ship.weekly_tasks), 0)
  const totalMonthlyTasks = vesselItems.reduce((sum, ship) => sum + Number(ship.monthly_tasks), 0)
  const totalCompletedTasks = vesselItems.reduce((sum, ship) => sum + Number(ship.completed_tasks), 0)

  const fetchVesselTask = () => {
      fetch('/api/admin/dashboard')
      .then(res => res.json())
      .then(data => setVesselItems(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);
      
      fetchVesselTask();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, []);

  if (!userInfo) return null

  const handleTaskClick = (type: string, vesselNo?: string, vesselName?: string) => {
    // Navigate to detailed task list
    const params = new URLSearchParams({ type })
    if (vesselNo) params.append("vesselNo", vesselNo)
    if (vesselName) params.append("vesselName", vesselName)
    window.location.href = `/admin/tasks?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">관리자 대시보드</h1>
            <p className="text-gray-600">전체 선박의 유지보수 현황을 모니터링하세요</p>
          </div>

          {/* 전체 현황 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 선박 수</CardTitle>
                <Ship className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalShips}</div>
                <p className="text-xs text-muted-foreground">활성 선박</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">지연된 작업</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{totalDelayedTasks}</div>
                <p className="text-xs text-muted-foreground">즉시 조치 필요</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">금주 예정 작업</CardTitle>
                <Calendar className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{totalWeeklyTasks}</div>
                <p className="text-xs text-muted-foreground">이번 주 예정</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">금월 완료 작업</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{totalCompletedTasks}</div>
                <p className="text-xs text-muted-foreground">이번 달 완료</p>
              </CardContent>
            </Card>
          </div>

          {/* 선박별 정비 현황 */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                선박별 정비 현황
              </CardTitle>
              <CardDescription>각 선박의 유지보수 작업 현황을 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vesselItems.map((vessel) => (
                  <div key={vessel.vessel_no} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Ship className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{vessel.vessel_name}</h3>
                          <p className="text-sm text-gray-500">
                            {vessel.vessel_no}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Button
                        variant="outline"
                        className="h-auto p-3 flex flex-col items-center gap-2 bg-transparent"
                        onClick={() => handleTaskClick("DELAYED", vessel.vessel_no, vessel.vessel_name)}
                        style={{cursor: 'pointer'}}
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-lg font-bold text-red-600">{vessel.delayed_tasks}</span>
                        </div>
                        <span className="text-xs text-gray-600">지연된 작업</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-3 flex flex-col items-center gap-2 bg-transparent"
                        onClick={() => handleTaskClick("weekly", vessel.vessel_no, vessel.vessel_name)}
                        style={{cursor: 'pointer'}}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-orange-600" />
                          <span className="text-lg font-bold text-orange-600">{vessel.weekly_tasks}</span>
                        </div>
                        <span className="text-xs text-gray-600">금주 예정</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-3 flex flex-col items-center gap-2 bg-transparent"
                        onClick={() => handleTaskClick("monthly", vessel.vessel_no, vessel.vessel_name)}
                        style={{cursor: 'pointer'}}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                            <span className="text-lg font-bold text-blue-600">{vessel.monthly_tasks}</span>
                        </div>
                        <span className="text-xs text-gray-600">금월 예정</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto p-3 flex flex-col items-center gap-2 bg-transparent"
                        onClick={() => handleTaskClick("completed", vessel.vessel_no, vessel.vessel_name)}
                        style={{cursor: 'pointer'}}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-lg font-bold text-green-600">{vessel.completed_tasks}</span>
                        </div>
                        <span className="text-xs text-gray-600">금월 완료</span>
                      </Button>
                    </div>

                    {/* ME / G/E 운전 시간 (조회 전용) */}
                    <div className="mt-4">
                      <EquipmentRuntime vesselNo={vessel.vessel_no} editable={false} />
                    </div>

                    {/* Progress bar for monthly completion rate */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>월간 완료율</span>
                        <span>
                          {Math.round((vessel.completed_tasks / vessel.total_tasks) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={(vessel.completed_tasks / vessel.total_tasks) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
