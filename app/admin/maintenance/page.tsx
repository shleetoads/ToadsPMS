"use client"

import { useEffect, useState } from "react"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  User,
  Search,
  ChevronDown,
  ChevronRight,
  Wrench,
  Calendar,
  AlertTriangle,
  Settings,
  Ship,
  FolderTree,
  History,
  Clock,
  FileText,
  Download,
} from "lucide-react"
import { Vessel } from '@/types/vessel/vessel'; // ✅ interface import
import { Machine } from '@/types/vessel/machine';
import { Equipment } from '@/types/vessel/equipment';
import { MaintenanceWork } from '@/types/vessel/maintenance_work'; // ✅ interface import
import { Maintenance } from '@/types/status/maintenance'; // ✅ interface import
import { PMSData } from '@/types/status/pms_data'; // ✅ interface import
import * as XLSX from "xlsx";

export default function MaintenanceWorkManagementPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [equipmentFilteredData, setEquipmentFilteredData] = useState<Equipment[]>([])
  const [maintenanceData, setMaintenanceData] = useState<Maintenance[]>([])
  const [filteredData, setFilteredData] = useState<Maintenance[]>(maintenanceData)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [shipFilter, setShipFilter] = useState("ALL")
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [equipmentFilter, setEquipmentFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  
  const [downloadData, setDownloadData] = useState<PMSData[]>([])

  // State for work history dialogs
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isDetailHistoryDialogOpen, setIsDetailHistoryDialogOpen] = useState(false)
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<MaintenanceWork[]>([])
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")

  const fetchVessels = () => {
    fetch(`/api/admin/ships/all`)
      .then(res => res.json())
      .then(data => setVessels(data))
      .catch(err => console.error(err));
  };

  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/common/machine/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  };

  const fetchEquipments = (vesselNo: string) => {
    fetch(`/api/common/equipment/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  };

  const fetchMaintenance = () => {
    fetch(`/api/admin/maintenance`)
      .then(res => res.json())
      .then(data => setMaintenanceData(data))
      .catch(err => console.error(err));
  };
  
  const fetchMaintenanceWork = (vesselNo: string, equipNo: string, sectionCode: string, planCode: string) => {
    fetch(`/api/admin/maintenance/work?vesselNo=${vesselNo}&equipNo=${equipNo}&sectionCode=${sectionCode}&planCode=${planCode}`)
      .then(res => res.json())
      .then(data => {
        setSelectedHistoryItems(data)
        setIsHistoryDialogOpen(true)
      })
      .catch(err => console.error(err));
  };

  const fetchDownload = () => {
    fetch(`/api/admin/maintenance/download`)
      .then(res => res.json())
      .then(data => setDownloadData(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchVessels();
      fetchMaintenance();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    fetchMachines(shipFilter);
    fetchEquipments(shipFilter);
  }, [shipFilter])
  
  useEffect(() => {
    let equipmentFiltered = equipments

    if (machineFilter !== "ALL") {
      equipmentFiltered = equipmentFiltered.filter((item) => item.vessel_no === shipFilter && item.machine_name === machineFilter)
    }

    setEquipmentFilteredData(equipmentFiltered)
  }, [equipments,  shipFilter, machineFilter])

  useEffect(() => {
    let filtered = maintenanceData

    if (shipFilter !== "ALL") {
      filtered = filtered.filter((item) => item.vessel_no === shipFilter)
    }

    if (machineFilter !== "ALL") {
      filtered = filterByMachine(filtered, machineFilter)
    }

    if (equipmentFilter !== "ALL") {
      filtered = filterByEquipment(filtered, equipmentFilter)
    }

    if (statusFilter !== "ALL") {
      filtered = filterByStatus(filtered, statusFilter)
    }

    if (searchTerm) {
      filtered = filterBySearch(filtered, searchTerm)
    }

    setFilteredData(filtered)
  }, [maintenanceData, shipFilter, machineFilter, equipmentFilter, statusFilter, searchTerm])

  useEffect(() => {
    if (downloadData && downloadData.length > 0)
      downloadExcel()
  }, [downloadData])

  if (!userInfo) return null

  const filterByMachine = (items: Maintenance[], term: string): Maintenance[] => {
    return items.map((item) => {
        const matchesSearch = item.machine_name?.toLowerCase().includes(term.toLowerCase())
        const filteredChildren = item.children ? filterByMachine(item.children, term) : []

        if (matchesSearch || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren,
          }
        }
        return null
      })
      .filter(Boolean) as Maintenance[]
  }

  const filterByEquipment = (items: Maintenance[], term: string): Maintenance[] => {
    return items.map((item) => {
        const matchesSearch = item.equip_no?.toLowerCase().includes(term.toLowerCase())
        const filteredChildren = item.children ? filterByEquipment(item.children, term) : []

        if (matchesSearch || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren,
          }
        }
        return null
      })
      .filter(Boolean) as Maintenance[]
  }

  const filterByStatus = (items: Maintenance[], status: string): Maintenance[] => {
    return items
      .map((item) => {
        const matchesScheduled = item.type === "TASK" && status === "SCHEDULED" && ["NORMAL", "WEEKLY", "MONTHLY"].includes(item.status ?? "")
        const matchesStatus = item.status === status
        const filteredChildren = item.children ? filterByStatus(item.children, status) : []

        if (matchesStatus || matchesScheduled || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren,
          }
        }
        return null
      })
      .filter(Boolean) as Maintenance[]
  }

  const filterBySearch = (items: Maintenance[], term: string): Maintenance[] => {
    return items.map((item) => {
        const matchesSearch = item.name.toLowerCase().includes(term.toLowerCase())
        const filteredChildren = item.children ? filterBySearch(item.children, term) : []

        if (matchesSearch || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren,
          }
        }
        return null
      })
      .filter(Boolean) as Maintenance[]
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELAYED":
        return <Badge variant="destructive">지연</Badge>
      case "EXTENSION":
        return <Badge variant="outline">연장</Badge>
      case "NORMAL":
        return <Badge variant="secondary">예정</Badge>
      case "WEEKLY":
        return <Badge variant="secondary">금주 예정</Badge>
      case "MONTHLY":
        return <Badge variant="secondary">금월 예정</Badge>
      case "COMPLETE":
        return <Badge variant="default">완료</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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

  const getCycleText = (cycle?: number, cycleUnit?: string) => {
    if (!cycle || !cycleUnit) return ""
    return `${cycle} ${cycleUnit} 마다`
  }
  
  // Function to handle history button click
  const handleHistoryClick = (vesselNo: string, taskId: string) => {
    const taskIds : string[] = taskId.split('-');

    setSelectedTaskId(taskId)
    fetchMaintenanceWork(vesselNo, taskIds[0], taskIds[1], taskIds[2])
  }

  // Function to handle history item selection
  const handleHistoryItemClick = (historyItem: any) => {
    setSelectedHistoryItem(historyItem)
    setIsDetailHistoryDialogOpen(true)
  }

  const renderMaintenanceTree = (items: Maintenance[], level = 0) => {
    return items.map((item) => (
      <div key={item.id} className={`${level > 0 ? "ml-6" : ""}`}>
        <Collapsible open={expandedItems.has(item.id)} onOpenChange={() => toggleExpanded(item.id)}>
          <div className="flex items-center gap-2 p-3 border rounded-lg mb-2 bg-white hover:bg-gray-50">
            {item.children && item.children.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto" style={{cursor: 'pointer'}}>
                  {expandedItems.has(item.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}

            <div className="flex-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  {item.type === 'VESSEL' ? (
                    <Ship className="w-5 h-5 shrink-0" />
                  ) : (
                    item.type === "EQUIPMENT" || item.type === "SECTION" ? (
                      <FolderTree className="w-5 h-5 text-blue-600 shrink-0" />
                    ) : (
                      <Wrench className="w-5 h-5 text-orange-600 shrink-0" />
                    )
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate min-w-0">{`${item.name}`}</span>
                      <span className="text-sm text-gray-500">({item.id})</span>
                      {item.critical && getCriticalBadge(item.critical)}
                      {item.type === "TASK" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleHistoryClick(item.vessel_no, item.id)
                          }}
                          className="hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-300 transition-all"
                          title="작업 이력 조회"
                          style={{cursor: 'pointer'}}
                        >
                          <Calendar className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {item.type === "TASK" && (
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {item.interval && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getCycleText(item.interval, item.interval_term)}
                          </span>
                        )}
                        {item.manager && <span>담당: {item.manager}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.type === "TASK" && item.lastest_date && (
                  <span className="text-sm text-gray-500">최근 정비: {item.lastest_date}</span>
                )}
                {item.type === "TASK" && item.due_date && (
                  <span className="text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-500">예정일: {item.due_date}</span>
                    </div>
                  </span>
                )}
                {item.status && getStatusBadge(item.status)}
              </div>
            </div>
          </div>

          {item.children && item.children.length > 0 && (
            <CollapsibleContent>
              <div className="ml-4 border-l-2 border-gray-200 pl-4">
                {renderMaintenanceTree(item.children, level + 1)}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    ))
  }

  const totalTasks = (items: Maintenance[]): number => {
    return items.reduce((count, item) => {
      if (item.type === "TASK") count++
      if (item.children) count += totalTasks(item.children)
      return count
    }, 0)
  }

  const getTasksByStatus = (items: Maintenance[], status: string): number => {
    return items.reduce((count, item) => {
      if (item.type === "TASK" && item.status === status) count++
      if (item.children) count += getTasksByStatus(item.children, status)
      return count
    }, 0)
  }

  const handlePMSDownload = () => {
    fetchDownload();
  }

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(downloadData);
    const workbook = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(workbook, worksheet, "PMS");
    worksheet["!cols"] = [{ wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];

    XLSX.writeFile(workbook, "export_pms_data.xlsx");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">정비 현황</h1>
                <p className="text-gray-600">전체 선박의 정비 현황을 관리하세요</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handlePMSDownload()} style={{cursor: 'pointer'}}>
                  <Download className="w-4 h-4 mr-2" />
                  PMS 다운로드
                </Button>
                <Button variant="outline" onClick={() => (window.location.href = "/admin/calendar")} style={{cursor: 'pointer'}}>
                  <Calendar className="w-4 h-4 mr-2" />
                  작업 캘린더
                </Button>
              </div>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate min-w-0">총 작업 수</CardTitle>
                <Wrench className="h-4 w-4 text-blue-600 shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums truncate">{totalTasks(maintenanceData)}</div>
                <p className="text-xs text-muted-foreground">등록된 작업</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate min-w-0">지연된 작업</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 tabular-nums truncate">{getTasksByStatus(maintenanceData, "DELAYED")}</div>
                <p className="text-xs text-muted-foreground">즉시 조치 필요</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate min-w-0">예정된 작업</CardTitle>
                <Calendar className="h-4 w-4 text-orange-600 shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 tabular-nums truncate">{getTasksByStatus(maintenanceData, "NORMAL") + getTasksByStatus(maintenanceData, "WEEKLY") + getTasksByStatus(maintenanceData, "MONTHLY")}</div>
                <p className="text-xs text-muted-foreground">예정된 작업</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate min-w-0">완료된 작업</CardTitle>
                <Settings className="h-4 w-4 text-green-600 shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 tabular-nums truncate">{getTasksByStatus(maintenanceData, "COMPLETE")}</div>
                <p className="text-xs text-muted-foreground">완료된 작업</p>
              </CardContent>
            </Card>
          </div>

          {/* 필터 및 검색 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">필터 및 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row flex-wrap gap-4">
                <Select value={shipFilter} onValueChange={setShipFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 선박</SelectItem>
                    {vessels.map((vessel) => (
                      <SelectItem key={vessel.vessel_no} value={vessel.vessel_no}>{vessel.vessel_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={machineFilter} onValueChange={setMachineFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 기계</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.machine_name} value={machine.machine_name}>{machine.machine_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 장비</SelectItem>
                    {equipmentFilteredData.map((equipment) => (
                      <SelectItem key={equipment.equip_no} value={equipment.equip_no}>{equipment.equip_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 상태</SelectItem>
                    <SelectItem value="WEEKLY">금주 예정</SelectItem>
                    <SelectItem value="MONTHLY">금월 예정</SelectItem>
                    <SelectItem value="SCHEDULED">예정</SelectItem>
                    <SelectItem value="DELAYED">지연</SelectItem>
                    <SelectItem value="EXTENSION">연장</SelectItem>
                    <SelectItem value="COMPLETE">완료</SelectItem>
                  </SelectContent>
                </Select>
                <div className="min-w-0 flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="작업명, 작업코드로 검색..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' ? setSearchTerm(searchFilter) : ""}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WBS 트리 구조 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                유지보수 작업 WBS
              </CardTitle>
              <CardDescription>계층적 구조로 관리되는 유지보수 작업 목록</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">{renderMaintenanceTree(filteredData)}</div>

              {filteredData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FolderTree className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>조건에 맞는 작업이 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work History Dialog */}
          <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  작업 실적 이력 조회
                </DialogTitle>
                <DialogDescription>해당 작업의 정비 일정을 확인하고 상세 이력을 조회하세요</DialogDescription>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                {(() => {
                  const historyData = selectedHistoryItems
                  if (!historyData || historyData.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>작업 이력이 없습니다.</p>
                        <p className="text-xs mt-2">Task ID: {selectedTaskId}</p>
                      </div>
                    )
                  }

                  return historyData.map((history) => (
                    <div
                      key={history.work_order}
                      className="p-4 border rounded-lg mb-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleHistoryItemClick(history)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{history.work_date}</span>
                          <Badge variant="default">완료</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <User className="w-3 h-3" />
                          {history.manager}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{history.work_details}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>작업시간: {history.work_hours} 시간</span>
                        {history.used_parts && history.used_parts.length > 0 && (
                          <span>부품: {history.used_parts[0].material_name} {history.used_parts.length > 1 ? `외 ${history.used_parts.length - 1}건` : '' }</span>
                        )}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </DialogContent>
          </Dialog>

          {/* Detailed History Dialog */}
          <Dialog open={isDetailHistoryDialogOpen} onOpenChange={setIsDetailHistoryDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  정비 실적 상세 이력
                </DialogTitle>
                <DialogDescription>선택한 정비 작업의 상세 실적을 확인하세요</DialogDescription>
              </DialogHeader>
              {selectedHistoryItem && (
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">작업 정보</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="equip_no">작업일자</Label>
                          <span className="text-sm font-medium text-gray-500">{selectedHistoryItem.work_date}</span>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="equip_no">담당자</Label>
                          <span className="text-sm font-medium text-gray-500">{selectedHistoryItem.manager}</span>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="equip_no">작업시간</Label>
                          <span className="text-sm font-medium text-gray-500">{selectedHistoryItem.work_hours}시간</span>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="equip_no">상태</Label>
                          <Badge variant="default">완료</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 작업 설명 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">작업 설명</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">{selectedHistoryItem.work_details}</p>
                    </CardContent>
                  </Card>

                  {/* 사용 부품 */}
                  {selectedHistoryItem.used_parts && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">사용 부품</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-500">{selectedHistoryItem.used_parts}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailHistoryDialogOpen(false)} style={{cursor: 'pointer'}}>
                  닫기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
