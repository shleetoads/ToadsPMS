"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Calendar, CheckCircle, Clock, Wrench, TrendingUp, Settings } from "lucide-react"
import { Equipment } from '@/types/dashboard/equipment';
import ExecutionItemBagde from "@/components/layout/execution/executionItemBadge"
import EquipmentRuntime from "@/components/layout/equipmentRuntime/equipmentRuntime"
import ExecutionDashBoardItem from "@/components/layout/execution/executionDashBoardItem"

export default function ShipUserDashboard() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [equipmentTasks, setEquipmentTasks] = useState<Equipment[]>([]);
  
  const [filteredEquipment, setFilteredEquipment] = useState(equipmentTasks);
  
  const fetchEquipmentTasks = (vesselNo: string) => {
    fetch(`/api/ship/dashboard?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipmentTasks(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth();
      setUserInfo(user);

      fetchEquipmentTasks(user.ship_no);
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    setFilteredEquipment(equipmentTasks)
  }, [equipmentTasks])

  if (!userInfo) return null

  const handleTaskClick = (status: string) => {
    const params = new URLSearchParams({ status: status })
    window.location.href = `/ship/execution?${params.toString()}`
  }

  const DaysUntil = (due_date?: string | null, extension_date?: string | null) => {
    const extDays = getDaysDiff(extension_date)
    const dueDays = getDaysDiff(due_date)
    const days = extDays ?? dueDays

    if (days === null) return null

    let style = ''
    
    if (days <= 7)
      style = "text-red-600"
    else if (days <= 14)
      style = "text-orange-600"
    else
      style = "text-blue-600"

    return (
      <div className="text-right">
        <p className="text-sm font-medium">{extension_date ?? due_date}</p>
        <p className={`text-xs ${style}`}>
          {`${Math.abs(days)} ${days < 0 ? '일 전' : '일 후'}`}
        </p>
      </div>
    )
  }
  
  const getDaysDiff = (dateStr?: string | null) => {
    if (!dateStr) return null

    const today = new Date()
    const target = new Date(dateStr)

    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const targetOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate())

    const msPerDay = 1000 * 60 * 60 * 24
    return Math.round((targetOnly.getTime() - todayOnly.getTime()) / msPerDay)
  }

  /**
   * 주어진 날짜가 이번 주에 속하는지 확인합니다.
   * @param dateToCompare 비교할 날짜 객체
   * @returns boolean
   */
  const isThisWeek = (dateToCompare: Date): boolean => {
    const now = new Date(); // 현재 날짜

    // 이번 주 월요일 날짜 계산
    const todayDay = now.getDay();
    const diffToday = now.getDate() - todayDay + (todayDay === 0 ? -6 : 1); // 일요일은 0이므로 보정
    const thisMonday = new Date(now.setDate(diffToday));
    thisMonday.setHours(0, 0, 0, 0);

    // 비교할 날짜의 월요일 날짜 계산
    const compareDay = dateToCompare.getDay();
    const diffCompare = dateToCompare.getDate() - compareDay + (compareDay === 0 ? -6 : 1);
    const compareMonday = new Date(dateToCompare.setDate(diffCompare));
    compareMonday.setHours(0, 0, 0, 0);

    // 두 날짜의 월요일이 같은지 비교
    return thisMonday.getTime() === compareMonday.getTime();
  };

  /**
   * 주어진 날짜가 이번 달에 속하는지 확인합니다.
   * @param dateToCompare 비교할 날짜 객체
   * @returns boolean
   */
  const isThisMonth = (dateToCompare: Date): boolean => {
    const now = new Date(); // 현재 날짜

    // 현재 날짜의 연도와 월
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 비교할 날짜의 연도와 월
    const compareYear = dateToCompare.getFullYear();
    const compareMonth = dateToCompare.getMonth();

    // 연도와 월이 모두 같은지 확인
    return currentYear === compareYear && currentMonth === compareMonth;
  };

  const getTasksByStatus = (status: string) => {
    return equipmentTasks.reduce((total, eq) => {
      return total + eq.children.filter((task) => task.status === status).length
    }, 0)
  }

  const getTasksByCalendar = (status: string, day: string) => {
    if (day === 'WEEK') {
      return equipmentTasks.reduce((total, eq) => {
        return total + eq.children.filter((task) => task.status === status && isThisWeek(new Date(task.due_date ?? 0))).length
      }, 0)
    } else {
      return equipmentTasks.reduce((total, eq) => {
        return total + eq.children.filter((task) => task.status === status && isThisMonth(new Date(task.due_date?? 0))).length
      }, 0)
    }
  }

  // const getEquipmentIcon = (equipmentType: string) => {
  //   switch (equipmentType) {
  //     case "엔진":
  //       return "🔧"
  //     case "유압시스템":
  //       return "⚙️"
  //     case "통신장비":
  //       return "📡"
  //     default:
  //       return "🛠️"
  //   }
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{userInfo.ship_name} - 선박 대시보드</h1>
            <p className="text-gray-600">{userInfo.ship_no} 선박의 유지보수 현황을 관리하세요</p>
          </div>

          {/* 주요 지표 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <ExecutionDashBoardItem status="DELAYED" count={getTasksByStatus("DELAYED")} handleOnClick={(status) => {handleTaskClick(status)}} />
            <ExecutionDashBoardItem status="WEEKLY" count={getTasksByStatus('WEEKLY') + getTasksByCalendar("EXTENSION", 'WEEK')} handleOnClick={(status) => {handleTaskClick(status)}} />
            <ExecutionDashBoardItem status="MONTHLY" count={getTasksByStatus('MONTHLY') + getTasksByCalendar("EXTENSION", 'MONTH')} handleOnClick={(status) => {handleTaskClick(status)}} />
            <ExecutionDashBoardItem status="COMPLETE" count={getTasksByStatus("COMPLETE")} handleOnClick={(status) => {handleTaskClick(status)}} />
          </div>
          
          {/* Equipment Runtime */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
            <EquipmentRuntime vesselNo={userInfo.ship_no}></EquipmentRuntime>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  다가오는 정비 작업 (장비별, 1개월 이내)
                </CardTitle>
                <CardDescription>장비별로 예정된 유지보수 작업을 확인하고 일괄 등록하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {filteredEquipment.map((equipment) => (
                    equipment.children.some((task) => task.status === "DELAYED" || task.status === "NORMAL" || task.status === "EXTENSION") && (
                    <div key={equipment.equip_no} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-xl">⚙️</div>
                          <div>
                            <h3 className="font-semibold text-lg">{equipment.equip_name}</h3>
                            <p className="text-xs text-gray-400">장비 번호: {equipment.equip_no}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm text-gray-700 mb-2">예정된 작업 목록:</h4>
                        {equipment.children.map((task) => (
                          task.status !== "COMPLETE" && (
                          <div key={`${task.equip_no}-${task.section_code}-${task.plan_code}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                                <Wrench className="w-3 h-3 text-gray-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <p className="text-sm font-medium">{task.plan_name}</p>
                                  <ExecutionItemBagde status={task.status ?? null} critical={task.critical ?? null} />
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>담당자: {task.manager}</span>
                                  <span>작업자수: {task.workers}</span>
                                  <span>작업자별 작업시간: {task.work_hours}시간</span>
                                </div>
                              </div>
                            </div>
                            {DaysUntil(task.due_date,task.extension_date)}
                          </div>
                          )
                        ))}
                      </div>
                    </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 최근 완료된 작업 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  최근 완료된 작업
                </CardTitle>
                <CardDescription>이번 달 완료된 유지보수 작업</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredEquipment.map((equipment) => (
                    equipment.children.map((task) => (
                      task.status === "COMPLETE" && (
                    <div key={task.equip_no + '-' + task.section_code + '-' + task.plan_code} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{task.plan_name}</h4>
                            <ExecutionItemBagde critical={task.critical ?? null} status={null} />
                          </div>
                          <p className="text-sm text-gray-500">{task.equip_name}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span>담당: {task.manager}</span>
                            <span>작업자수: {task.workers}</span>
                            <span>작업자별 작업시간: {task.work_hours}시간</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default" className="mb-2">
                          완료
                        </Badge>
                        <p className="text-sm text-gray-500">완료일: {task.lastest_date}</p>
                      </div>
                    </div>
                      )
                    ))
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
