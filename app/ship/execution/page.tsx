"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Settings, Wrench, Calendar, AlertTriangle, CheckCircle, Plus, PlusCircle } from "lucide-react"
import { Machine } from '@/types/common/machine'; // ✅ interface import
import { Equipment } from '@/types/common/equipment'; // ✅ interface import
import { Section } from '@/types/common/section'; // ✅ interface import
import { Inventory } from '@/types/vessel/inventory'; // ✅ interface import
import { UsedParts } from '@/types/vessel/used_parts'; // ✅ interface import
import { Maintenance } from '@/types/dashboard/maintenance';
import { MaintenanceExtension } from '@/types/vessel/maintenance_extension';
import EquipmentRuntimeInput from "@/components/layout/equipmentRuntime/equipmentRuntimeInput"

export default function MaintenanceExecutionPage() {
  
  const searchParams = useSearchParams()
  const equipNo = searchParams.get("equipNo") || ""

  useEffect(() => {
    const statusFromUrl = searchParams.get("status")
    if(statusFromUrl === null)
      setStatusFilter("ALL");
    else
      setStatusFilter(statusFromUrl)
  }, [searchParams])

  const initialMaintenanceItem: Maintenance = {
    vessel_no: "",
    vessel_name: "",
    equip_no: "",
    equip_name: "",
    machine_name: "",
    category: "",
    section_code: "",
    section_name: "",
    children: []
  };

  interface ComparisonData {
    name: string;
    tasks: Maintenance[]; // 여기에 가장 하위 자식 노드들의 원본 데이터가 있음
  }
  
  const initialMaintenanceExtension: MaintenanceExtension = {
    vessel_no: "",
    equip_no: "",
    section_code: "",
    plan_code: "",
    plan_name: "",
    manager: "",
    extension_seq: "",
    extension_date: "",
    extension_reason: "",
    request_date: "",
    due_date: "",
    next_due_date: "",
    due_run_hour: 0,
    next_due_run_hour: 0,
    applicant: "",
    approval_status: "",
    approval_date: "",
    approver: "",
    approval_reason: "",
    regist_date: "",
    regist_user: "",
    modify_date: "",
    modify_user: "",
  };

  const [userInfo, setUserInfo] = useState<any>(null)
  const [params, setParams] = useState<any>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [equipmentFilteredData, setEquipmentFilteredData] = useState<Equipment[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sectionFilteredData, setSectionFilteredData] = useState<Section[]>([])
  const [inventorys, setInventorys] = useState<Inventory[]>([])
  const [filteredInventorys, setFilteredInventorys] = useState(inventorys)
  const [selectedUsedWork, setSelectedUsedWork] = useState<any>(null)
  const [isSingle, setIsSingle] = useState<boolean>(false)

  const [works, setWorks] = useState<Maintenance[]>([]);
  const [filteredWorks, setFilteredWorks] = useState(works)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [equipmentFilter, setEquipmentFilter] = useState("ALL")
  const [sectionFilter, setSectionFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const [selectedWork, setSelectedWork] = useState<any>(null)
  const [isExecutionDialogOpen, setIsExecutionDialogOpen] = useState(false)
  const [executionResult, setExecutionResult] = useState<Maintenance>(initialMaintenanceItem)
  const [usedItems, setUsedItems] = useState<UsedParts[]>([])

  const [selectedWorks, setSelectedWorks] = useState<string[]>([])
  const [isBulkExecutionDialogOpen, setIsBulkExecutionDialogOpen] = useState(false)
  const [bulkExecutionData, setBulkExecutionData] = useState<ComparisonData>({
    name: "",
    tasks: [] as Maintenance[],
  })

  
  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false)

  const [selectedExtension, setSelectedExtension] = useState<any>(null)
  const [isExtensionDialogOpen, setIsExtensionDialogOpen] = useState(false)
  const [extensionResult, setExtensionResult] = useState<MaintenanceExtension>(initialMaintenanceExtension)
  const [delayReason, setDelayReason] = useState<string>('')

  const nowDate = new Date();
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())

  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/common/machine/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  }

  const fetchEquipments = (vesselNo: string) => {
    fetch(`/api/common/equipment/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  };

  const fetchSections = (vesselNo: string) => {
    fetch(`/api/common/section/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setSections(data))
      .catch(err => console.error(err));
  };
  
  const fetchEquipmentTasks = (vesselNo: string) => {
    fetch(`/api/ship/execution/all?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setWorks(data))
      .catch(err => console.error(err));
  }
  
  const fetchInventorys = (vesselNo: string, machineName: string) => {
    fetch(`/api/ship/execution/inventory?vesselNo=${vesselNo}&machineName=${machineName}`)
      .then(res => res.json())
      .then(data => {
        setInventorys(data)
      })
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)

      fetchMachines(user.ship_no)
      fetchEquipments(user.ship_no)
      fetchSections(user.ship_no)
      fetchEquipmentTasks(user.ship_no)
      
      if (equipNo) {
        setEquipmentFilter(equipNo)
      }
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
    
    if (equipmentFilter !== "ALL" || equipNo !== '') {
      sectionFiltered = sectionFiltered.filter((item) => item.equip_no === equipmentFilter)
    }

    setEquipmentFilteredData(equipmentFiltered)
    setSectionFilteredData(sectionFiltered)
  }, [equipments,  machineFilter, equipmentFilter, equipNo])

  useEffect(() => {
    let filtered = works
      
    if (params) {
      setParams('');
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

    if (statusFilter !== "ALL") {
      filtered = filterByStatus(filtered, statusFilter)
    }

    if (searchTerm) {
      filtered = filterBySearch(filtered, searchTerm);
    }

    setFilteredWorks(filtered)
  }, [works, searchTerm, machineFilter, equipmentFilter, sectionFilter, statusFilter])

  useEffect(() => {    
    if (selectedUsedWork) {
      if (filteredInventorys && filteredInventorys.length > 0) {
        if (filteredInventorys.filter(inventory => (inventory.vessel_no == selectedUsedWork.vessel_no && inventory.machine_name === selectedUsedWork.machine_name)).length < 0) {
          fetchInventorys(selectedUsedWork.vessel_no, selectedUsedWork.machine_name)
        }
      } else {
        fetchInventorys(selectedUsedWork.vessel_no, selectedUsedWork.machine_name)
      }
      
      if (usedItems && usedItems.length > 0 && filteredInventorys && filteredInventorys.length > 0) {
        let filtered = filteredInventorys
        const filterdUsedItems = usedItems.filter(used => (used.equip_no === selectedUsedWork.equip_no && used.section_code === selectedUsedWork.section_code && used.plan_code === selectedUsedWork.plan_code))
        if (filterdUsedItems && filterdUsedItems.length > 0) {
          filtered = filtered.map(inventory => {
            const usedItem = filterdUsedItems.filter(used => (used.machine_name === inventory.machine_name && used.material_code === inventory.material_code && used.warehouse_no === inventory.warehouse_no))
            if (usedItem && usedItem.length > 0) {
              return { ...inventory, use_qty: usedItem[0]?.use_qty }
            }

            return inventory
          })
        } else {
          filtered = filtered.map(inventory => {
            const usedItem = usedItems.filter(used => (used.machine_name === inventory.machine_name && used.material_code === inventory.material_code && used.warehouse_no === inventory.warehouse_no))
            if (usedItem && usedItem.length > 0) {
              return { ...inventory, stock_qty: inventory.stock_qty - usedItem[0]?.use_qty, use_qty: 0 }
            }
            return inventory
          })
        }

        setFilteredInventorys(filtered)
      }
    }
  }, [selectedUsedWork])

  useEffect(() => {
    const filtered = inventorys;

    setFilteredInventorys(filtered)
  }, [inventorys])

  useEffect(() => {
    if (!isBulkExecutionDialogOpen && !isExecutionDialogOpen) {
      setUsedItems([])
      setSelectedWork(null)
      setSelectedWorks([])
      setFilteredInventorys([])
    }
    
  }, [isBulkExecutionDialogOpen, isExecutionDialogOpen])

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
 
  const filterByStatus = (items: Maintenance[], status: string): Maintenance[] => {
  return items
    .map((item) => {
      const matchesScheduled = item.type === "TASK" && status === "SCHEDULED" && ["NORMAL", "WEEKLY", "MONTHLY"].includes(item.status?? "")
      const matchesStatus = item.type === "TASK" && item.status === status
      const filteredChildren = item.children
        ? filterByStatus(item.children, status)
        : []

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
        const matchesSearch = item.plan_name?.toLowerCase().includes(term.toLowerCase())
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

  const getRuntimeStr = (runtime: any) =>{
    return `${Math.floor(runtime / 60)} hr ${runtime % 60} min`;
  }

  const getStatusBadge = (status?: string) => {
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

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "DELAYED":
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case "EXTENSION":
        return <PlusCircle className="w-4 h-4 text-orange-600" />
      case "NORMAL":
        return <Calendar className="w-4 h-4 text-blue-600" />
      case "COMPLETE":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  const renderMaintenance = (items: Maintenance[]) => {
    return items.map((item) => (
      <div key={`${item.equip_no}-${item.section_code}`} className="border rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    id="select-all"
                    checked={
                      selectedWorks.length > 0 &&
                      selectedWorks.length === getSelectedCount(item.equip_no, item.section_code || '')
                    }
                    onCheckedChange={() => handleSelectAll(item.equip_no, item.section_code || '')}
                  />
                  <h4 className="font-semibold">{item.section_name}</h4>
                  <span className="text-sm text-gray-500">({item.section_code})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {renderMaintenancePlan(item.children)}
        </div>
      </div>
    ))
  }

  const renderMaintenancePlan = (items: Maintenance[]) => {
    return items.map((item) => (
      <div key={`${item.equip_no}-${item.section_code}-${item.plan_code}`} className="border rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              id={`${item.equip_no}-${item.section_code}-${item.plan_code}`}
              checked={selectedWorks.includes(`${item.equip_no}-${item.section_code}-${item.plan_code}`)}
              onCheckedChange={() => handleTaskSelection(`${item.equip_no}-${item.section_code}-${item.plan_code}`, item.equip_name, item)}
              disabled={item.status === "COMPLETE"}
              className="mt-1"
            />
            <div className="flex items-center gap-2">
              {getStatusIcon(item.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{item.plan_name}</h4>
                  <span className="text-sm text-gray-500">({item.plan_code})</span>
                  {item.critical && getCriticalBadge(item.critical)}
                  {getStatusBadge(item.status)}
                </div>
                <p className="text-sm text-gray-600 mb-2">{item.specifications}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>최근정비: {item.interval_term === 'HOURS'? `${item.lastest_date} (${getRuntimeStr(item.lastest_run_hour)})` : item.lastest_date}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {item.interval_term === "HOURS" ?(
                    <span>예정일: {`${item.extension_date ? item.extension_date : item.due_date} (${getRuntimeStr((item.lastest_run_hour ?? 0 )+ (item.interval ?? 0) *60) })`}</span>
                  ) : (
                    <span>예정일: {item.extension_date ? item.extension_date : item.due_date}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>담당자: {item.manager}</span>
                  {item.status === "COMPLETE" && (
                    <span className="text-green-600">완료일: {item.lastest_date}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {item.status !== "COMPLETE" && item.status === "DELAYED" && (
            <Button onClick={() => handleExtension(item)} size="sm" className="ml-4" style={{cursor: 'pointer'}}>
              연장 신청
            </Button>
          )}
          {item.status !== "COMPLETE" && (
            <Button onClick={() => handleExecuteTask(item)} size="sm" className="ml-4" style={{cursor: 'pointer'}}>
              개별 실행
            </Button>
          )}
        </div>
      </div>
    ))
  }

  const handleExecuteTask = (task: Maintenance) => {
    setSelectedWork({ ...task, equipment: task.equip_name, machine_name: task.machine_name })
    setExecutionResult(task);
    setIsExecutionDialogOpen(true)
  }
  
  const updateTaskBySection = (parent: Maintenance, item: any, status: string) => {
    const updatedTasks = parent.children.map((task) => {
      if (task.plan_code === item.plan_code) {
        if (status === "EXTENSION") {
          return { ...task,  
            vessel_no: item.vessel_no,
            equip_no: item.equip_no,
            section_code: item.section_code,
            section_name: item.section_name,
            extension_date: item.extension_date,
            status: status
          };
        } else {
          return { ...task,  
            vessel_no: item.vessel_no,
            equip_no: item.equip_no,
            section_code: item.section_code,
            section_name: item.section_name,
            due_date: item.next_due_date,
            lastest_date: new Date().toISOString().split("T")[0],
            status: status
          };
        }
      }

      return task;
    });

    return {...parent, children: updatedTasks }
  }

  const updateEquipmentWorks = (item: any, status: string) : Maintenance[] => {
    return works.map((eq) => {
      if (eq.vessel_no === item.vessel_no && eq.equip_no === item.equip_no) {
        const updatedSections = eq.children.map((section) => {
          if (section.section_code === item.section_code) {
            return updateTaskBySection(section, item, status);
          }

          return section;
        });
        
        return {...eq, children: updatedSections }
      } 

      return eq;
    });
  }

  const handleInsertExecution = async () => {
    const insertedData = {
      ...executionResult,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/execution/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });
    
    if (!res.ok)
    {
      alert('작업 실행 등록 중 오류가 발생하였습니다.');
      return;
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert("저장이 완료되었습니다.");

      // 선택된 작업들의 상태를 완료로 업데이트
      setWorks(updateEquipmentWorks(executionResult, "COMPLETE"))

      setUsedItems([])
      setSelectedWork(null)
      setIsExecutionDialogOpen(false)
    } else {
      alert(data.message);
    }
  }

  const handleExtension = (task: any) => {
    setSelectedExtension(task);
    setExtensionResult({
      vessel_no: task.vessel_no,
      equip_no: task.equip_no,
      section_code: task.section_code,
      plan_code: task.plan_code,
      plan_name: task.plan_name,
      manager: task.manager,
      due_date: task.due_date,
      extension_date: '',
      extension_reason: '',
      applicant: userInfo.account_no
    });
    setIsExtensionDialogOpen(true);
  }

  const handleInsertExtension = async () => {
    const insertedData = {
      ...extensionResult,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/extension/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });
    
    if (!res.ok)
    {
      alert('연장 신청 중 오류가 발생하였습니다.');
      return;
    }
    
    const data = await res.json();
    if (data.success) {
      alert("저장이 완료되었습니다.");

      // 선택된 작업들의 상태를 완료로 업데이트
      setWorks(updateEquipmentWorks(extensionResult, "EXTENSION"))

      setIsExtensionDialogOpen(false)
      setSelectedExtension(null)
    } else {
      alert(data.message);
    }
  }

  const getTotalTasks = () => {
    return works.reduce((total, eq) => {
      return total + eq.children.reduce((childTotal, section) => {
        return childTotal + section.children.length
      }, 0)
    }, 0)
  }

  const getTasksByStatus = (status: string) => {
    return works.reduce((total, eq) => {
      return total + eq.children.reduce((childTotal, section) => {
        return childTotal + section.children.filter((task) => task.status === status).length
      }, 0)
    }, 0)
  }

  const handleTaskSelection = (taskId: string, equipmentName: string, task: any) => {
    setSelectedWorks((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId)
      } else {
        return [...prev, taskId]
      }
    })
  }

  const findAllMatchingDescendants = (equipNo: string, sectionCode: string, items: Maintenance[]): Maintenance[] =>{
    let result: Maintenance[] = [];

    for (const item of items) {
      if (item.type === "TASK" && item.status !== "COMPLETE" && item.equip_no === equipNo && item.section_code === sectionCode) {
        result.push(item);
      }

      if (item.children && item.children.length > 0) {
        const deeperMatches = findAllMatchingDescendants(equipNo, sectionCode, item.children);
        result = result.concat(deeperMatches);
      }
    }

    return result;
  }

  const handleSelectAll = (equipNo: string, sectionCode: string) => {
    const allMatchingTasks: Maintenance[] = findAllMatchingDescendants(equipNo, sectionCode, filteredWorks);
    const allTaskIds = allMatchingTasks.map((task) => `${task.equip_no}-${task.section_code}-${task.plan_code}`);

    if (selectedWorks.length === allTaskIds.length) {
      setSelectedWorks([])
    } else {
      setSelectedWorks(allTaskIds)
    }
  }

  const getSelectedCount = (equipNo: string, sectionCode: string) => {
    let count = 0;
    filteredWorks.map(eq => {
      eq.children.map(section => {
        count += section.children.filter(task => task.status !== "COMPLETE" && task.equip_no === equipNo && task.section_code === sectionCode).length
      })
    });

    return count;
  }

  const findAllBulkExecutions = (items: Maintenance[]): Maintenance[] =>{
    let result: Maintenance[] = [];

    for (const item of items) {
      if (item.type === "TASK" && selectedWorks.includes(`${item.equip_no}-${item.section_code}-${item.plan_code}`)) {
        result.push(item);
      }

      if (item.children && item.children.length > 0) {
        const deeperMatches = findAllBulkExecutions(item.children);
        result = result.concat(deeperMatches);
      }
    }

    return result;
  }

  const handleBulkExecution = (equipNo: string, equipName: string) => {
    const allBulkTasks: Maintenance[] = findAllBulkExecutions(filteredWorks);
    const tasksToExecute = allBulkTasks.map((task) => ({
        ...task,
        equipmentName: task.equip_name,
        actualHours: task.work_hours?.toString(),
        used_parts: [],
        regist_user: userInfo.account_no,
        modify_user: userInfo.account_no,
      })
    )

    setBulkExecutionData({
      name: equipName,
      tasks: tasksToExecute,
    })
    setIsBulkExecutionDialogOpen(true)
    setDelayReason('')
  }
  
  const updateBulkTaskBySection = (parent: Maintenance, executionData: ComparisonData, status: string) => {
    const updatedTasks = parent.children.map((plan) => {
      const isMatch = executionData.tasks.some(task => 
        task.vessel_no === plan.vessel_no &&
        task.equip_no === plan.equip_no &&
        task.section_code === plan.section_code &&
        task.plan_code === plan.plan_code
      );

      if (isMatch) {
        return { ...plan, 
          lastest_date: new Date().toISOString().split("T")[0],
          status: status
        };
      }

      return plan;
    });

    return {...parent, children: updatedTasks }
  }

  const updateBulkEquipmentWorks = (executionData: ComparisonData, status: string) : Maintenance[] => {
    return works.map((eq) => {
      const isMatch = executionData.tasks.some(task => 
        task.vessel_no === eq.vessel_no &&
        task.equip_no === eq.equip_no
      );

      if (isMatch) {
        const updatedSections = eq.children.map((section) => {
          const isSectionMatch = executionData.tasks.some(task => 
            task.vessel_no === section.vessel_no &&
            task.equip_no === section.equip_no &&
            task.section_code === section.section_code
          )

          if (isSectionMatch) {
            return updateBulkTaskBySection(section, executionData, status);
          }

          return section;
        });
        
        return {...eq, children: updatedSections }
      } 

      return eq;
    });
  }

  const handleInsertExecutions = async () => {
    const res = await fetch('/api/ship/execution/inserts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bulkExecutionData.tasks),
    });
    
    if (!res.ok)
    {
      alert('작업 실행 등록 중 오류가 발생하였습니다.');
      return;
    }

    const data = await res.json();
    if (data.success) {
      alert("저장이 완료되었습니다.");

      // 선택된 작업들의 상태를 완료로 업데이트
      setWorks(updateBulkEquipmentWorks(bulkExecutionData, "COMPLETE"))

      setUsedItems([])
      setSelectedWorks([])
      setIsBulkExecutionDialogOpen(false)
    }
  }

  const handleClearDelayReason = () => {
    setDelayReason('')
  }

  const handleCopyDelayReason = (equip_no: string, section_code: string, plan_code: string) => {
    bulkExecutionData.tasks.map(task => {
      if (task.equip_no === equip_no && task.section_code === section_code && task.plan_code === plan_code) {
        setDelayReason(task.delay_reason || '')
      }
    })
  }

  const handlePasteDelayReason = (equip_no: string, section_code: string, plan_code: string) => {
    setBulkExecutionData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.equip_no === equip_no && task.section_code === section_code && task.plan_code === plan_code ? { ...task, delay_reason: delayReason } : task)),
    }))
  }

  const updateTaskData = (equip_no: string, section_code: string, plan_code: string, field: string, value: string) => {
    setBulkExecutionData((prev) => ({
    ...prev,
      tasks: prev.tasks.map((task) => (task.equip_no === equip_no && task.section_code === section_code && task.plan_code === plan_code ? { ...task, [field]: value } : task)),
    }))
}

  const updateTaskUsedParts = (equip_no: string, section_code: string, plan_code: string, usedPartnames: string, usedParts: any[]) => {
    setBulkExecutionData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (
        (task.equip_no === equip_no && task.section_code === section_code && task.plan_code === plan_code) ? { 
          ...task, used_parts: usedParts, used_partnames: usedPartnames
        } : task
      )),
    }))
  }

  const handleInventoryOpen = (item: any, isSingle: boolean) => {
    setIsSingle(isSingle)
    setSelectedUsedWork(item)
    setIsInventoryDialogOpen(true)
  }

  const handleChangedMachine = (item: any, value: string) => {
    setSelectedUsedWork((prev: any) => ({ ...prev, machine_name: value }))
  }

  const handleAddUsedParts = () => {
    let usedParts: UsedParts[] = [];
    let usedPartnames = "";

    let filtered = filteredInventorys;
    filtered = filtered.filter(item => (item.use_qty > 0));
    filtered.map((item) => {
      const usedItem = {
        vessel_no: item.vessel_no,
        equip_no: selectedUsedWork.equip_no,
        section_code: selectedUsedWork.section_code,
        plan_code: selectedUsedWork.plan_code,
        work_order: "",
        part_seq: "",
        machine_name: item.machine_name,
        warehouse_no: item.warehouse_no,
        warehouse_name: item.warehouse_name,
        material_code: item.material_code,
        material_name: item.material_name,
        use_unit: item.material_unit,
        use_qty: item.use_qty,
        regist_date: "",
        regist_user: "",
        modify_date: "",
        modify_user: ""
      }

      usedPartnames += usedPartnames ? ", " + item.material_name: item.material_name;
      usedParts.push(usedItem)
    })
    
    setUsedItems(usedParts);

    if (isSingle) {
      setSelectedWork((prev: any) => ({...prev, used_partnanes: usedPartnames}))
      setExecutionResult((prev) => ({...prev, used_partnames: usedPartnames, used_parts: usedParts}))
    }
    else {
      updateTaskUsedParts(selectedUsedWork.equip_no, selectedUsedWork.section_code, selectedUsedWork.plan_code, usedPartnames, usedParts);
    }

    setIsInventoryDialogOpen(false)
  }
  
  const handleMachineFilterChange = (value: string) => {
    setMachineFilter(value)
    setEquipmentFilter("ALL")
    setSectionFilter("ALL")
  }

  const handleEquipmentFilterChange = (value: string) => {
    setEquipmentFilter(value)
    setSectionFilter("ALL")
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
                <h1 className="text-2xl font-bold text-gray-900">{userInfo.ship_name} - 정비 실행</h1>
                <p className="text-gray-600">{userInfo?.ship_no} 선박의 정비 작업을 실행하고 결과를 등록하세요</p>
              </div>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setStatusFilter("ALL")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 작업 수</CardTitle>
                <Wrench className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getTotalTasks()}</div>
                <p className="text-xs text-muted-foreground">전체 작업</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setStatusFilter("DELAYED")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">지연된 작업</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{getTasksByStatus("DELAYED")}</div>
                <p className="text-xs text-muted-foreground">즉시 실행 필요</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setStatusFilter("SCHEDULED")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예정된 작업</CardTitle>
                <Calendar className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{getTasksByStatus("NORMAL") +getTasksByStatus("WEEKLY") +getTasksByStatus("MONTHLY") + getTasksByStatus("EXTENSION")}</div>
                <p className="text-xs text-muted-foreground">실행 대기</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setStatusFilter("COMPLETE")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">완료된 작업</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{getTasksByStatus("COMPLETE")}</div>
                <p className="text-xs text-muted-foreground">실행 완료</p>
              </CardContent>
            </Card>
          </div>

          {/* 필터 및 검색 */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">필터 및 검색</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={machineFilter} onValueChange={handleMachineFilterChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 기계</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.machine_name} value={machine.machine_name}>{machine.machine_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={equipmentFilter} onValueChange={handleEquipmentFilterChange}>
                  <SelectTrigger className="w-40">
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
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 섹션</SelectItem>
                    {sectionFilteredData.map((section) => (
                      <SelectItem key={`${section.equip_no}-${section.section_code}`} value={`${section.equip_no}-${section.section_code}`}>{`(${section.equip_no}-${section.section_code}) ${section.section_name}`} </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
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
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="작업명으로 검색..."
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

          {/* 장비별 작업 목록 */}
          <div className="space-y-6">
            {filteredWorks.map((eq) => (
              <Card key={eq.equip_no}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Settings className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{eq.machine_name}</CardTitle>
                        <p className="text-gray-600">{eq.equip_name}</p>
                      </div>
                    </div>
                    {selectedWorks.length > 0 && (
                      selectedWorks.filter(selected => selected.startsWith(eq.equip_no)).length > 0 && (
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">{selectedWorks.filter(selected => selected.includes(eq.equip_no)).length}개 작업 선택됨</span>
                        <Button onClick={() => handleBulkExecution(eq.equip_no, eq.equip_name)} className="bg-blue-600 hover:bg-blue-700" style={{cursor: 'pointer'}}>
                          <Plus className="w-4 h-4 mr-2" />
                          일괄 실행 등록
                        </Button>
                      </div>
                      )
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {renderMaintenance(eq.children)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 일괄 정비 작업 실행 등록 */}
          <Dialog open={isBulkExecutionDialogOpen} onOpenChange={setIsBulkExecutionDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>일괄 정비 작업 실행 등록</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 w-full max-w-full min-w-0">
                {/* 개별 작업 정보 */}
                <div className="space-y-4 w-full max-w-full min-w-0">
                  <h3 className="text-lg font-semibold">{bulkExecutionData.name}</h3>
                  <div className="space-y-1 max-h-96 overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0">
                    {delayReason && (
                      <div className="sticky top-0 z-10 w-full max-w-full min-w-0 h-10 bg-green-100 px-3 !mt-0 rounded-lg flex items-center overflow-hidden"
                           style={{fontSize: '9pt'}}>
                        <span className="block w-full max-w-full min-w-0 truncate">
                          {delayReason}
                        </span>
                      </div>
                    )}
                    {bulkExecutionData.tasks.map((task) => (
                      <Card key={`${task.equip_no}-${task.section_code}-${task.plan_code}`} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{task.plan_name}</h4>
                          </div>
                          <div className="grid grid-cols-[2fr_1fr] gap-2">
                            <div>
                              <Label className="text-xs">실제 소요시간</Label>
                              <Input
                                type="number"
                                placeholder="시간"
                                value={task.work_hours}
                                onChange={(e) => updateTaskData(task.equip_no, task.section_code || '', task.plan_code || '', "work_hours", e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">다음 정비 예정일</Label>
                              <Input
                                type="date"
                                placeholder="시간"
                                value={task.next_due_date}
                                className='text-sm sm:w-40 md:w-36'
                                disabled
                              />
                            </div>
                          </div>
                          
                        {task.interval_term === 'HOURS' && (
                          <EquipmentRuntimeInput
                            equip_name={task.equip_name}
                            machine_name={task.machine_name}
                            handleRuntimeChanged={(runtime) => updateTaskData(task.equip_no, task.section_code || '', task.plan_code || '', "lastest_run_time", String(runtime))}
                            />
                        )}
                          <div>
                            <Label className="text-xs">사용 부품</Label>
                            <div className="flex flex-row gap-4">
                              <Input
                                placeholder="부품명"
                                value={task.used_partnames}
                                className="text-sm"
                                disabled
                              />
                              <Button
                                id="parts-select"
                                onClick={() => handleInventoryOpen(task, false)}>...</Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">작업 내용</Label>
                            <Textarea
                              placeholder="이 작업에 대한 내용..."
                              value={task.work_details}
                              onChange={(e) => updateTaskData(task.equip_no, task.section_code || '', task.plan_code || '', "work_details", e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                          {task.status === "DELAYED" && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs">지연 사유</Label>
                                <div className="flex items-center gap-2 mb-1">
                                  <Button
                                    variant="outline"
                                    style={{ height: '20px', alignItems: 'center', fontSize: '9pt', borderRadius: '4px', cursor: 'pointer' }}
                                    disabled={!delayReason}
                                    onClick={() => handleClearDelayReason()}>초기화</Button>
                                  <Button
                                    variant="outline"
                                    style={{ height: '20px', alignItems: 'center', fontSize: '9pt', borderRadius: '4px', cursor: 'pointer' }}
                                    disabled={delayReason === task.delay_reason || !task.delay_reason}
                                    onClick={() => handleCopyDelayReason(task.equip_no, task.section_code || '', task.plan_code || '')}>복사하기</Button>
                                  <Button
                                    variant="outline"
                                    style={{ height: '20px', alignItems: 'center', fontSize: '9pt', borderRadius: '4px', cursor: 'pointer' }}
                                    disabled={delayReason === task.delay_reason || !delayReason}
                                    onClick={() => handlePasteDelayReason(task.equip_no, task.section_code || '', task.plan_code || '')}>붙여넣기</Button>
                                </div>
                              </div>
                              <Textarea
                                placeholder="이 작업에 대한 지연 사유..."
                                value={task.delay_reason}
                                onChange={(e) => updateTaskData(task.equip_no, task.section_code || '', task.plan_code || '', "delay_reason", e.target.value)}
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkExecutionDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleInsertExecutions} 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={bulkExecutionData?.tasks.filter(item => !item.work_details || (item.status === "DELAYED" && !item.delay_reason)).length > 0}
                  style={{cursor: 'pointer'}}
                >
                  일괄 등록 완료
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 개별 실행 다이얼로그 */}
          {selectedWork && (
            <Dialog open={isExecutionDialogOpen} onOpenChange={setIsExecutionDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>작업 실행 등록</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">실제 소요시간</Label>
                      <Input
                        type="number"
                        placeholder="시간"
                        value={executionResult.work_hours}
                        // value={selectedWork.work_hours}
                        onChange={(e) => setExecutionResult((prev) => ({ ...prev, work_hours: Number(e.target.value) }))}
                        // onChange={(e) => updateTaskData(selectedWork.equip_no, selectedWork.section_code, selectedWork.plan_code, "work_hours", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">다음 정비일자</Label>
                      <Input
                        type="date"
                        placeholder="정비일자"
                        value={executionResult.next_due_date}
                        // value={selectedWork.next_due_date}
                        className='text-sm sm:w-40 md:w-36'
                        disabled
                      />
                    </div>
                  </div>

                  {selectedWork.interval_term === 'HOURS' && (
                    <EquipmentRuntimeInput
                      equip_name={selectedWork.equip_name}
                      machine_name={selectedWork.machine_name}
                      handleRuntimeChanged={(runtime) => setExecutionResult((prev) => ({ ...prev, lastest_run_hour: runtime }))}
                      // handleRuntimeChanged={(runtime) => updateTaskData(selectedWork.equip_no, selectedWork.section_code, selectedWork.plan_code, "lastest_run_hour", String(runtime))}
                      />
                  )}

                  <div>
                    <Label htmlFor="parts-used">사용 부품</Label>
                    <div className="flex flex-row gap-4">
                      <Input
                        id="parts-used"
                        placeholder="부품명"
                        value={selectedWork.used_partnanes}
                        disabled
                        />
                      <Button
                        id="parts-select"
                        onClick={() => handleInventoryOpen(selectedWork, true)}>...</Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">작업 내용</Label>
                    <Textarea
                      id="notes"
                      placeholder="이 작업에 대한 내용을 입력하세요..."
                      value={executionResult.work_details}
                      onChange={(e) => setExecutionResult((prev) => ({ ...prev, work_details: e.target.value }))}
                      rows={3}
                      />
                  </div>
                  {selectedWork.status === "DELAYED" && (
                    <div>
                      <Label className="text-xs">지연 사유</Label>
                      <Textarea
                        placeholder="이 작업에 대한 지연 사유..."
                        value={executionResult.delay_reason}
                        onChange={(e) => setExecutionResult((prev) => ({ ...prev, delay_reason: e.target.value }))}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExecutionDialogOpen(false)}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleInsertExecution} 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!executionResult.work_details || (executionResult.status === "DELAYED" && !executionResult.delay_reason) }
                    style={{cursor: 'pointer'}}
                  >
                    등록 완료
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {/* 사용 부품 다이얼로그 */}
          {selectedUsedWork && (
            <Dialog open={isInventoryDialogOpen} onOpenChange={setIsInventoryDialogOpen}>
              <DialogContent className="sm:max-w-[820px] max-h-[620px]">
                <DialogHeader>
                  <DialogTitle>사용 부품 선택</DialogTitle>
                  <DialogDescription>사용할 부품을 검색하여 선택해주세요.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label>장비</Label>
                    <Select 
                      value={selectedUsedWork.machine_name} 
                      onValueChange={(value) => handleChangedMachine(selectedUsedWork, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        {machines.map((machine) => (
                          <SelectItem key={machine.machine_name} value={machine.machine_name}>
                            {machine.machine_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b">
                        <tr>
                          <th className="text-center py-2 px-2">선택</th>
                          <th className="text-left py-2 px-2">부품명</th>
                          <th className="text-left py-2 px-2">부품코드</th>
                          <th className="text-center py-2 px-2">단위</th>
                          <th className="text-center py-3 px-2">창고</th>
                          <th className="text-center py-2 px-2">현재재고</th>
                          <th className="text-center py-2 px-2">사용수량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventorys.map((item) => (
                          <tr key={`${item.machine_name}-${item.material_code}`} className="border-b hover:bg-gray-50">
                            <td className="text-center py-2 px-2">
                              <Checkbox
                                key={`chk_${item.machine_name}-${item.material_code}`}
                                checked={item.use_qty > 0}
                                onCheckedChange={(value) => {
                                  if (!value) {
                                    setInventorys(prev => 
                                      prev.map(invItem => 
                                        (invItem.machine_name === item.machine_name && invItem.material_code === item.material_code)
                                          ? { ...invItem, use_qty: 0 }
                                          : invItem 
                                      )
                                    );
                                  }
                                }}
                              ></Checkbox>
                            </td>
                            <td className="py-2 px-2 font-medium">{item.material_name}</td>
                            <td className="py-2 px-2 text-gray-600">{item.material_code}</td>
                            <td className="py-2 px-2 text-center">{item.material_unit}</td>
                            <td className="py-2 px-2 text-center">{item.warehouse_name}</td>
                            <td className="py-2 px-2 text-center">{item.stock_qty}</td>
                            <td className="py-2 px-2 text-center">
                              <input
                                key={`${item.machine_name}-${item.material_code}`}
                                value={item.use_qty}
                                className="w-10 text-center"
                                onChange={(e) => {
                                  const newQty = Number.parseInt(e.target.value);

                                  setInventorys(prevInventorys => 
                                    prevInventorys.map(invItem => 
                                      (invItem.machine_name === item.machine_name && invItem.material_code === item.material_code)
                                        ? { ...invItem, use_qty: newQty }
                                        : invItem 
                                    )
                                  );
                                }}
                              ></input>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredInventorys.length === 0 && (
                      <div className="text-center py-8 text-gray-500">검색 결과가 없습니다.</div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExtensionDialogOpen(false)}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleAddUsedParts} 
                    className="bg-blue-600 hover:bg-blue-700"
                    style={{cursor: 'pointer'}}
                  >
                    등록 완료
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* 연장 신청 다이얼로그 */}
          {selectedExtension && (
            <Dialog open={isExtensionDialogOpen} onOpenChange={setIsExtensionDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>작업 연장 신청</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">예정일</Label>
                      <Input
                        type="date"
                        placeholder="예정일"
                        value={extensionResult.due_date || ''}
                        className='text-sm sm:w-40 md:w-36'
                        disabled
                      />
                    </div>
                    <div>
                      <Label className="text-xs">연장 일자</Label>
                      <Input
                        type="date"
                        placeholder="신청일자"
                        value={extensionResult.extension_date || ''}
                        className='text-sm sm:w-40 md:w-36'
                        onChange={(e) => setExtensionResult((prev) => ({ ...prev, extension_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">연장 사유</Label>
                    <Textarea
                      placeholder="이 작업에 대한 일정 연장 사유..."
                      value={extensionResult.extension_reason || ''}
                      onChange={(e) => setExtensionResult((prev) => ({ ...prev, extension_reason: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsExtensionDialogOpen(false)}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleInsertExtension} 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!extensionResult.extension_date || !(new Date(extensionResult.extension_date) > today) || !extensionResult.extension_reason }
                    style={{cursor: 'pointer'}}
                  >
                    등록 완료
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </main>
      </div>
    </div>
  )
}
