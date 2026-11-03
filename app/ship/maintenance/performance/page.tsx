"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Machine } from '@/types/vessel/machine';
import { Equipment } from '@/types/vessel/equipment';
import { Section } from '@/types/vessel/section';
import { Maintenance } from '@/types/performance/maintenance';
import { MaintenanceWork } from '@/types/vessel/maintenance_work'; // ✅ interface import

export default function MaintenanceWorkManagementPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [equipmentFilteredData, setEquipmentFilteredData] = useState<Equipment[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sectionFilteredData, setSectionFilteredData] = useState<Section[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [equipmentFilter, setEquipmentFilter] = useState("ALL")
  const [sectionFilter, setSectionFilter] = useState("ALL")
  
  const [maintenanceData, setMaintenanceData] = useState<Maintenance[]>([])
  const [filteredData, setFilteredData] = useState<Maintenance[]>(maintenanceData)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<MaintenanceWork[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/ship/maintenance/performance/machine?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  };

  const fetchEquipments = (vesselNo: string) => {
    fetch(`/api/ship/maintenance/performance/equipment?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  };

  const fetchSections = (vesselNo: string) => {
    fetch(`/api/ship/maintenance/performance/section?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setSections(data))
      .catch(err => console.error(err));
  };

  const fetchPerformance = (vesselNo: string) => {
    fetch(`/api/ship/maintenance/performance?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMaintenanceData(data))
      .catch(err => console.error(err));
  };
  
  const fetchMaintenanceWorks = (vesselNo: string, equipNo: string, sectionCode: string, planCode: string) => {
    fetch(`/api/ship/maintenance/work?vesselNo=${vesselNo}&equipNo=${equipNo}&sectionCode=${sectionCode}&planCode=${planCode}`)
      .then(res => res.json())
      .then(data => {
        setSelectedHistoryItems(data)
        setIsHistoryDialogOpen(true)
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = vesselRequireAuth();
      setUserInfo(user);

      fetchMachines(user.ship_no);
      fetchEquipments(user.ship_no);
      fetchSections(user.ship_no);
      fetchPerformance(user.ship_no);
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let equipmentFiltered = equipments
    let sectionFiltered = sections

    if (machineFilter !== "ALL") {
      equipmentFiltered = equipmentFiltered.filter((item) => item.machine_name === machineFilter)
      sectionFiltered = sectionFiltered.filter((item) => item.machine_name === machineFilter)
    }
    
    if (equipmentFilter !== "ALL") {
      sectionFiltered = sectionFiltered.filter((item) => item.equip_no === equipmentFilter)
    }

    setEquipmentFilteredData(equipmentFiltered)
    setSectionFilteredData(sectionFiltered)
  }, [equipments,  machineFilter, equipmentFilter])

  useEffect(() => {
    let filtered = maintenanceData

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
  }, [maintenanceData, searchTerm, machineFilter, equipmentFilter, sectionFilter])

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

  const truncateString = (str: string, maxLength: number): string  =>{
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '...';
    }
    return str;
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
    {item.children.map((work: Maintenance) => {
      count = count + 1
      
      return (
        cells.push(
          <td key={`work_date_${count}`} width="120px;" className="py-3 text-center">
            {work.work_date}
          </td>
        )
      )
    })}

    for (let i = count + 1; i <= 5; i++) {
      cells.push(
        <td key={`work_date_${i}`} width="120px;" className="py-3 text-center"></td>
      )
    }

    return cells
  }
  
  // Function to handle history button click
  const handleHistoryClick = (task: any) => {
    setSelectedTaskId(`${task.equip_no}-${task.section_code}-${task.plan_code}`)
    fetchMaintenanceWorks(task.vessel_no, task.equip_no, task.section_code, task.plan_code)
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
                <h1 className="text-2xl font-bold text-gray-900">{userInfo.ship_name} - 정비 실적 현황</h1>
                <p className="text-gray-600">{userInfo.ship_no} 선박의 정비 실적 현황을 조회하세요</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => (window.location.href = "/ship/calendar")} style={{cursor: 'pointer'}}>
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
                <div className="flex-1">
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
            <DialogContent className="sm:max-w-[820px] max-h-[620px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  작업 실적 이력 조회
                </DialogTitle>
                <DialogDescription>해당 작업의 정비 이력을 확인하세요</DialogDescription>
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
                      className="p-4 border rounded-lg mb-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 min-w-[130px]">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{history.work_date}</span>&nbsp;
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span>정비내용: {history.work_details}</span>
                          </div>
                          {history.delay_reason && (
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>지연사유: {history.delay_reason} 시간</span>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>작업시간: {history.work_hours} 시간</span>
                            {history.used_partnames && (
                              <span>부품: {history.used_partnames}</span>
                            )}
                            {history.manager && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {history.manager}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
