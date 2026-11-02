"use client"

import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp, BarChart3, Package } from "lucide-react"
import { Machine } from '@/types/inventory/status/machine'; // ✅ interface import

// Mock data for ship inventory
const mockShipInventoryData = {
  shipId: "SHIP-001",
  shipName: "한국호",
  equipment: [
    {
      equipmentId: "ENG-001",
      equipmentName: "주엔진",
      parts: [
        {
          partId: "PART-001",
          partName: "피스톤 링",
          partCode: "PR-001",
          currentStock: 5,
          minStock: 10,
          unit: "개",
          status: "부족",
          lastUpdated: "2024-01-15",
          supplier: "현대중공업",
          location: "창고 A-1",
        },
        {
          partId: "PART-002",
          partName: "실린더 라이너",
          partCode: "CL-001",
          currentStock: 15,
          minStock: 8,
          unit: "개",
          status: "정상",
          lastUpdated: "2024-01-14",
          supplier: "두산엔진",
          location: "창고 A-2",
        },
      ],
    },
    {
      equipmentId: "ENG-002",
      equipmentName: "보조엔진",
      parts: [
        {
          partId: "PART-003",
          partName: "연료 필터",
          partCode: "FF-001",
          currentStock: 2,
          minStock: 5,
          unit: "개",
          status: "부족",
          lastUpdated: "2024-01-13",
          supplier: "만엔진",
          location: "창고 B-1",
        },
      ],
    },
    {
      equipmentId: "NAV-001",
      equipmentName: "GPS 시스템",
      parts: [
        {
          partId: "PART-004",
          partName: "GPS 안테나",
          partCode: "GPS-ANT-001",
          currentStock: 3,
          minStock: 2,
          unit: "개",
          status: "정상",
          lastUpdated: "2024-01-12",
          supplier: "후루노",
          location: "창고 C-1",
        },
      ],
    },
  ],
}

export default function ShipInventoryPage() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [shortageMachine, setShortageMachine] = useState<Machine[]>(machines)

  const fetchStatus = (vesselNo: string) => {
    fetch(`/api/ship/inventory?vesselNo=${vesselNo}`)
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

    if (filtered) {
      const shortageMachine = machines.map((machine) => ({
        ...machine,
        children: machine.children,
      }))
      .filter((machine) => machine.children.length > 0)

      setShortageMachine(shortageMachine)
    }
  }, [machines])

  if (!userInfo) return null

  const shortageCount = machines.reduce(
    (total, machine) => total + machine.children.length,
    0,
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />

        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">재고 관리 대시보드</h1>
                <p className="text-gray-600">{userInfo.ship_name}의 부품 재고를 관리합니다</p>
              </div>
            </div>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  부족 부품 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-red-700">총 부족 부품 수</span>
                    <Badge variant="destructive" className="text-lg px-3 py-1">
                      {shortageCount}개
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">장비별 부족 부품</h4>
                    {shortageMachine.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {shortageMachine.map((machine) => (
                          <Card key={machine.machine_name} className="border border-red-200">
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <h5 className="font-medium text-gray-900 truncate min-w-0">{machine.machine_name}</h5>
                                  <Badge variant="destructive" className="text-xs shrink-0">
                                    {machine.children.length}개 부족
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  {machine.children.map((material) => (
                                    <div key={material.material_code} className="flex justify-between items-center text-sm gap-2">
                                      <span className="text-gray-700 truncate min-w-0">{material.material_name}</span>
                                      <span className="text-red-600 font-medium shrink-0 tabular-nums">
                                        {material.stock_qty}/{material.standard_qty} {material.material_unit}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>부족한 부품이 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/ship/inventory/status")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">재고 현황</h3>
                      <p className="text-sm text-gray-600">모든 부품의 재고 상태를 확인합니다</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/ship/inventory/receiving")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">부품 입고</h3>
                      <p className="text-sm text-gray-600">새로운 부품을 입고 등록합니다</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
