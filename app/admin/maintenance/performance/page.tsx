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
  DialogFooter,
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
  Ship,
  FolderTree,
  History,
  FileText,
} from "lucide-react"
import { Vessel } from '@/types/vessel/vessel'; 
import { Machine } from '@/types/vessel/machine';
import { Equipment } from '@/types/vessel/equipment';
import { Section } from '@/types/vessel/section';
import { Maintenance } from '@/types/performance/maintenance';
import { MaintenanceWork } from '@/types/vessel/maintenance_work'; // ✅ interface import

export default function MaintenanceWorkManagementPage() {
  var initMaintenanceWork : MaintenanceWork  = {
    work_order: 0,
    work_date: "",
    vessel_no: "",
    equip_no: "",
    section_code: "",
    plan_code: "",
    plan_date: "",
    manager: "",
    work_details: "",
    work_hours: 0,
    delay_reason: "",
    due_date: "",
    extension_date: "",
    used_parts: [],
    used_partnames: "",
    regist_date: "",
    regist_user: "",
    modify_date: "",
    modify_user: ""
  }

  const [userInfo, setUserInfo] = useState<any>(null)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [equipmentFilteredData, setEquipmentFilteredData] = useState<Equipment[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sectionFilteredData, setSectionFilteredData] = useState<Section[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [shipFilter, setShipFilter] = useState("ALL")
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [equipmentFilter, setEquipmentFilter] = useState("ALL")
  const [sectionFilter, setSectionFilter] = useState("ALL")
  
  const [maintenanceData, setMaintenanceData] = useState<Maintenance[]>([])
  const [maintenanceItem, setMaintenanceItem] = useState<Maintenance[]>([])
  const [filteredData, setFilteredData] = useState<Maintenance[]>(maintenanceData)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isDetailHistoryDialogOpen, setIsDetailHistoryDialogOpen] = useState(false)
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<MaintenanceWork[]>([])
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<MaintenanceWork>(initMaintenanceWork)
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")
  
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const fetchVessels = () => {
    fetch(`/api/admin/maintenance/performance/ships`)
      .then(res => res.json())
      .then(data => setVessels(data))
      .catch(err => console.error(err));
  };

  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/admin/ships/${vesselNo}/maintenance/performance/machine?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  };

  const fetchEquipments = (vesselNo: string) => {
    fetch(`/api/admin/ships/${vesselNo}/maintenance/performance/equipment?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  };

  const fetchSections = (vesselNo: string) => {
    fetch(`/api/admin/ships/${vesselNo}/maintenance/performance/section?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setSections(data))
      .catch(err => console.error(err));
  };

  const fetchPerformance = () => {
    fetch(`/api/admin/maintenance/performance`)
      .then(res => res.json())
      .then(data => setMaintenanceData(data))
      .catch(err => console.error(err));
  };

  const fetchPerformanceItem = (vesselNo: string, equipNo: string, sectionCode: string, planCode: string) => {
    fetch(`/api/admin/maintenance/performance/item?vesselNo=${vesselNo}&equipNo=${equipNo}&sectionCode=${sectionCode}&planCode=${planCode}`)
      .then(res => res.json())
      .then(data => setMaintenanceItem(data))
      .catch(err => console.error(err));
  };
  
  const fetchMaintenanceWorks = (vesselNo: string, equipNo: string, sectionCode: string, planCode: string) => {
    fetch(`/api/admin/maintenance/work?vesselNo=${vesselNo}&equipNo=${equipNo}&sectionCode=${sectionCode}&planCode=${planCode}`)
      .then(res => res.json())
      .then(data => {
        setSelectedHistoryItems(data)
        setIsHistoryDialogOpen(true)
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchVessels();
      fetchPerformance();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    fetchMachines(shipFilter);
    fetchEquipments(shipFilter);
    fetchSections(shipFilter);
  }, [shipFilter])
  
  useEffect(() => {
    let equipmentFiltered = equipments
    let sectionFiltered = sections

    if (machineFilter !== "ALL") {
      equipmentFiltered = equipmentFiltered.filter((item) => item.vessel_no === shipFilter && item.machine_name === machineFilter)
      sectionFiltered = sectionFiltered.filter((item) => item.vessel_no === shipFilter && item.machine_name === machineFilter)
    }

    setEquipmentFilteredData(equipmentFiltered)
    setSectionFilteredData(sectionFiltered)
  }, [equipments, shipFilter, machineFilter])
  
  useEffect(() => {
    let sectionFiltered = sections

    if (machineFilter !== "ALL") {
      sectionFiltered = sectionFiltered.filter((item) => item.vessel_no === shipFilter && item.machine_name === machineFilter&& item.equip_no === equipmentFilter)
    }

    setSectionFilteredData(sectionFiltered)
  }, [sections, shipFilter, equipmentFilter, machineFilter])

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

    if (sectionFilter !== "ALL") {
      filtered = filterBySection(filtered, sectionFilter)
    }

    if (searchTerm) {
      filtered = filterBySearch(filtered, searchTerm)
    }

    setFilteredData(filtered)
  }, [maintenanceData, searchTerm, shipFilter, machineFilter, equipmentFilter, sectionFilter])
  

  useEffect(() => {
    let filtered = maintenanceData

    if (maintenanceItem.length > 0) {
      filtered = updateMaintenanceData(filtered, maintenanceItem)
    }

    setFilteredData(filtered)
  }, [maintenanceItem])

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

  const filterBySection = (items: Maintenance[], term: string): Maintenance[] => {
    return items.map((item) => {
        const matchesSearch = `${item.equip_no}-${item.section_code}`?.toLowerCase().includes(term.toLowerCase())
        const filteredChildren = item.children ? filterBySection(item.children, term) : []

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
  
  const filterBySearch = (items: Maintenance[], term: string): Maintenance[] => {
    return items.map((item) => {
        const matchesSearch = item.plan_code?.toLowerCase().includes(term.toLowerCase()) || item.plan_name?.toLowerCase().includes(term.toLowerCase())
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
  
  const updateMaintenanceData = (items: Maintenance[], changeItems: Maintenance[]) : Maintenance[] => {
    return items.map((item) => {
      if (item.type === "TASK") {
        if (changeItems[0].vessel_no === item.vessel_no && changeItems[0].equip_no === item.equip_no && changeItems[0].section_code === item.section_code && changeItems[0].plan_code === item.plan_code) {
          return {...item, lastest_date: changeItems[0].lastest_date, due_date: changeItems[0].due_date, children: changeItems}
        }

        return item;
      } else {
        const children = updateMaintenanceData(item.children, changeItems);

        return {
          ...item,
          children: children,
        }
      }
    });
  }
  
  const getTableHeaders = () => {
    const headers = []
    headers.push(
      { key: "code", label: "No", align: "text-center" },
      { key: "section", label: "Section", align: "text-center" },
      { key: "maintenance", label: "Maintenance", align: "text-center" },
      { key: "interval", label: "Interval", align: "text-center" },
      { key: "last_date", label: "Last Date", align: "text-center" },
      { key: "due_date", label: "Due Date", align: "text-center" }
    )

    for(let i = 0; i < 5; i++) {
      headers.push({ key: `work_date_${i}`, label: "Work Date", align: "text-center" })
    }
    return headers
  }

  const getTableCells = (item: any, index: number) => {
    const cells = []

    cells.push(
      <td key="code" width="120px;" className="py-3 text-gray-500 text-center">
        {`${item.equip_no}-${item.section_code}-${item.plan_code}`}
      </td>,
      <td key="section" width="320px;" className="py-3 text-gray-500">
        {item.section_name}
      </td>,
      <td key="maintenance" className="py-3 text-gray-500">
        {item.plan_name}
      </td>,
      <td key="interval" width="100px;" className="py-3 text-center text-gray-500">
        {`${item.interval} ${item.interval_term}`}
      </td>,
      <td key="lastest_date" width="120px;" className="py-3 text-center text-gray-500">
        {item.lastest_date}
      </td>,
      <td key="due_date" width="120px;" className="py-3 text-center text-gray-500">
        {item.due_date}
      </td>
    )

    let count = 0;
    {item.children.map((work : Maintenance) => {
      count = count + 1
      
      return (
        cells.push(
          <td key={`work_date_${count}`} width="120px;" className="py-3 text-center text-gray-500">
            {work.work_date}
          </td>
        )
      )
    })}

    for (let i = count + 1; i <= 5; i++) {
      cells.push(
        <td key={`work_date_${i}`} width="120px;" className="py-3 text-center text-gray-500"></td>
      )
    }

    return cells
  }
  
  // Function to handle history button click
  const handleHistoryClick = (task: any) => {
    setSelectedTaskId(`${task.equip_no}-${task.section_code}-${task.plan_code}`)
    fetchMaintenanceWorks(task.vessel_no, task.equip_no, task.section_code, task.plan_code)
  }

  // Function to handle history item selection
  const handleHistoryItemClick = (historyItem: any) => {
    setSelectedHistoryItem(historyItem)
    setIsDetailHistoryDialogOpen(true)
  }

  const renderMaintenanceTree = (items: Maintenance[], level = 0) => {
    return items.map((item) => (
      <div key={item.key} className={`${level > 0 ? "ml-2 md:ml-6" : ""} min-w-0`}>
        <Collapsible open={expandedItems.has(item.key || '')} onOpenChange={() => toggleExpanded(item.key || '')}>
          <div className="flex items-center gap-2 p-3 border rounded-lg mb-2 bg-white hover:bg-gray-50">
            {item.children && item.children.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto" style={{cursor: 'pointer'}}>
                  {expandedItems.has(item.key || '') ? (
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
                    item.type === "EQUIPMENT" ? (
                      <FolderTree className="w-5 h-5 text-blue-600 shrink-0" />
                    ) : (
                      <Wrench className="w-5 h-5 text-orange-600 shrink-0" />
                    )
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate min-w-0">{`${item.name}`}</span>
                      <span className="text-sm text-gray-500">({item.id})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {item.children && item.children.length > 0 && item.type !== "EQUIPMENT" && (
            <CollapsibleContent>
              <div className="ml-2 pl-2 md:ml-4 md:pl-4 border-l-2 border-gray-200 min-w-0">
                {renderMaintenanceTree(item.children, level + 1)}
              </div>
            </CollapsibleContent>
          )}
          

          {item.children && item.children.length > 0 && item.type === "EQUIPMENT" && (
            <CollapsibleContent>
              <div className="ml-2 pl-2 md:ml-4 md:pl-4 border-l-2 border-gray-200 min-w-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {getTableHeaders().map((header) => (
                          <th key={header.key} className={`${header.align} py-2`}>
                            {header.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {item.children.map((child, index) => (
                        <tr 
                          key={`${child.vessel_no}-${child.equip_no}-${child.section_code}-${child.plan_code}`} 
                          className="border-b hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleHistoryClick(child)
                          }}
                        >
                          {getTableCells(child, index)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    ))
  }
  
  
  const updateSelectedHistoryItems = (item: any) : MaintenanceWork[] => {
    return selectedHistoryItems.map((history) => {
      if (history.vessel_no === item.vessel_no && history.work_order === item.work_order) {
        
        return {...history, work_date: item.work_date }
      } 

      return history;
    });
  }

  const handleUpdateExecution = async () => {
    const updatededData = {
      ...selectedHistoryItem,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch(`/api/admin/ships/${updatededData.vessel_no}/maintenance/execution/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatededData),
    });
    
    if (!res.ok)
    {
      alert('작업 실행 수정 중 오류가 발생하였습니다.');
      return;
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert("저장이 완료되었습니다.");

      setSelectedHistoryItems(updateSelectedHistoryItems(selectedHistoryItem));

      fetchPerformanceItem(selectedHistoryItem.vessel_no, selectedHistoryItem.equip_no, selectedHistoryItem.section_code, selectedHistoryItem.plan_code);
      setIsDetailHistoryDialogOpen(false)
    } else {
      alert(data.message);
    }
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
  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 min-w-0 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">정비 실적 현황</h1>
                <p className="text-gray-600">전체 선박의 정비 실적 현황을 조회하세요</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => (window.location.href = "/admin/calendar")} style={{cursor: 'pointer'}}>
                  <Calendar className="w-4 h-4 mr-2" />
                  작업 캘린더
                </Button>
              </div>
            </div>
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
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 섹션</SelectItem>
                    {sectionFilteredData.map((section) => (
                      <SelectItem key={`${section.equip_no}-${section.section_code}`} value={`${section.equip_no}-${section.section_code}`}>{`(${section.equip_no}-${section.section_code}) ${section.section_name}`}</SelectItem>
                    ))}
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
                정비 실적 WBS
              </CardTitle>
              <CardDescription>계층적 구조로 관리되는 장비 실적 목록</CardDescription>
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
                          <span>부품: {history.used_parts[0].material_name} {history.used_parts.length > 1 ? `외 ${history.used_parts.length - 1} 건` : '' }</span>
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
                          <Input
                            type="date"
                            placeholder="시간"
                            value={selectedHistoryItem.work_date}
                            onChange={(e) => setSelectedHistoryItem((prev) => ({ ...prev, work_date: e.target.value }))}
                            className="text-sm"
                          />
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
                        <p className="text-sm text-gray-500">
                          {selectedHistoryItem.used_partnames && (
                            <span>부품: {selectedHistoryItem.used_partnames}</span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* 지연 사유 */}
                  {selectedHistoryItem.delay_reason && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">지연 사유</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">{selectedHistoryItem.delay_reason}</p>
                    </CardContent>
                  </Card>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailHistoryDialogOpen(false)} style={{cursor: 'pointer'}}>
                  닫기
                </Button>
                <Button 
                  onClick={handleUpdateExecution} 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!selectedHistoryItem.work_date}
                  style={{cursor: 'pointer'}}
                >
                  수정
                </Button>
              </DialogFooter>
            </DialogContent>
            
          </Dialog>
        </main>
      </div>
    </div>
  )
}
