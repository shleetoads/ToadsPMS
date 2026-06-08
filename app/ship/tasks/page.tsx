"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Filter, AlertTriangle, Calendar, CheckCircle, Clock, Wrench, User } from "lucide-react"

// Mock task data for ship user
const mockShipUserTasks = [
  {
    id: "T001",
    taskCode: "ENG-001-001",
    taskName: "주엔진 오일 교체",
    equipment: "주엔진",
    critical: "CRITICAL",
    dueDate: "2024-01-10",
    status: "지연",
    assignee: "김정비",
    estimatedHours: 4,
    description: "주엔진 윤활유 교체 및 필터 점검",
    lastMaintenance: "2023-10-10",
  },
  {
    id: "T002",
    taskCode: "ENG-001-002",
    taskName: "주엔진 냉각수 점검",
    equipment: "주엔진",
    critical: "CRITICAL",
    dueDate: "2024-01-18",
    status: "금주예정",
    assignee: "김정비",
    estimatedHours: 2,
    description: "냉각수 레벨 및 품질 점검",
    lastMaintenance: "2023-12-18",
  },
  {
    id: "T003",
    taskCode: "DEC-002-001",
    taskName: "갑판 청소 및 점검",
    equipment: "갑판",
    critical: "NORMAL",
    dueDate: "2024-01-25",
    status: "금월예정",
    assignee: "이선원",
    estimatedHours: 3,
    description: "갑판 전체 청소 및 안전점검",
    lastMaintenance: "2023-12-25",
  },
  {
    id: "T004",
    taskCode: "SAF-001-001",
    taskName: "소화기 점검",
    equipment: "소화기",
    critical: "CRITICAL",
    dueDate: "2024-01-05",
    status: "완료",
    assignee: "최안전관리자",
    estimatedHours: 3,
    description: "전체 소화기 압력 및 상태 점검",
    lastMaintenance: "2024-01-05",
    completedDate: "2024-01-05",
  },
]

export default function ShipTaskListPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [filteredTasks, setFilteredTasks] = useState(mockShipUserTasks)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const searchParams = useSearchParams()
  const taskType = searchParams.get("type") || "ALL"

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = mockShipUserTasks

    // Filter by task type from URL params
    if (taskType !== "ALL") {
      const statusMap: { [key: string]: string } = {
        delayed: "지연",
        weekly: "금주예정",
        monthly: "금월예정",
        completed: "완료",
      }
      const targetStatus = statusMap[taskType]
      if (targetStatus) {
        filtered = filtered.filter((task) => task.status === targetStatus)
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (task) =>
          task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.taskCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.equipment.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filter by status
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((task) => task.status === statusFilter)
    }

    setFilteredTasks(filtered)
  }, [taskType, searchTerm, statusFilter])

  if (!userInfo) return null

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "지연":
        return <Badge variant="destructive">지연</Badge>
      case "금주예정":
        return <Badge variant="secondary">금주예정</Badge>
      case "금월예정":
        return <Badge variant="outline">금월예정</Badge>
      case "완료":
        return <Badge variant="default">완료</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "지연":
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case "금주예정":
        return <Calendar className="w-4 h-4 text-blue-600" />
      case "금월예정":
        return <Clock className="w-4 h-4 text-purple-600" />
      case "완료":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }
  
  const getCriticalBadge = (critical: string) => {
    switch (critical) {
      case "NORMAL":
        return <Badge variant="outline" className="text-xs">일상정비</Badge>
      case "CRITICAL":
        return <Badge variant="destructive" className="text-xs">Critical</Badge>
      case "DOCK":
        return <Badge variant="secondary" className="text-xs">Dock</Badge>
      case "CMS":
        return <Badge variant="default" className="text-xs">CMS</Badge>
      default:
        return ''
    }
  }

  const getTypeTitle = (type: string) => {
    switch (type) {
      case "DELAYED":
        return "지연된 작업"
      case "weekly":
        return "금주 예정 작업"
      case "monthly":
        return "금월 예정 작업"
      case "completed":
        return "완료된 작업"
      default:
        return "전체 작업"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="outline" size="sm" onClick={() => window.history.back()} style={{cursor: 'pointer'}}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                대시보드로 돌아가기
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{getTypeTitle(taskType)}</h1>
                <p className="text-gray-600">{userInfo.ship_no} 선박의 작업 목록</p>
              </div>
            </div>
          </div>

          {/* 필터 및 검색 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">필터 및 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="작업명, 작업코드, 장비명으로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 상태</SelectItem>
                    <SelectItem value="지연">지연</SelectItem>
                    <SelectItem value="금주예정">금주예정</SelectItem>
                    <SelectItem value="금월예정">금월예정</SelectItem>
                    <SelectItem value="완료">완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 작업 목록 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                작업 목록 ({filteredTasks.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{task.taskName}</h3>
                            {task.critical && getCriticalBadge(task.critical)}
                          </div>
                          <p className="text-sm text-gray-600">{task.taskCode}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              {task.equipment}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {task.assignee}
                            </span>
                            <span>{task.estimatedHours}시간</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(task.status)}
                        <p className="text-sm text-gray-500 mt-1">
                          {task.status === "완료" ? `완료일: ${task.completedDate}` : `예정일: ${task.dueDate}`}
                        </p>
                        <p className="text-xs text-gray-400">최근 정비: {task.lastMaintenance}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">{task.description}</p>
                    {task.status !== "완료" && (
                      <div className="flex justify-end mt-3">
                        <Button variant="outline" size="sm" style={{cursor: 'pointer'}}>
                          <Wrench className="w-4 h-4 mr-2" />
                          작업 시작
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {filteredTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>조건에 맞는 작업이 없습니다.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
