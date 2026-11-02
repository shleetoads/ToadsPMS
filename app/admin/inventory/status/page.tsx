"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Search,
  ChevronDown,
  ChevronRight,
  Wrench,
  AlertTriangle,
  Ship,
  FolderTree,
} from "lucide-react"
import { Vessel } from '@/types/common/vessel'; // ✅ interface import
import { Machine } from '@/types/common/machine';
import { Inventory } from '@/types/inventory/status/inventory'; // ✅ interface import


export default function InventoryStatusPage() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<any>(null);  
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [daily, setDaily] = useState<Inventory[]>([]);
  const [weekly, setWeekly] = useState<Inventory[]>([]);
  const [monthly, setMonthly] = useState<Inventory[]>([]);
  const [inventoryData, setInventoryData] = useState<Inventory[]>([]);
  const [inventoryFilteredData, setInventoryFilteredData] = useState<Inventory[]>(inventoryData);
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "weekly" | "monthly">("daily")
  
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [shipFilter, setShipFilter] = useState("ALL")
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const fetchVessels = () => {
    fetch(`/api/common/vessel/code`)
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

  const fetchInventory = () => {
    fetch(`/api/admin/inventory/status/${selectedPeriod}`)
      .then(res => res.json())
      .then(data => {
        switch(selectedPeriod) {
          case 'daily':
            setDaily(data);
            break;
          case 'weekly':
            setWeekly(data);
            break;
          case 'monthly':
            setMonthly(data);
            break;
        }
        setInventoryData(data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);
      
      fetchVessels();
      fetchInventory();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    fetchMachines(shipFilter);
  }, [shipFilter])

  useEffect(() => {
    try {
      switch(selectedPeriod) {
        case 'daily':
          if (daily.length === 0) {
            fetchInventory();
          }
          else {
            setInventoryData(daily);
          }
          break;
        case 'weekly':
          if (weekly.length === 0) {
            fetchInventory();
          }
          else {
            setInventoryData(weekly);
          }
          break;
        case 'monthly':
          if (monthly.length === 0) {
            fetchInventory();
          }
          else {
            setInventoryData(monthly);
          }
          break;
      }
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [selectedPeriod])

  useEffect(() => {
    let inventoryFiltered = inventoryData

    if (shipFilter !== "ALL") {
      inventoryFiltered = inventoryFiltered.filter((item) => item.vessel_no === shipFilter)
    }

    if (machineFilter !== "ALL") {
      inventoryFiltered = inventoryFiltered.reduce((acc, inventory) => {
        const filteredChildren = inventory.children.filter((material) => material.machine_name === machineFilter)

        if (filteredChildren.length > 0) {
          acc.push({
            ...inventory,
            children: filteredChildren,
          })
        }

        return acc
      }, [] as Inventory[])
    }

    if (searchTerm) {
      inventoryFiltered = inventoryFiltered.reduce((acc, inventory) => {
        const filteredChildren = inventory.children.filter((material) => 
          material.material_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.material_name?.toLowerCase().includes(searchTerm.toLowerCase()))

        if (filteredChildren.length > 0) {
          acc.push({
            ...inventory,
            children: filteredChildren,
          })
        }

        return acc
      }, [] as Inventory[])
    }

    setInventoryFilteredData(inventoryFiltered)
  }, [inventoryData, searchTerm, shipFilter, machineFilter])

  if (!userInfo) return null

  const handleShortageClick = () => {
    router.push("/admin/inventory/shortage")
  }

  const handleLossClick = () => {
    router.push("/admin/inventory/loss")
  }

  const totalShortage = (items: Inventory[]): number => {
    return items.reduce((total, item) => {
      const stockQty = item.stock_qty || 0;
      const standardQty = item.standard_qty || 0;
      total += stockQty < standardQty ? standardQty - stockQty : 0;

      return total;
    }, 0)
  }
  
  const totalLoss = (items: Inventory[]): number => {
    return items.reduce((total, item) => {
      total += item.loss_qty || 0;

      return total;
    }, 0)
  }
  
  let shortageCount = 0;
  let lossCount = 0;
  if(inventoryFilteredData.length > 0) {
    shortageCount = inventoryFilteredData.reduce((sum, vessel) => sum + totalShortage(vessel.children), 0)
    lossCount = inventoryFilteredData.reduce((sum, vessel) => sum + totalLoss(vessel.children), 0)
  }

  const getTableHeaders = () => {
    const headers = []
    headers.push(
      { key: "machine_name", label: "장비", align: "text-left" },
      { key: "material_code", label: "부품코드", align: "text-left" },
      { key: "material_name", label: "부품명", align: "text-left" },
      { key: "receive_qty", label: "입고", align: "text-center" },
      { key: "release_qty", label: "출고", align: "text-center" },
      { key: "loss_qty", label: "손망실", align: "text-center" },
      { key: "stock_qty", label: "재고", align: "text-center" },
      { key: "material_unit", label: "단위", align: "text-center" },
      { key: "period", label: "기간", align: "text-center" },
    )
    return headers
  }

  const getTableCells = (item: any, index: number) => {
    const cells = []

    cells.push(
      <td key="machine_name" className="py-3 text-gray-600">
        {item.machine_name}
      </td>,
      <td key="material_code" className="py-3 text-gray-600">
        {item.material_code}
      </td>,
      <td key="material_name" className="py-3 text-gray-600">
        {item.material_name}
      </td>,
      <td key="receive_qty" className="py-3 text-center font-bold text-green-600">
        +{item.receive_qty}
      </td>,
      <td key="release_qty" className="py-3 text-center font-bold text-red-600">
        -{item.release_qty}
      </td>,
      <td key="loss_qty" className="py-3 text-center font-bold text-orange-600">
        -{item.loss_qty}
      </td>,
      <td key="stock_qty" className="py-3 text-center font-bold text-blue-600">
        {item.stock_qty}
      </td>,
      <td key="material_unit" className="py-3 text-center">
        {item.material_unit}
      </td>,
      <td key="period" className="py-3 text-center">
        {item.period}
      </td>,
    )

    return cells
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

  const renderInventoryTree = (items: Inventory[], level = 0) => {
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
                    <Wrench className="w-5 h-5 text-orange-600" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{`${item.name}`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {item.children && item.children.length > 0 && item.type !== "MACHINE" && (
            <CollapsibleContent>
              <div className="ml-4 border-l-2 border-gray-200 pl-4">
                {renderInventoryTree(item.children, level + 1)}
              </div>
            </CollapsibleContent>
          )}

          {item.children && item.children.length > 0 && item.type === "MACHINE" && (
            <CollapsibleContent>
              <div className="ml-4 border-l-2 border-gray-200 pl-4">
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
                      {item.children.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          {getTableCells(item, index)}
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">재고 현황</h2>
                  <p className="text-gray-600">선박별, 장비별, 부품별 재고 현황을 확인합니다</p>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedPeriod}
                    onValueChange={(value: "daily" | "weekly" | "monthly") => setSelectedPeriod(value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">일일</SelectItem>
                      <SelectItem value="weekly">주간</SelectItem>
                      <SelectItem value="monthly">월간</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50"
                  onClick={handleShortageClick}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-red-600 font-medium">부족 부품</p>
                        <p className="text-2xl font-bold text-red-700 tabular-nums truncate">{shortageCount}개</p>
                        <p className="text-xs text-red-500">최소 보유 수량 미달</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 bg-orange-50"
                  onClick={handleLossClick}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-orange-600 font-medium">손망실 부품</p>
                        <p className="text-2xl font-bold text-orange-700 tabular-nums truncate">{lossCount}건</p>
                        <p className="text-xs text-orange-500">최근 손망실 발생</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-orange-500 shrink-0" />
                    </div>
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
                    <Select value={shipFilter} onValueChange={setShipFilter}>
                      <SelectTrigger className="w-40">
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
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="부품코드로 검색..."
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

              <div className="space-y-2">{renderInventoryTree(inventoryFilteredData)}</div>
              
              {inventoryFilteredData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FolderTree className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>조건에 맞는 재고가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
