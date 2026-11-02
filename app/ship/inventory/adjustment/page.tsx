"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Package, Search, Edit } from "lucide-react"
import { Machine } from '@/types/inventory/adjustment/machine'; // ✅ interface import
import { Stock } from '@/types/inventory/adjustment/stock'; // ✅ interface import
import { Adjustment } from '@/types/inventory/adjustment/adjustment'; // ✅ interface import

export default function InventoryAdjustmentPage() {
  const initialAdjustment : Adjustment = {
    vessel_no: "",
    vessel_name: "",
    adjustment_no: "",
    machine_name: "",
    material_code: "",
    material_name: "",
    adjustment_date: "",
    adjustment_type: "",
    adjustment_qty: 0,
    adjustment_unit: "",
    adjustment_location: "",
    adjustment_location_name: "",
    adjustment_reason: "",
    adjustment_remark: "",
    stock_qty: 0,
    registrant: "",
    regist_date: "",
    regist_user: "",
    modify_date: "",
    modify_user: ""
  }

  const [userInfo, setUserInfo] = useState<any>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMachine, setSelectedMachine] = useState<string>("")

  const [addAdjustment, setAddAdjustment] = useState<Adjustment>(initialAdjustment)
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [selectedMachineData, setSelectedMachineData] = useState<Machine>()
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([])

  const fetchStocks = (vesselNo: string) => {
    fetch(`/api/ship/inventory/adjustment/stock/?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)
      
      fetchStocks(user.ship_no)
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = machines

    if (selectedMachine) {
      const selectedMachineData = filtered.find((machine) => machine.machine_name === selectedMachine)
      const filteredStocks =
        selectedMachineData?.stocks.filter(
          (stock) =>
            stock.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.material_name.toLowerCase().includes(searchTerm.toLowerCase()),
        ) || []

      setSelectedMachineData(selectedMachineData)
      setFilteredStocks(filteredStocks)
    }
  }, [machines, searchTerm, selectedMachine])

  if (!userInfo) return null

  const getDifferenceBadge = (systemStock: number, actualStock: number) => {
    const actualStockNum = typeof actualStock === "string" ? Number.parseInt(actualStock) || 0 : actualStock
    const diff = actualStockNum - systemStock
    if (diff === 0) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          일치
        </Badge>
      )
    } else if (diff > 0) {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800">
          +{diff}
        </Badge>
      )
    } else {
      return <Badge variant="destructive">-{Math.abs(diff)}</Badge>
    }
  }

  const handleAdjustment = (item: any) => {
    setSelectedMaterial({ ...item })
    setAddAdjustment((prev: any) => ({
      ...prev,
      vessel_no: item.vessel_no,
      vessel_name: item.vessel_name,
      machine_name: item.machine_name,
      material_code: item.material_code,
      material_name: item.naterial_name,
      adjustment_unit: item.material_unit,
      adjustment_type: "",
      stock_qty: item.stock_qty,
      adjustment_qty: 0,
      adjustment_location: item.location,
      adjustment_reason: "",
      adjustment_date: new Date().toISOString().split("T")[0]
    }))
    setIsAdjustDialogOpen(true)
  }

  const updatedMachines = (item: any) => {
    const updatedMachines = machines.map(machine => {
      if (machine.machine_name === item.machine_name) {
        const updatedStocks = machine.stocks.map(stock => {
          if (stock.material_code === item.material_code && stock.location === item.adjustment_location) {
            const adjustmentQty = (stock.adjustment_qty + ((item.adjustment_type === 'AI'? 1 : -1) * item.adjustment_qty))

            return {
              ...stock,
              actual_qty: stock.stock_qty + adjustmentQty,
              adjustment_qty: adjustmentQty
            }
          }
          return stock
        })

        return {
          ...machine,
          stocks: updatedStocks
        }
      }
      return machine
    })

    setMachines(updatedMachines);
  }

  const handleSaveAdjustment = async () => {
    if (addAdjustment.adjustment_qty > addAdjustment.stock_qty) {
      alert("재고 조정 수량을 잘못 입력하였습니다.")
      return;
    }

    if (confirm("재고 조정 정보를 저장하시겠습니까?")) {
      const insertedData = {
        ...addAdjustment,
        regist_user: userInfo.account_no,
        modify_user: userInfo.account_no,
      };

      const res = await fetch('/api/ship/inventory/adjustment/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("재고 조정이 완료되었습니다.")

        updatedMachines(addAdjustment);
        setIsAdjustDialogOpen(false);
      } else {
        alert(data.message);
      }
    }
  }

  const tableHeaders = [
    { key: "partName", label: "부품명", align: "text-left" },
    { key: "partCode", label: "부품코드", align: "text-left" },
    { key: "systemStock", label: "시스템 재고", align: "text-center" },
    { key: "difference", label: "재고 조정", align: "text-center" },
    { key: "actualStock", label: "실제 재고", align: "text-center" },
    { key: "unit", label: "단위", align: "text-center" },
    { key: "location", label: "보관위치", align: "text-left" },
    { key: "lastAdjustment", label: "최종 조정일", align: "text-center" },
    { key: "action", label: "조정", align: "text-center" },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />

        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">재고 조정</h1>
                <p className="text-gray-600">{userInfo.ship_name}의 실제 재고와 시스템 재고를 조정합니다</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-200px)]">
              <Card className="w-full lg:w-80 shrink-0 max-h-[40vh] lg:max-h-none overflow-y-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    장비 목록
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {machines.map((machine) => (
                      <button
                        key={machine.machine_name}
                        onClick={() => setSelectedMachine(machine.machine_name)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                          selectedMachine === machine.machine_name
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-transparent"
                        }`}
                        style={{cursor:'pointer'}}
                      >
                        <div className="font-medium">{machine.machine_name}</div>
                        <div className="text-sm text-gray-500">{machine.stocks?.length}개 부품</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 min-w-0">
                <CardHeader>
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      {selectedMachineData?.machine_name} 재고 조정
                    </CardTitle>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="부품명 또는 부품코드로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full sm:w-64"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedMachineData ? (
                    <div className="overflow-auto max-h-[calc(100vh-350px)]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white border-b">
                          <tr>
                            {tableHeaders.map((header) => (
                              <th key={header.key} className={`${header.align} py-3 px-2`}>
                                {header.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStocks.map((stock, index) => (
                            <tr key={`${stock.material_code}-${index}`} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-2 font-medium">{stock.material_name} {getDifferenceBadge(stock.stock_qty, stock.actual_qty)} </td>
                              <td className="py-3 px-2 text-gray-600">{stock.material_code}</td>
                              <td className="py-3 px-2 text-center font-medium">{stock.stock_qty}</td>
                              <td className="py-3 px-2 text-center">{stock.adjustment_qty}</td>
                              <td className="py-3 px-2 text-center">{stock.actual_qty}</td>
                              <td className="py-3 px-2 text-center">{stock.material_unit}</td>
                              <td className="py-3 px-2 text-center">{stock.location_name}</td>
                              <td className="py-3 px-2 text-center text-gray-500">{stock.last_adjustment}</td>
                              <td className="py-3 px-2 text-center">
                                <Button
                                  onClick={() => handleAdjustment(stock)}
                                  size="sm"
                                  variant="outline"
                                  style={{cursor:'pointer'}}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredStocks.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {searchTerm ? "검색 결과가 없습니다." : "부품이 없습니다."}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">왼쪽에서 장비를 선택해주세요.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Adjustment Dialog */}
            {selectedMaterial && (
              <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>재고 조정</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>장비</Label>
                      <Input value={selectedMaterial.machine_name} disabled className="bg-gray-50" />
                    </div>
                    <div>
                      <Label>부품명</Label>
                      <Input value={selectedMaterial.material_name} disabled className="bg-gray-50" />
                    </div>
                    <div>
                      <Label>부품코드</Label>
                      <Input value={selectedMaterial.material_code} disabled className="bg-gray-50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>재고 수량</Label>
                        <Input value={selectedMaterial.actual_qty} disabled className="bg-gray-50" />
                      </div>
                      <div>
                        <Label>재고 조정 유형 *</Label>
                        <Select 
                          value={addAdjustment.adjustment_type} 
                          onValueChange={(value) => setAddAdjustment({ ...addAdjustment, adjustment_type: value })}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AI">입고</SelectItem>
                            <SelectItem value="AO">출고</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>재고 조정 *</Label>
                        <Input
                          type="number"
                          value={addAdjustment.adjustment_qty}
                          min={0}
                          max={selectedMaterial.actual_qty}
                          onChange={(e) => setAddAdjustment({ ...addAdjustment, adjustment_qty: Number.parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>조정 일자</Label>
                        <Input
                          type="date"
                          className='sm:w-40 md:w-36'
                          value={addAdjustment.adjustment_date}
                          onChange={(e) => setAddAdjustment({ ...addAdjustment, adjustment_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>조정 사유 *</Label>
                      <Textarea
                        value={addAdjustment.adjustment_reason}
                        onChange={(e) => setAddAdjustment({ ...addAdjustment, adjustment_reason: e.target.value })}
                        placeholder="재고 조정 사유를 입력해주세요 (필수)"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)} style={{cursor:'pointer'}}>
                      취소
                    </Button>
                    <Button 
                      onClick={handleSaveAdjustment}
                      disabled={!addAdjustment.adjustment_date ||
                        !addAdjustment.adjustment_type ||
                        !addAdjustment.adjustment_qty ||
                        !addAdjustment.adjustment_reason}
                      style={{cursor:'pointer'}}
                    >조정 완료</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
