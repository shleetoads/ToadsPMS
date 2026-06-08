"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Filter, AlertTriangle, Calendar, CheckCircle, Clock, Ship } from "lucide-react"
import { Maintenance } from '@/types/dashboard/maintenance';

export default function TaskListPage() {
  const searchParams = useSearchParams()
  const taskType = searchParams.get("type") || "ALL"
  const vesselNo = searchParams.get("vesselNo")
  const vesselName = searchParams.get("vesselName")

  const [userInfo, setUserInfo] = useState<any>(null)
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [filteredTasks, setFilteredTasks] = useState(maintenances)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const fetchTask = (() => {
    fetch(`/api/admin/dashboard/${taskType.toLowerCase()}?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => {
        setMaintenances(data);
      })
      .catch(err => console.error(err));
  })

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchTask();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = maintenances;

    // Filter by ship ID if specified
    if (vesselNo && filtered.length > 0) {
      filtered = filtered.filter((task: { vessel_no: string }) => task.vessel_no === vesselNo);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(task =>
          task.vessel_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.plan_code?.toLowerCase().includes(searchTerm.toLowerCase())  ||
          task.plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "ALL") {
      filtered = filtered.filter(task =>
        task.status === statusFilter
      )
    }
    setFilteredTasks(filtered);
  }, [maintenances, taskType, vesselNo, searchTerm, statusFilter])

  if (!userInfo) return null

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "DELAYED":
        return <Badge variant="destructive">지연</Badge>
      case "EXTENSION":
        return <Badge variant="outline">연장</Badge>
      case "NORMAL":
        return <Badge variant="secondary">예정</Badge>
      case "COMPLATE":
        return <Badge variant="default">완료</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "DELAYED":
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case "weekly":
        return <Calendar className="w-4 h-4 text-blue-600" />
      case "monthly":
        return <Clock className="w-4 h-4 text-purple-600" />
      case "completed":
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
                돌아가기
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{getTypeTitle(taskType)}</h1>
                {vesselNo && <p className="text-gray-600">{vesselName} 선박</p>}
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
                      placeholder="작업명, 선박명, 작업코드로 검색..."
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
                    <SelectItem value="DELAYED">지연</SelectItem>
                    <SelectItem value="EXTENSION">연장</SelectItem>
                    <SelectItem value="NORMAL">예정</SelectItem>
                    <SelectItem value="COMPLATE">완료</SelectItem>
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
                  <div key={`${task.equip_no}-${task.section_code}-${task.plan_code}`} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{`${task.plan_code} - ${task.plan_name}`}</h3>
                            {task.critical && getCriticalBadge(task.critical)}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Ship className="w-3 h-3" />
                              {task.vessel_name}
                            </span>
                            <span>담당자: {task.manager}</span>
                            <span>장비: {task.equip_name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(task.status)}
                        <p className="text-sm text-gray-500 mt-1">예정일: {task.due_date}</p>
                        <p className="text-xs text-gray-400">최근 정비: {task.lastest_date}</p>
                      </div>
                    </div>
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
