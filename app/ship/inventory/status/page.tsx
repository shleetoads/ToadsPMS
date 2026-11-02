"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Package, Search } from "lucide-react"
import { Machine } from '@/types/inventory/status/machine'; // ✅ interface import
import { Inventory } from '@/types/inventory/status/inventory'; // ✅ interface import

export default function ShipInventoryStatusPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [machines, setMachines] = useState<Inventory[]>([])

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMachine, setSelectedMachine] = useState<string>("")
  const [selectedMachineData, setSelectedMachineData] = useState<Inventory>()
  const [filteredMaterials, setFilteredMaterials] = useState<Inventory[]>([])

  const fetchStatus = (vesselNo: string) => {
    fetch(`/api/ship/inventory/status?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)
      
      fetchStatus(user.ship_no)
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = machines

    if (!selectedMachine) {
      setSelectedMachine(machines[0]?.machine_name || '')
      return;
    }

    if (searchTerm || selectedMachine) {
      const selectedMachineData = filtered.find((machine) => machine.machine_name === selectedMachine)
      const filteredMaterials =
        selectedMachineData?.children.filter(
          (stock) =>
            stock.material_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.material_name?.toLowerCase().includes(searchTerm.toLowerCase()),
        ) || []

      setSelectedMachineData(selectedMachineData)
      setFilteredMaterials(filteredMaterials)
    }
  }, [machines, selectedMachine, searchTerm])

  if (!userInfo) return null

  const getStatusBadge = (stockQty: number, standardQty: number) => {
    if (stockQty < standardQty){
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          부족
        </Badge>
      )
    }
    else {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          정상
        </Badge>
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />

        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">재고 현황</h1>
                <p className="text-gray-600">{userInfo.ship_name}의 장비별 부품 재고 현황을 조회합니다</p>
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
                        onClick={() => setSelectedMachine(machine.machine_name || '')}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                          selectedMachine === machine.machine_name
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-transparent"
                        }`}
                        style={{cursor:'pointer'}}
                      >
                        <div className="font-medium">{machine.machine_name}</div>
                        <div className="text-sm text-gray-500">{machine.children.length}개 부품</div>
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
                      {selectedMachineData?.machine_name} 부품 목록
                    </CardTitle>
                    <div className="flex gap-2">
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
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedMachineData ? (
                    <div className="overflow-auto max-h-[calc(100vh-350px)]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white border-b">
                          <tr>
                            <th className="text-left py-3 px-2">부품명</th>
                            <th className="text-center py-3 px-2">부품코드</th>
                            <th className="text-center py-3 px-2">현재재고</th>
                            <th className="text-center py-3 px-2">최소재고</th>
                            <th className="text-center py-3 px-2">단위</th>
                            <th className="text-left py-3 px-2">보관위치</th>
                            <th className="text-center py-3 px-2">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMaterials.map((material) => (
                            <tr key={material.material_code} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-2 font-medium">{material.material_name}</td>
                              <td className="py-3 px-2 text-center text-gray-600">{material.material_code}</td>
                              <td className="py-3 px-2 text-center font-medium">{material.stock_qty}</td>
                              <td className="py-3 px-2 text-center text-gray-600">{material.standard_qty}</td>
                              <td className="py-3 px-2 text-center">{material.material_unit}</td>
                              <td className="py-3 px-2">{material.warehouse_name}</td>
                              <td className="py-3 px-2  text-center">{getStatusBadge(material.stock_qty || 0, material.standard_qty || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredMaterials.length === 0 && (
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
          </div>
        </main>
      </div>
    </div>
  )
}
