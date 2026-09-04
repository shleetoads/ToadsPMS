"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Wrench,
  Calendar,
  Edit,
  FolderTree,
  Clock,
} from "lucide-react"
import { Machine } from '@/types/vessel/machine';
import { Equipment } from '@/types/vessel/equipment'; // ✅ interface import
import { Section } from '@/types/vessel/section'; // ✅ interface import
import { Maintenance } from '@/types/vessel/maintenance';
import { MaintenancePlan } from "@/types/vessel/maintenance_plan"

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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
    
  const [maintenanceData, setMaintenanceData] = useState<Maintenance[]>([])
  const [filteredData, setFilteredData] = useState<Maintenance[]>(maintenanceData)
  
  const [addSection, setAddSection] = useState<Section>()
  const [isAddSectionDialogOpen, setIsAddSectionDialogOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState<Section>()
  const [isEditSectionDialogOpen, setIsEditSectionDialogOpen] = useState(false)

  const [addMaintenance, setAddMaintenance] = useState<MaintenancePlan>()
  const [isAddMaintenanceDialogOpen, setIsAddMaintenanceDialogOpen] = useState(false)

  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenancePlan>()
  const [isEditMaintenanceDialogOpen, setIsEditMaintenanceDialogOpen] = useState(false)

  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>()
  const [selectedSections, setSelectedSections] = useState<Section[]>(sections)

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

  const fetchSections = (vesselNo: string) => {
    fetch(`/api/common/section/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setSections(data))
      .catch(err => console.error(err));
  };
  
  const fetchMaintenances = (vesselNo: string) => {
    fetch(`/api/ship/maintenance?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMaintenanceData(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = vesselRequireAuth();
      setUserInfo(user);

      fetchMaintenances(user.ship_no);
      fetchMachines(user.ship_no);
      fetchEquipments(user.ship_no);
      fetchSections(user.ship_no);
      
      setAddSection((prev: any) => ({ ...prev, vessel_no: user.ship_no }));
      setAddMaintenance((prev: any) => ({ ...prev, vessel_no: user.ship_no }));
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
  }, [sections, equipmentFilter, machineFilter])

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
  }, [maintenanceData, machineFilter, equipmentFilter, sectionFilter, searchTerm])

  useEffect(() => {
    let sectionFiltered = sections

    if (selectedEquipment && selectedEquipment?.equip_no && selectedEquipment?.equip_no !== "ALL" && selectedEquipment?.equip_no !== "") {
      sectionFiltered = sectionFiltered.filter((item) => item.equip_no === selectedEquipment?.equip_no)
      setSelectedSections(sectionFiltered)
    }
    
    if (addMaintenance && addMaintenance?.equip_no && addMaintenance?.equip_no !== "ALL" && addMaintenance?.equip_no !== "") {
      sectionFiltered = sectionFiltered.filter((item) => item.equip_no === addMaintenance?.equip_no)
      setSelectedSections(sectionFiltered)
    }
  }, [addMaintenance, selectedEquipment])

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

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  // 행(row) 아무 곳이나 클릭 시: 하위 항목이 있으면 펼침/접힘, 최하위 작업이면 수정 창 열기
  const handleRowClick = (item: Maintenance) => {
    if (item.children && item.children.length > 0) {
      toggleExpanded(item.key || '')
      return
    }

    if (item.type === "TASK") {
      handleEditMaintenanceDialogOpen(item)
    }
  }

  // 칸 밖으로 넘치는 긴 명칭은 잘라서 표시하고, 마우스 오버 시 툴팁으로 전체 이름을 보여줍니다.
  const getEquipmentLabel = (equipNo?: string) => {
    if (!equipNo) return ''
    return equipments.find((eq) => eq.equip_no === equipNo)?.equip_name || equipNo
  }

  const getSectionLabel = (sectionCode?: string) => {
    if (!sectionCode) return ''
    const section = selectedSections?.find((s) => s.section_code === sectionCode)
    if (!section) return sectionCode
    return `${section.equip_no}-${section.section_code} ${section.section_name}`
  }

  const getCycleText = (interval?: number, intervalTerm?: string) => {
    if (!interval || !intervalTerm) return ""

    return `${interval} ${intervalTerm} 마다`
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

  const equipmentCount = equipments.length;
  const sectionCount = sections.length;
  const maintenanceCount = maintenanceData.reduce((childAcc1, children1) => { 
    const childrenCount1 = children1.children.reduce((childAcc2, children2) => {
      const childrenCount2 = children2.children.reduce((childAcc3, children3) => {
        return childAcc3 + (children3.children ? children3.children?.length: 0);
      }, 0);
      return childAcc2 + (childrenCount2 === 0 ? children2.children?.length : childrenCount2);
    }, 0);
    return childAcc1 + childrenCount1; 
  }, 0);

  const renderMaintenance = (parent: Section, level = 2) => {
    return parent.children.map((item) => (
      <div key={`${item.equip_no}-${item.section_code}-${item.plan_code}`} className={`${level > 0 ? "ml-6" : ""}`}>
        <Collapsible open={expandedItems.has(`${item.equip_no}-${item.section_code}-${item.plan_code}`)} onOpenChange={() => toggleExpanded(`${item.equip_no}-${item.section_code}-${item.plan_code}`)}>
          <div className="flex items-center gap-2 p-3 border rounded-lg mb-2 bg-white hover:bg-gray-50">
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.plan_name}</span>
                      <span className="text-sm text-gray-500">({item.plan_code})</span>
                      {item.critical && getCriticalBadge(item.critical)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      {item.interval && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getCycleText(item.interval, item.interval_term)}
                        </span>
                      )}
                      {item.manager && <span>담당: {item.manager}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.due_date && (
                  <span className="text-sm text-gray-500">다음: {item.due_date}</span>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleEditMaintenanceDialogOpen(item)} 
                  style={{cursor: 'pointer'}}
                  disabled={userInfo.user_auth !== 'VADMIN'}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Collapsible>
      </div>
    ))
  }

  const renderSection =  (parent: Equipment, level = 1) => {
    return parent.children.map((item) => (
      <div key={`${item.equip_no}-${item.section_code}`} className={`${level > 0 ? "ml-6" : ""}`}>
        <Collapsible open={expandedItems.has(`${item.equip_no}-${item.section_code}`)} onOpenChange={() => toggleExpanded(`${item.equip_no}-${item.section_code}`)}>
          <div className="flex items-center gap-2 p-3 border rounded-lg mb-2 bg-white hover:bg-gray-50">
            {item.children && item.children.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto" style={{cursor: 'pointer'}}>
                  {expandedItems.has(`${item.equip_no}-${item.section_code}`) ? (
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
                  <FolderTree className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.section_name}</span>
                      <span className="text-sm text-gray-500">({item.section_code})</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {item.due_date && (
                  <span className="text-sm text-gray-500">다음: {item.due_date}</span>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleEditSectionDialogOpen(item)} 
                  style={{cursor: 'pointer'}}
                  disabled={userInfo.user_auth !== 'VADMIN'}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {item.children && item.children.length > 0 && (
            <CollapsibleContent>
              <div className="ml-4 border-l-2 border-gray-200 pl-4">
                {renderMaintenance(item, level + 1)}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    ))
  }

  const renderMaintenanceTree = (items: Maintenance[], level = 0) => {
    return items.map((item) => (
      <div key={item.key} className={`${level > 0 ? "ml-6" : ""}`}>
        <Collapsible open={expandedItems.has(item.key || '')} onOpenChange={() => toggleExpanded(item.key || '')}>
          <div
            className="flex items-center gap-2 p-3 border rounded-lg mb-2 bg-white hover:bg-gray-50"
            style={{cursor: 'pointer'}}
            onClick={() => handleRowClick(item)}
          >
            {item.children && item.children.length > 0 && (
              <span className="flex items-center justify-center w-6 h-6 text-gray-600">
                {expandedItems.has(item.key || '') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            )}

            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {item.type === "EQUIPMENT" ? (
                    <FolderTree className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Wrench className="w-5 h-5 text-orange-600" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{`${item.name}`}</span>
                      <span className="text-sm text-gray-500">({item.id})</span>
                      {item.type === "TASK" && (
                        item.critical && getCriticalBadge(item.critical)
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
              {item.type === "SECTION" && (
                <div className="flex items-center gap-2">
                  {item.due_date && (
                    <span className="text-sm text-gray-500">다음: {item.due_date}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleEditSectionDialogOpen(item); }}
                    style={{cursor: 'pointer'}}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {item.type === "TASK" && (
                <div className="flex items-center gap-2">
                  {item.due_date && (
                    <span className="text-sm text-gray-500">다음: {item.due_date}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleEditMaintenanceDialogOpen(item); }}
                    style={{cursor: 'pointer'}}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              )}
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

  const equipmentChanged = (value: string) => {
    let filtered = equipments;
    filtered = filtered.filter((eq: { equip_no: string }) => eq.equip_no.toLowerCase().includes(value.toLowerCase()))

    setSelectedEquipment(filtered[0]);
  }

  const addSections = (item: any) : Maintenance[] => {
    return maintenanceData.map((children1) => {
      item.key = `${item.vessel_no}-${item.equip_no}-${item.section_code}`;
      item.id = item.section_code;
      item.name = item.section_name;
      item.type = "SECTION";

      if (children1.type === "MACHINE" && children1.vessel_no === item.vessel_no) {
        const updatedEquipments = children1.children.map((eq) => {
          if (eq.equip_no === item.equip_no) {
            item.machine_name = eq.machine_name;
            item.equip_name = eq.equip_name;

            const updatedSections = [...eq.children, item];
            return {...eq, children: updatedSections }
          }

          return eq;
        });
        
        return {...children1, children: updatedEquipments }
      }

      if (children1.type === "EQUIPMENT" && children1.vessel_no === item.vessel_no && children1.equip_no === item.equip_no) {
        item.equip_name = children1.equip_name;

        const updatedSections = [...children1.children, item];
        return {...children1, children: updatedSections }
      }

      return children1;
    });
  }

  const updateSectionsByEquipment = (parent: Maintenance, item: any) => {
    const updatedSections = parent.children.map((section) => {
      if (section.section_code === item.section_code) {
        return { ...section,  
          vessel_no: item.vessel_no,
          equip_no: item.equip_no,
          section_code: item.section_code,
          section_name: item.section_name,
          description: item.description,
          due_date: item.due_date,
          maintenance_count: item.maintenance_count 
        };
      }

      return section;
    });

    return {...parent, children: updatedSections }
  }

  const updateSections = (item: any) : Maintenance[] => {
    return maintenanceData.map((children1) => {
      if (children1.type === "MACHINE" && children1.vessel_no === item.vessel_no) {
        const updatedEquipments = children1.children.map((eq) => {
          if (eq.equip_no === item.equip_no) {
            return updateSectionsByEquipment(eq, item);
          }

          return eq;
        });
        
        return {...children1, children: updatedEquipments }
      } 
      
      if (children1.type === "EQUIPMENT" && children1.vessel_no === item.vessel_no && children1.equip_no === item.equip_no) {
        return updateSectionsByEquipment(children1, item);
      }

      return children1;
    });
  }

  const handleAddSectionDialogOpen = () => {
    setAddSection({
      vessel_no: userInfo.ship_no,
      children: [] = []
    });

    setIsAddSectionDialogOpen(true);
  }

  const handleInsertSection = async () => {
    if (addSection) {
      const insertedData = {
        ...addSection,
        regist_user: userInfo.account_no,
        modify_user: userInfo.account_no,
      };
      
      const res = await fetch('/api/ship/section/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("저장이 완료되었습니다.");

        addSection.section_code = data.section_code;

        setMaintenanceData(addSections(addSection));        
        setSections([...sections, addSection]);
        
        setIsAddSectionDialogOpen(false);
      } else {
        alert(data.message);
      }
    }
  }

  const handleEditSectionDialogOpen = (item: any) => {
    setSelectedSection(item);
    setIsEditSectionDialogOpen(true);
  }

  const handleUpdateSection = async () => {
    const updatedData = {
      ...selectedSection,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/section/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");
      
      const newMaintenanceData = updateSections(selectedSection)
      setMaintenanceData(newMaintenanceData);

      
      setIsEditSectionDialogOpen(false);
    } else {
      alert(data.message);
    }
  }

  const handleSelfMaintenanceChange = (checked : boolean) => {
    setAddMaintenance((prev: any) => ({ ...prev, self_maintenance: checked ? 'Y' : 'N'}))
  }

  const handleEditSelfMaintenanceChange = (checked : boolean) => {
    setSelectedMaintenance((prev: any) => ({ ...prev, self_maintenance: checked ? 'Y' : 'N'}))
  }
  
  const addMaintenances = (item: any) => {
    item.key = `${item.equip_no}-${item.section_code}-${item.plan_code}`;
    item.id = item.plan_code;
    item.name = item.plan_name;
    item.type = "TASK";
    
    return maintenanceData.map((children1) => {
      if (children1.type === "MACHINE" && children1.vessel_no === item.vessel_no) {
        const updatedEquipments = children1.children.map((eq) => {
          if (eq.vessel_no === item.vessel_no && eq.equip_no === item.equip_no) {
            const updatedSections = eq.children.map((section) => {
              if (section.section_code === item.section_code) {
                item.machine_name = eq.machine_name;
                item.equip_name = eq.equip_name;
                item.section_name = section.section_name;

                const updatedMaintenances = [...section.children, item];
                return {...section, children: updatedMaintenances }
              }

              return section;
            });

            return {...eq, children: updatedSections }
          }

          return eq;
        });

        return {...children1, children: updatedEquipments }
      }
      
      if (children1.type === "EQUIPMENT" && children1.vessel_no === item.vessel_no && children1.equip_no === item.equip_no) {
        const updatedSections = children1.children.map((section) => {
          if (section.section_code === item.section_code) {
            item.equip_name = children1.equip_name;
            item.section_name = section.section_name;

            const updatedMaintenances = [...section.children, item];
            return {...section, children: updatedMaintenances }
          }

          return section;
        });

        return {...children1, children: updatedSections }
      }

      return children1;
    });
  }

  const updateMaintenancesByEquipment = (parent: Maintenance, item: any) => {
    const updatedSections = parent.children.map((section) => {
      if (section.section_code === item.section_code) {
        const updatedMaintenances = section.children.map((plan) => {
          if (plan.plan_code === item.plan_code) {
            return { ...plan,  
              vessel_no: item.vessel_no,
              vessel_name: item.vessel_name,
              equip_no: item.equip_no,
              equip_name: item.equip_name,
              section_code: item.section_code,
              section_name: item.section_name,
              plan_code: item.plan_code,
              plan_name: item.plan_name,
              manufacturer: item.manufacturer,
              model: item.model,
              specifications: item.specifications,
              lastest_date: item.lastest_date,
              workers: item.workers,
              work_hours: item.work_hours,
              interval: item.interval,
              interval_term: item.interval_term,
              location: item.location,
              self_maintenance: item.self_maintenance,
              manager: item.manager,
              important_items: item.important_items,
              instructions: item.instructions,
              critical: item.critical,
              due_date: item.due_date
            };
          }

          return plan;
        });

        return {...section, children: updatedMaintenances };
      }

      return section;
    });

    return {...parent, children: updatedSections }
  }

  const updateMaintenances = (item: any) : Maintenance[] => {
    return maintenanceData.map((children1) => {
      if (children1.type === "MACHINE" && children1.vessel_no === item.vessel_no) {
        const updatedEquipments = children1.children.map((eq) => {
          if (eq.equip_no === item.equip_no) {
            return updateMaintenancesByEquipment(eq, item);
          }

          return eq;
        });

        return {...children1, children: updatedEquipments }
      }
      
      if (children1.type === "EQUIPMENT" && children1.vessel_no === item.vessel_no && children1.equip_no === item.equip_no) {
        return updateMaintenancesByEquipment(children1, item);
      }

      return children1;
    });
  }

  const handleAddMaintenanceDialogOpen = (item: any) => {
    setAddMaintenance({
      vessel_no: userInfo.ship_no,
      critical: 'NORMAL'
    });

    setIsAddMaintenanceDialogOpen(true);
  }

  const handleInsertMaintenance = async () => {
    if (addMaintenance) {
      const insertedData = {
        ...addMaintenance,
        regist_user: userInfo.account_no,
        modify_user: userInfo.account_no,
      };

      const res = await fetch('/api/ship/maintenance/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("저장이 완료되었습니다.");

        addMaintenance.plan_code = data.plan_code;

        setMaintenanceData(addMaintenances(addMaintenance));
        setIsAddMaintenanceDialogOpen(false);
      } else {
        alert(data.message);
      }
    }
  }

  const handleEditMaintenanceDialogOpen = (item: any) => {
    equipmentChanged(item.equip_no);

    setSelectedMaintenance(item);
    setIsEditMaintenanceDialogOpen(true);
  }

  const handleUpdateMaintenance = async () => {
    if (selectedMaintenance) {
      const updatedData = {
        ...selectedMaintenance,
        regist_user: userInfo.account_no,
        modify_user: userInfo.account_no,
      };

      const res = await fetch('/api/ship/maintenance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("저장이 완료되었습니다.");

        setMaintenanceData(updateMaintenances(selectedMaintenance));
        setIsEditMaintenanceDialogOpen(false);
      } else {
        alert(data.message);
      }
    }
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
                <h1 className="text-2xl font-bold text-gray-900">{userInfo.ship_name} - 정비 등록</h1>
                <p className="text-gray-600">{userInfo.ship_no} 선박의 정비 작업을 관리하세요</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => (window.location.href = "/ship/calendar")} style={{cursor: 'pointer'}}>
                  <Calendar className="w-4 h-4 mr-2" />
                  작업 캘린더
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700" 
                  onClick={handleAddSectionDialogOpen} 
                  style={{cursor: 'pointer'}}
                  disabled={userInfo.user_auth !== 'VADMIN'}
                >
                  <Plus className="w-4 h-4 mr-2" />새 섹션 추가
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700" 
                  onClick={handleAddMaintenanceDialogOpen} 
                  style={{cursor: 'pointer'}}
                  disabled={userInfo.user_auth !== 'VADMIN'}
                >
                  <Plus className="w-4 h-4 mr-2" />새 작업 추가
                </Button>
              </div>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 장비 수</CardTitle>
                <Wrench className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{equipmentCount}</div>
                <p className="text-xs text-muted-foreground">등록된 장비</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 섹션 수</CardTitle>
                <Wrench className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sectionCount}</div>
                <p className="text-xs text-muted-foreground">등록된 섹션</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 작업 수</CardTitle>
                <Wrench className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{maintenanceCount}</div>
                <p className="text-xs text-muted-foreground">등록된 작업</p>
              </CardContent>
            </Card>
          </div>

          {/* 필터 및 검색 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">필터 및 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={machineFilter} onValueChange={setMachineFilter}>
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
                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
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
                      <SelectItem key={`${section.equip_no}-${section.section_code}`} value={`${section.equip_no}-${section.section_code}`}>{`(${section.equip_no}-${section.section_code}) ${section.section_name}`}</SelectItem>
                    ))}
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

          {/* 섹션 추가 Dialog */}
          <Dialog open={isAddSectionDialogOpen} onOpenChange={setIsAddSectionDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>새 유지보수 섹션 추가</DialogTitle>
                <DialogDescription>새로운 유지보수 섹션을 추가하세요</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="section_code">섹션코드</Label>
                  <Input 
                    id="section_code" 
                    placeholder="섹션코드를 입력하세요" 
                    onChange={(e) => setAddSection((prev: any) => ({ ...prev, section_code: e.target.value }))}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section_name">섹션명</Label>
                  <Input 
                    id="section_name" 
                    placeholder="섹션명을 입력하세요" 
                    onChange={(e) => setAddSection((prev: any) => ({ ...prev, section_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equip_no">장비</Label>
                  <Select 
                    onValueChange={(value) => setAddSection((prev: any) => ({ ...prev, equip_no: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="장비 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipments.map(eq => (
                        <SelectItem key={eq.equip_no} value={eq.equip_no}>{eq.equip_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">섹션 설명</Label>
                  <Textarea 
                    id="description" 
                    placeholder="섹션에 대한 상세 설명을 입력하세요" 
                    onChange={(e) => setAddSection((prev: any) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddSectionDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleInsertSection}
                  disabled={!addSection?.vessel_no || 
                    !addSection?.equip_no || 
                    !addSection?.section_name}
                  style={{cursor: 'pointer'}}
                  >추가</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* 섹션 수정 다이얼로그 */}
          <Dialog open={isEditSectionDialogOpen} onOpenChange={setIsEditSectionDialogOpen}>
            <DialogContent className="max-w-2xl" draggable>
              <DialogHeader>
                <DialogTitle>섹션 정보 수정</DialogTitle>
                <DialogDescription>섹션의 정보를 수정하세요</DialogDescription>
              </DialogHeader>
              {selectedSection && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="section_code">섹션코드</Label>
                    <Input 
                      id="section_code" 
                      value={selectedSection.section_code}
                      placeholder="섹션코드를 입력하세요" 
                      onChange={(e) => setSelectedSection((prev: any) => ({ ...prev, section_code: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section_name">섹션명</Label>
                    <Input
                      id="section_name"
                      value={selectedSection.section_name}
                      title={selectedSection.section_name || ''}
                      placeholder="섹션명을 입력하세요"
                      onChange={(e) => setSelectedSection((prev: any) => ({ ...prev, section_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equip_no">장비</Label>
                    <Select
                      value={selectedSection.equip_no}
                      onValueChange={(value) => setSelectedSection((prev: any) => ({ ...prev, equip_no: value }))}
                      disabled
                    >
                      <SelectTrigger className="w-full" title={getEquipmentLabel(selectedSection.equip_no)}>
                        <SelectValue placeholder="장비 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipments.map(eq => (
                          <SelectItem key={eq.equip_no} value={eq.equip_no}>{eq.equip_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">섹션 설명</Label>
                    <Textarea 
                      id="description" 
                      value={selectedSection.description || ''} 
                      placeholder="섹션에 대한 상세 설명을 입력하세요" 
                      onChange={(e) => setSelectedSection((prev: any) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditSectionDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleUpdateSection}
                  disabled={!selectedSection?.vessel_no || 
                    !selectedSection?.equip_no || 
                    !selectedSection?.section_code || 
                    !selectedSection?.section_name}
                  style={{cursor: 'pointer'}}
                >수정</Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* 정비 추가 Dialog */}
          <Dialog open={isAddMaintenanceDialogOpen} onOpenChange={setIsAddMaintenanceDialogOpen}>
            <DialogContent className="max-w-4xl max-w-[50vw]">
              <DialogHeader>
                <DialogTitle>새 유지보수 작업 추가</DialogTitle>
                <DialogDescription>새로운 유지보수 작업을 추가하세요</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="plan_code">작업 코드</Label>
                  <Input 
                    id="plan_code" 
                    placeholder="작업코드를 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, plan_code: e.target.value }))}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan_name">작업명</Label>
                  <Input 
                    id="plan_name" 
                    placeholder="작업명을 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, plan_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equip_no">장비</Label>
                  <Select 
                    onValueChange={(value) => setAddMaintenance((prev: any) => ({ ...prev, equip_no: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="장비 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipments.map(eq => (
                        <SelectItem key={eq.equip_no} value={eq.equip_no}>{eq.equip_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section_code">섹션</Label>
                  <Select 
                    onValueChange={(value) => setAddMaintenance((prev: any) => ({ ...prev, section_code: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="섹션 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSections.map(section => (
                        <SelectItem key={`${section.equip_no}-${section.section_code}`} value={section.section_code || ''}>{`${section.equip_no}-${section.section_code} ${section.section_name}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">작업 주기</Label>
                  <Input 
                    id="interval" 
                    type="number" 
                    placeholder="작업주기를 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, interval: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval_term">주기 단위</Label>
                  <Select
                    onValueChange={(value) => setAddMaintenance((prev: any) => ({ ...prev, interval_term: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="단위 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOUR">HOUR</SelectItem>
                      <SelectItem value="DAY">DAY</SelectItem>
                      <SelectItem value="MONTH">MONTH</SelectItem>
                      <SelectItem value="YEAR">YEAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workers">작업 인원수</Label>
                  <Input 
                    id="workers" 
                    type="number" 
                    placeholder="작업 인원수를 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, workers: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_hours">인원별 소요시간</Label>
                  <Input 
                    id="work_hours" 
                    type="number" 
                    placeholder="인원별 소요시간을 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, work_hours: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">작업 위치</Label>
                  <Select
                    onValueChange={(value) => setAddMaintenance((prev: any) => ({ ...prev, location: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="위치 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="D">DOCK</SelectItem>
                      <SelectItem value="P">IN PORT</SelectItem>
                      <SelectItem value="S">SAILING</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">정비 담당자</Label>
                  <Input 
                    id="manager" 
                    placeholder="정비 담당자를 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, manager: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastest_date">마지막 작업일자</Label>
                  <Input 
                    id="lastest_date" 
                    type="date"
                    className='sm:w-40 md:w-36'
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, lastest_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="critical">정비 구분</Label>
                  <Select 
                    defaultValue="NORMAL"
                    onValueChange={(value) => setAddMaintenance((prev: any) => ({ ...prev, critical: value }))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">일상정비</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                      <SelectItem value="DOCK">Dock</SelectItem>
                      <SelectItem value="CMS">CMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <Checkbox 
                    id="self_maintenance" 
                    onCheckedChange ={handleSelfMaintenanceChange}
                    disabled
                  />
                  <Label htmlFor="self_maintenance">자체 정비</Label>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="instructions">정비 지시사항</Label>
                  <Textarea 
                    id="instructions" 
                    placeholder="지시사항을 입력하세요" 
                    onChange={(e) => setAddMaintenance((prev: any) => ({ ...prev, instructions: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddMaintenanceDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleInsertMaintenance}
                  disabled={!addMaintenance?.vessel_no || 
                    !addMaintenance?.equip_no || 
                    !addMaintenance?.section_code || 
                    !addMaintenance?.plan_name ||
                    !addMaintenance?.interval ||
                    !addMaintenance?.interval_term ||
                    !addMaintenance?.manager ||
                    !addMaintenance?.lastest_date}
                  style={{cursor: 'pointer'}}
                >추가</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* 정비 수정 다이얼로그 */}
          <Dialog open={isEditMaintenanceDialogOpen} onOpenChange={setIsEditMaintenanceDialogOpen}>
            <DialogContent className="max-w-2xl" draggable>
              <DialogHeader>
                <DialogTitle>유지보수 작업</DialogTitle>
                <DialogDescription>유지보수 작업 정보를 수정하세요</DialogDescription>
              </DialogHeader>
              {selectedMaintenance && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan_code">작업 코드</Label>
                    <Input 
                      id="plan_code"
                      value={selectedMaintenance.plan_code}
                      placeholder="작업코드를 입력하세요" 
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, plan_code: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan_name">작업명</Label>
                    <Input
                      id="plan_name"
                      value={selectedMaintenance.plan_name}
                      title={selectedMaintenance.plan_name || ''}
                      placeholder="작업명을 입력하세요"
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, plan_name: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equip_no">장비</Label>
                    <Select
                      value={selectedMaintenance.equip_no}
                      onValueChange={(value) => setSelectedMaintenance((prev: any) => ({ ...prev, equip_no: value }))}
                      disabled
                    >
                      <SelectTrigger className="w-full" title={getEquipmentLabel(selectedMaintenance.equip_no)}>
                        <SelectValue placeholder="장비 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipments.map(eq => (
                          <SelectItem key={eq.equip_no} value={eq.equip_no}>{eq.equip_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section_code">섹션</Label>
                    <Select
                      value={selectedMaintenance.section_code}
                      onValueChange={(value) => setSelectedMaintenance((prev: any) => ({ ...prev, section_code: value }))}
                      disabled
                    >
                      <SelectTrigger className="w-full" title={getSectionLabel(selectedMaintenance.section_code)}>
                        <SelectValue placeholder="섹션 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedSections?.map(section => (
                          <SelectItem key={`${section.equip_no}-${section.section_code}`} value={section.section_code || ''}>{`${section.equip_no}-${section.section_code} ${section.section_name}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">작업 주기</Label>
                    <Input 
                      id="interval" 
                      type="number" 
                      placeholder="작업주기를 입력하세요" 
                      value={selectedMaintenance.interval}
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, interval: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval_term">주기 단위</Label>
                    <Select
                      value={selectedMaintenance.interval_term}
                      onValueChange={(value) => setSelectedMaintenance((prev: any) => ({ ...prev, interval_term: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="단위 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOUR">HOUR</SelectItem>
                        <SelectItem value="DAY">DAY</SelectItem>
                        <SelectItem value="MONTH">MONTH</SelectItem>
                        <SelectItem value="YEAR">YEAR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workers">작업 인원수</Label>
                    <Input 
                      id="workers" 
                      type="number" 
                      placeholder="작업 인원수를 입력하세요" 
                      value={selectedMaintenance.workers}
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, workers: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work_hours">인원별 소요시간</Label>
                    <Input 
                      id="work_hours" 
                      type="number" 
                      placeholder="인원별 소요시간을 입력하세요" 
                      value={selectedMaintenance.work_hours}
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, work_hours: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">작업 위치</Label>
                    <Select
                      value={selectedMaintenance.location}
                      onValueChange={(value) => setSelectedMaintenance((prev: any) => ({ ...prev, location: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="위치 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D">DOCK</SelectItem>
                        <SelectItem value="P">IN PORT</SelectItem>
                        <SelectItem value="S">SAILING</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manager">정비 담당자</Label>
                    <Input 
                      id="manager" 
                      placeholder="정비 담당자를 입력하세요" 
                      value={selectedMaintenance.manager}
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, manager: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastest_date">마지막 작업일자</Label>
                    <Input 
                      id="lastest_date" 
                      type="date"
                      className='sm:w-40 md:w-36'
                      value={selectedMaintenance.lastest_date}
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, lastest_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="critical">정비 구분</Label>
                    <Select 
                      value={selectedMaintenance.critical}
                      onValueChange={(value) => setSelectedMaintenance((prev: any) => ({ ...prev, critical: value }))}
                      disabled
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">일상정비</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                        <SelectItem value="DOCK">Dock</SelectItem>
                        <SelectItem value="CMS">CMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <Checkbox 
                      id="self_maintenance" 
                      checked={selectedMaintenance.self_maintenance === "Y" ? true : false}
                      onCheckedChange ={handleEditSelfMaintenanceChange}
                      disabled
                    />
                    <Label htmlFor="self_maintenance">자체 정비</Label>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="instructions">정비 지시사항</Label>
                    <Textarea 
                      id="instructions" 
                      placeholder="지시사항을 입력하세요" 
                      value={selectedMaintenance.instructions || ''}
                      onChange={(e) => setSelectedMaintenance((prev: any) => ({ ...prev, instructions: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditMaintenanceDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleUpdateMaintenance}
                  disabled={!selectedMaintenance?.vessel_no || 
                    !selectedMaintenance?.equip_no || 
                    !selectedMaintenance?.section_code || 
                    !selectedMaintenance?.plan_code ||
                    !selectedMaintenance?.plan_name ||
                    !selectedMaintenance?.interval ||
                    !selectedMaintenance?.interval_term ||
                    !selectedMaintenance?.manager ||
                    !selectedMaintenance?.lastest_date}
                  style={{cursor: 'pointer'}}
                >수정</Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
