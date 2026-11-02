"use client"

import { useEffect, useState } from "react"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ColorBadge } from "@/components/ui/colorbadge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  ChevronDown,
  ChevronRight,
  Wrench,
  Calendar,
  Ship,
  FolderTree,
  FileText,
  
} from "lucide-react"
import { Vessel } from '@/types/vessel/vessel'; // ✅ interface import
import { Machine } from '@/types/vessel/machine';
import { Equipment } from '@/types/vessel/equipment';
import { MaintenanceExtension } from '@/types/extension/maintenance_extension'; // ✅ interface import

export default function MaintenanceWorkManagementPage() {  
  const [userInfo, setUserInfo] = useState<any>(null)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [equipmentFilteredData, setEquipmentFilteredData] = useState<Equipment[]>([])
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceExtension[]>([])
  const [filteredData, setFilteredData] = useState<MaintenanceExtension[]>(maintenanceData)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [shipFilter, setShipFilter] = useState("ALL")
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [equipmentFilter, setEquipmentFilter] = useState("ALL")
  const [selectedExtension, setSelectedExtension] = useState<MaintenanceExtension>()
  const [isApprovalReasonDialogOpen, setIsApprovalReasonDialogOpen] = useState(false)
  const [isDetailSelectedDialogOpen, setIsDetailSelectedDialogOpen] = useState(false)
  const [selectedExtensionItem, setSelectedExtensionItem] = useState<MaintenanceExtension>()

  const [selectedApprovals, setSelectedApprovals] = useState<string[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const fetchVessels = () => {
    fetch(`/api/admin/maintenance/extension/ships`)
      .then(res => res.json())
      .then(data => setVessels(data))
      .catch(err => console.error(err));
  };

  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/admin/ships/${vesselNo}/maintenance/extension/machine?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  };

  const fetchEquipments = (vesselNo: string) => {
    fetch(`/api/admin/ships/${vesselNo}/maintenance/extension/equipment?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  };

  const fetchExtension = () => {
    fetch(`/api/admin/maintenance/extension`)
      .then(res => res.json())
      .then(data => setMaintenanceData(data))
      .catch(err => console.error(err));
  };
  
  const getStatusBadge = (status: any) => {
    switch (status) {
      case "REQUEST":
        return <ColorBadge variant="yellow">승인 대기</ColorBadge>
      case "APPROVAL":
        return <ColorBadge variant="green">승인</ColorBadge>
      case "REJECT":
        return <ColorBadge variant="red">반려</ColorBadge>
      default:
        return <ColorBadge variant="default">{status}</ColorBadge>
    }
  }
  const getStatusString = (status: any) => {
    switch (status) {
      case "APPROVAL":
        return '승인'
      case "REJECT":
        return '반려'
      default:
        return ''
    }
  }

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchVessels();
      fetchExtension();
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

    if (searchTerm) {
      filtered = filterBySearch(filtered, searchTerm)
    }

    setFilteredData(filtered)
  }, [maintenanceData, searchTerm, shipFilter, machineFilter, equipmentFilter])

  if (!userInfo) return null
  
  const filterByMachine = (items: MaintenanceExtension[], term: string): MaintenanceExtension[] => {
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
      .filter(Boolean) as MaintenanceExtension[]
  }

  const filterByEquipment = (items: MaintenanceExtension[], term: string): MaintenanceExtension[] => {
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
      .filter(Boolean) as MaintenanceExtension[]
  }
  
  const filterBySearch = (items: MaintenanceExtension[], term: string): MaintenanceExtension[] => {
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
      .filter(Boolean) as MaintenanceExtension[]
  }
  
  const getTableHeaders = () => {
    const headers = []
    headers.push(
      // { key: "select", label: " ", align: "text-center" },
      { key: "code", label: "No", align: "text-center" },
      { key: "section", label: "Section", align: "text-center" },
      { key: "maintenance", label: "Maintenance", align: "text-center" },
      { key: "request_date", label: "Request Date", align: "text-center" },
      { key: "applicant", label: "Applicant", align: "text-center" },
      { key: "due_date", label: "Due Date", align: "text-center" },
      { key: "extension_date", label: "Extension Date", align: "text-center" },
      { key: "extension_reason", label: "Extension Reason", align: "text-center" },
      { key: "approval_date", label: "Approval Date", align: "text-center" },
      { key: "approver", label: "Approver", align: "text-center" },
      { key: "approval_status", label: "Status", align: "text-center" },
      { key: "approval", label: "", align: "text-center" },
    )

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
      <td key="request_date" width="120px;" className="py-3 text-center text-gray-500">
        {item.request_date}
      </td>,
      <td key="applicant" width="120px;" className="py-3 text-center text-gray-500">
        {item.applicant_name}
      </td>,
      <td key="due_date" width="120px;" className="py-3 text-center text-gray-500">
        {item.due_date}
      </td>,
      <td key="extension_date" width="120px;" className="py-3 text-center text-gray-500">
        {item.extension_date}
      </td>,
      <td key="extension_reason" width="320px;"  className="py-3 text-gray-500">
        {item.extension_reason}
      </td>,
      <td key="approval_date" width="120px;" className="py-3 text-center text-gray-500">
        {item.approval_date}
      </td>,
      <td key="approver" width="120px;" className="py-3 text-center text-gray-500">
        {item.approver_name}
      </td>,
      <td key="approval_status" width="120px;" className="py-3 text-center text-gray-500">
        {item.approval_status}
      </td>,
      <td key="approval" className="py-3 text-center text-gray-500">
        {item.approval_status === 'REQUEST' && (
          <div>
            <Button onClick={() => handleApprovalOrRejectClick(item, "APPROVAL")} size="sm" className="ml-4" style={{cursor: 'pointer'}}>
              승인
            </Button>
            <Button onClick={() => handleApprovalOrRejectClick(item, "REJECT")} size="sm" className="ml-4" style={{cursor: 'pointer'}}>
              반려
            </Button>
          </div>
        )}
      </td>,
    )

    return cells
  }

  const handleTaskSelection = (taskId: string, task: any) => {
    setSelectedApprovals((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId)
      } else {
        return [...prev, taskId]
      }
    })
  }

  const handleExtentionSelection = (extension : MaintenanceExtension) =>{
    setSelectedExtensionItem(extension)
    setIsDetailSelectedDialogOpen(true);
  }


  const handleSelectAll = (eq: MaintenanceExtension) => {
    const allTaskIds = eq.children.filter((task) => task.approval_status !== "COMPLATE").map((task) => `${task.vessel_no}-${task.equip_no}-${task.section_code}-${task.plan_code}`)

    if (selectedApprovals.length === allTaskIds.length) {
      setSelectedApprovals([])
    } else {
      setSelectedApprovals(allTaskIds)
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

  const renderMaintenanceTree = (items: MaintenanceExtension[], level = 0) => {
    return items.map((item) => (
      <div key={item.key} className={`${level > 0 ? "ml-6" : ""}`}>
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

            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {item.type === 'VESSEL' ? (
                    <Ship className="w-5 h-5" />
                  ) : (
                    item.type === "EQUIPMENT" ? (
                      <FolderTree className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Wrench className="w-5 h-5 text-orange-600" />
                    )
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{`${item.name}`}</span>
                      <span className="text-sm text-gray-500">({item.id})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {item.children && item.children.length > 0 && item.type !== "EQUIPMENT" && (
            <CollapsibleContent>
              <div className="ml-4 border-l-2 border-gray-200 pl-4">
                {renderMaintenanceTree(item.children, level + 1)}
              </div>
            </CollapsibleContent>
          )}
          

          {item.children && item.children.length > 0 && item.type === "EQUIPMENT" && (
            <CollapsibleContent>
              <div className="ml-4 border-l-2 border-gray-200 pl-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {getTableHeaders().map((header) => {
                          if (header.label === "CheckBox") {
                            return (
                              <th key={header.key} className={`${header.align} py-2`}>
                                <Checkbox
                                  id="select-all"
                                  checked={
                                    selectedApprovals.length > 0 &&
                                    selectedApprovals.length === item.children.filter((task) => task.approval_status !== "APPROVAL").length
                                  }
                                  onCheckedChange={(e) => {
                                    {handleSelectAll(item)}
                                  }}
                                />
                              </th>
                            )
                          } else {
                            return (
                              <th key={header.key} className={`${header.align} py-2`}>
                                {header.label}
                              </th>
                            )
                          }
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {item.children.map((children, index) => (
                        <tr 
                          key={`${children.vessel_no}-${children.equip_no}-${children.section_code}-${children.plan_code}`} 
                          className="border-b hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExtentionSelection(children);
                          }}
                        >
                          {getTableCells(children, index)}
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

  const handleApprovalOrRejectClick = (item: MaintenanceExtension, status: string) => {
    const updatedData = {
      ...item,
      approver: userInfo.account_no,
      approval_status: status,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    setSelectedExtension(updatedData);
    setIsApprovalReasonDialogOpen(true);
  }

  const handleApprovalExtension = async () => {
    const res = await fetch('/api/admin/maintenance/extension/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedExtension),
    });

    if (res.ok) {
      if (selectedExtension?.approval_status === 'APPROVAL')
        alert(`연장 요청이 승인 되었습니다.`);
      else
        alert(`연장 요청이 반려 되었습니다.`);
    }

    fetchExtension();

    setIsApprovalReasonDialogOpen(false);
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
                <h1 className="text-2xl font-bold text-gray-900">정비 연장 신청 현황</h1>
                <p className="text-gray-600">전체 선박의 정비에 대한 연장 신청 현황을 조회하세요</p>
              </div>
              <div className="flex gap-2">
                {/* {selectedApprovals.length > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{selectedApprovals.length}개 작업 선택됨</span>
                    <Button onClick={handleBulkExtension} className="bg-blue-600 hover:bg-blue-700" style={{cursor: 'pointer'}}>
                      <Plus className="w-4 h-4 mr-2" />
                      일괄 실행 등록
                    </Button>
                  </div>
                )} */}
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
                <div className="min-w-0 flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="섹션, 작업명으로 검색..."
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
                장비 연장 신청 WBS
              </CardTitle>
              <CardDescription>계층적 구조로 관리되는 장비 연장 신청 목록</CardDescription>
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

          {/* Detailed History Dialog */}
          <Dialog open={isApprovalReasonDialogOpen} onOpenChange={setIsApprovalReasonDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  정비 연장 신청 승인 및 반려 사유
                </DialogTitle>
                <DialogDescription>선택한 정비 연장 신청의 승인 및 반려 사유를 입력하세요</DialogDescription>
              </DialogHeader>
              {selectedExtension && (
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-1 gap-1">
                    <div className="space-y-2">
                      <Textarea 
                        id="approval_reason" 
                        placeholder="승인 및 반려 사유를 입력하세요" 
                        value={selectedExtension.approval_reason}
                        onChange={(e) => setSelectedExtension((prev: any) => ({ ...prev, approval_reason: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsApprovalReasonDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleApprovalExtension}
                  disabled={!selectedExtension?.vessel_no || 
                    !selectedExtension?.equip_no || 
                    !selectedExtension?.section_code || 
                    !selectedExtension?.plan_code ||
                    !selectedExtension?.extension_seq ||
                    !selectedExtension?.approval_reason}
                  style={{cursor: 'pointer'}}
                >확인</Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Detailed Select Dialog */}
          <Dialog open={isDetailSelectedDialogOpen} onOpenChange={setIsDetailSelectedDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  정비 연장 이력
                </DialogTitle>
                <DialogDescription>선택한 정비 연장 이력을 확인하세요</DialogDescription>
              </DialogHeader>
              {selectedExtensionItem && (
                <div className="space-y-6">
                  {/* 기본 정보 */}
                  <Card>
                    <CardHeader>                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-2" style={{gridTemplateColumns: "1fr 2fr"}}>
                          <CardTitle className="text-sm">신청 정보</CardTitle>
                          <span className="text-sm font-medium text-gray-500">{`(${selectedExtensionItem.equip_no}-${selectedExtensionItem.section_code}-${selectedExtensionItem.plan_code})`}</span>
                        </div>
                        {getStatusBadge(selectedExtensionItem.approval_status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="equip_no">Section</Label>
                          <span className="text-sm font-medium text-gray-500">{selectedExtensionItem.section_name}</span>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="equip_no">Maintenance</Label>
                          <span className="text-sm font-medium text-gray-500">{selectedExtensionItem.plan_name}</span>
                        </div>
                      </div>
                      <div>
                        <div className="grid grid-cols-2 gap-4 space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor="equip_no">신청일자</Label>
                            <span className="text-sm font-medium text-gray-500">{`${selectedExtensionItem.request_date}`}</span>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="equip_no">신청인</Label>
                            <span className="text-sm font-medium text-gray-500">{`${selectedExtensionItem.applicant_name}`}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="equip_no">신청사유</Label>
                          <span className="text-sm font-medium text-gray-500">{`${selectedExtensionItem.extension_reason}`}</span>
                        </div>
                      </div>
                      {selectedExtensionItem.approval_status !== 'REQUEST' &&
                      <span>
                        <div className="grid grid-cols-2 gap-4 space-y-2">
                          <div className="space-y-1">
                            <Label htmlFor="equip_no">결재일자</Label>
                            <span className="text-sm font-medium text-gray-500">{`${selectedExtensionItem.approval_date}`}</span>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="equip_no">결재인</Label>
                            <span className="text-sm font-medium text-gray-500">{`${selectedExtensionItem.approver_name}`}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="equip_no">{getStatusString(selectedExtensionItem.approval_status)}사유</Label>
                          <span className="text-sm font-medium text-gray-500">{`${selectedExtensionItem.approval_reason}`}</span>
                        </div>
                      </span>
                      }
                    </CardContent>
                  </Card>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
