"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Package,
  Plus,
  Trash2,
  Save,
  CheckCircle,
} from "lucide-react"
import { Warehouse } from '@/types/common/warehouse'; // ✅ interface import
import { Machine } from '@/types/inventory/receive/machine'; // ✅ interface import
import { Receive } from '@/types/inventory/receive/receive'; // ✅ interface import

export default function PartsReceivingPage() {
  const initialReceive: Receive = {
    vessel_no: "",
    receive_no: "",
    material_code: "",
    receive_date: "",
    receive_type: "",
    receive_unit: "",
    receive_qty: 0,
    delivery_location: "",
    receive_reason: "",
    receive_remark: "",
    regist_date: "",
    regist_user: "",
    modify_date: "",
    modify_user: "",
    receive_location: ""
  }

  const [userInfo, setUserInfo] = useState<any>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [todayReceivings, setTodayReceivings] = useState<any[]>([])
  const [receivingData, setReceivingData] = useState({
    vessel_no: "",
    receive_date: new Date().toISOString().split("T")[0],
    delivery_location: "",
    materials: [] as any[],
  })
  
  const fetchWarehouses = (vesselNo: string) => {
    fetch(`/api/common/warehouse/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setWarehouses(data))
      .catch(err => console.error(err));
  };
  
  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/ship/inventory/receive/machine?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)

      fetchWarehouses(user.ship_no)
      fetchMachines(user.ship_no)

      setReceivingData((prev) => ({
        ...prev,
        vessel_no: user.ship_no,
      }))
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  if (!userInfo) return null

  const addPartToReceiving = () => {
    setReceivingData((prev) => ({
      ...prev,
      materials: [...prev.materials, { initialReceive }],
    }))
  }

  const removePartFromReceiving = (index: number) => {
    setReceivingData((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }))
  }

  const updateReceivingMaterial = (index: number, field: string, value: string) => {
    setReceivingData((prev) => ({
      ...prev,
      materials: prev.materials.map((material, i) => (i === index ? { ...material, [field]: value } : material)),
    }))
  }

  const getAvailablePartsForMachine = (machineName: string) => {
    const machine = machines.find((e) => e.machine_name === machineName)
    return machine ? machine.materials : []
  }

  const handleSaveReceiving = async () => {
    const insertedData = {
      ...receivingData,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/inventory/receive/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const data = await res.json();

    if (data.success) {
      setTodayReceivings((prev) => [...prev, receivingData])
      setShowSuccessDialog(true)

      setReceivingData((prev) => ({
        ...prev,
        materials: [],
        remark: "",
      }))
    } else {
      alert(data.message);
    }
  }

  const getTodayReceivingSummary = () => {
    const summary: {
      [key: string]: { machine_name: string; totalMaterials: number; totalQuantity: number; materials: any[] }
    } = {}

    todayReceivings.forEach((receiving) => {
      receiving.materials.forEach((material: any) => {
        const machine = machines.find((e) => e.machine_name === material.machine_name)
        const materialInfo = machine?.materials.find((p) => p.material_code === material.material_code)

        if (machine && materialInfo) {
          if (!summary[material.machine_name]) {
            summary[material.machine_name] = {
              machine_name: machine.machine_name,
              totalMaterials: 0,
              totalQuantity: 0,
              materials: [],
            }
          }

          summary[material.machine_name].totalMaterials += 1
          summary[material.machine_name].totalQuantity += Number.parseInt(material.receive_qty || "0")
          summary[material.machine_name].materials.push({
            material_name: materialInfo.material_name,
            material_code: materialInfo.material_code,
            receive_qty: material.receive_qty,
            receive_unit: materialInfo.material_unit,
          })
        }
      })
    })

    return summary
  }

  const isReceivingDataValid = () => {
    if (!receivingData.delivery_location.trim()) return false

    const partsWithData = receivingData.materials.filter((material) => material.machine_name || material.material_code || material.receive_qty)

    if (partsWithData.length === 0) return false

    return partsWithData.every(
      (material) =>
        material.machine_name || material.material_code || material.receive_qty && material.receive_location && Number.parseInt(material.receive_qty) > 0,
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">부품 입고 등록</h1>
                <p className="text-gray-600">{userInfo.ship_name}의 부품 입고를 등록합니다</p>
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>입고 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="receive-date">입고 일자</Label>
                      <Input
                        id="receive-date"
                        type="date"
                        className='sm:w-40 md:w-36'
                        value={receivingData.receive_date}
                        onChange={(e) => setReceivingData((prev) => ({ ...prev, receive_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplier">납품처</Label>
                      <Input
                        id="supplier"
                        placeholder="납품처명을 입력하세요"
                        value={receivingData.delivery_location}
                        onChange={(e) => setReceivingData((prev) => ({ ...prev, delivery_location: e.target.value }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>입고 부품 목록</CardTitle>
                    <Button type="button" onClick={addPartToReceiving} size="sm" variant="outline" style={{cursor:'pointer'}}>
                      <Plus className="w-4 h-4 mr-1" />
                      부품 추가
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {receivingData.materials.map((material, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">부품 #{index + 1}</h4>
                            <Button
                              type="button"
                              onClick={() => removePartFromReceiving(index)}
                              size="sm"
                              variant="ghost"
                              style={{cursor:'pointer'}}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">장비</Label>
                              <Select
                                value={material.equipmentId}
                                onValueChange={(value) => updateReceivingMaterial(index, "machine_name", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="장비 선택" />
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
                            <div>
                              <Label className="text-sm">부품</Label>
                              <Select
                                value={material.material_code}
                                onValueChange={(value) => updateReceivingMaterial(index, "material_code", value)}
                                disabled={!material.machine_name}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="부품 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAvailablePartsForMachine(material.machine_name).map((availablePart) => (
                                    <SelectItem key={availablePart.material_code} value={availablePart.material_code}>
                                      {availablePart.material_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">입고 창고</Label>
                              <Select
                                value={material.receive_location}
                                onValueChange={(value) => updateReceivingMaterial(index, "receive_location", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="창고 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {warehouses.map((warehouse) => (
                                    <SelectItem key={warehouse.warehouse_no} value={warehouse.warehouse_no}>
                                      {warehouse.warehouse_name} ({warehouse.warehouse_location})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">입고 수량</Label>
                              <Input
                                type="number"
                                placeholder="수량"
                                value={material.receive_qty}
                                className="w-full sm:w-32"
                                onChange={(e) => updateReceivingMaterial(index, "receive_qty", e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">단위</Label>
                              <Input
                                value={
                                  material.material_code
                                    ? getAvailablePartsForMachine(material.machine_name).find(
                                        (p) => p.material_code === material.material_code,
                                      )?.material_unit || ""
                                    : ""
                                }
                                disabled
                                className="w-30 bg-gray-50"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">현재 재고</Label>
                              <Input
                                value={
                                  material.material_code
                                    ? getAvailablePartsForMachine(material.machine_name).find(
                                        (p) => p.material_code === material.material_code,
                                      )?.stock_qty || 0
                                    : 0
                                }
                                disabled
                                className="w-30 bg-gray-50"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm">비고</Label>
                            <Input
                              placeholder="이 부품에 대한 비고..."
                              value={material.receive_remark}
                              onChange={(e) => updateReceivingMaterial(index, "receive_remark", e.target.value)}
                            />
                          </div>
                        </div>
                      </Card>
                    ))}

                    {receivingData.materials.length === 0 && (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-sm">입고할 부품이 없습니다</p>
                        <p className="text-xs">부품 추가 버튼을 클릭하여 입고 부품을 등록하세요</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button
                  onClick={handleSaveReceiving}
                  disabled={!isReceivingDataValid()}
                  className="bg-blue-600 hover:bg-blue-700"
                  style={{cursor:'pointer'}}
                >
                  <Save className="w-4 h-4 mr-2" />
                  입고 등록
                </Button>
              </div>

              {todayReceivings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      최근 입고 현황
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(getTodayReceivingSummary()).map(([machine_name, summary]) => (
                        <Card key={machine_name} className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">{summary.machine_name}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">총 부품 종류</span>
                              <span className="font-semibold">{summary.totalMaterials}종</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">총 입고 수량</span>
                              <span className="font-semibold">{summary.totalQuantity}개</span>
                            </div>
                            <div className="border-t pt-3">
                              <p className="text-xs text-gray-500 mb-2">입고 부품 목록</p>
                              <div className="space-y-1">
                                {summary.materials.map((material, index) => (
                                  <div key={index} className="flex justify-between text-xs">
                                    <span className="truncate">{material.material_name}</span>
                                    <span className="text-gray-600">
                                      {material.receive_qty}
                                      {material.receive_unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              입고 등록 완료
            </DialogTitle>
            <DialogDescription>
              부품 입고가 성공적으로 등록되었습니다.
              하단에서 최근 입고 현황을 확인하실 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setShowSuccessDialog(false)} style={{cursor:'pointer'}}>확인</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
