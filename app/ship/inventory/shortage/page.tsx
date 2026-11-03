"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Package, Search, BarChart3, TrendingUp, TrendingDown, Home } from "lucide-react"

// Mock data for shortage parts
const mockShortageData = [
  {
    shipId: "SHIP-001",
    shipName: "한국호",
    equipmentId: "ENG-001",
    equipmentName: "주엔진",
    partId: "PART-001",
    partName: "피스톤 링",
    partCode: "PR-001",
    currentStock: 5,
    minStock: 10,
    shortage: 5,
    unit: "개",
    priority: "높음",
    lastUsed: "2024-01-15",
    supplier: "현대중공업",
    estimatedCost: 150000,
  },
  {
    shipId: "SHIP-001",
    shipName: "한국호",
    equipmentId: "ENG-002",
    equipmentName: "보조엔진",
    partId: "PART-003",
    partName: "연료 필터",
    partCode: "FF-001",
    currentStock: 2,
    minStock: 5,
    shortage: 3,
    unit: "개",
    priority: "중간",
    lastUsed: "2024-01-13",
    supplier: "만엔진",
    estimatedCost: 80000,
  },
]

export default function ShipInventoryShortagePage() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [activeMenu, setActiveMenu] = useState("shortage")
  const [searchTerm, setSearchTerm] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all")

  useEffect(() => {
    try {
      const user = requireAuth("ship")
      setUserInfo(user)
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  if (!userInfo) return null

  const handleMenuClick = (menu: string) => {
    setActiveMenu(menu)
    if (menu === "dashboard") {
      router.push("/ship/dashboard")
    } else if (menu === "status") {
      router.push("/ship/inventory")
    } else if (menu === "receiving") {
      router.push("/ship/inventory")
    } else if (menu === "outgoing") {
      router.push("/ship/inventory/outgoing")
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "높음":
        return <Badge variant="destructive">높음</Badge>
      case "중간":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            중간
          </Badge>
        )
      case "낮음":
        return <Badge variant="secondary">낮음</Badge>
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  const filteredShortageData = mockShortageData.filter((item) => {
    const matchesSearch =
      item.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.partCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.equipmentName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter
    const matchesEquipment = equipmentFilter === "all" || item.equipmentId === equipmentFilter
    return matchesSearch && matchesPriority && matchesEquipment
  })

  const totalShortage = mockShortageData.length
  const highPriorityCount = mockShortageData.filter((item) => item.priority === "높음").length
  const totalEstimatedCost = mockShortageData.reduce((sum, item) => sum + item.estimatedCost * item.shortage, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {/* Inventory Sidebar Menu */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">재고 관리</h2>
            </div>
            <nav className="space-y-2">
              <button
                onClick={() => handleMenuClick("dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                  activeMenu === "dashboard"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Home className="w-4 h-4" />
                대시보드
              </button>
              <button
                onClick={() => handleMenuClick("status")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                  activeMenu === "status"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                재고현황
              </button>
              <button
                onClick={() => handleMenuClick("receiving")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                  activeMenu === "receiving"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                부품입고
              </button>
              <button
                onClick={() => handleMenuClick("outgoing")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                  activeMenu === "outgoing"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                부품출고
              </button>
            </nav>
          </div>
        </div>

        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">부족 부품 현황</h1>
                <p className="text-gray-600">재고가 부족한 부품들을 확인하고 관리합니다</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-600">총 부족 부품</p>
                      <p className="text-2xl font-bold text-red-600 tabular-nums truncate">{totalShortage}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-600">높은 우선순위</p>
                      <p className="text-2xl font-bold text-orange-600 tabular-nums truncate">{highPriorityCount}</p>
                    </div>
                    <Package className="w-8 h-8 text-orange-500 shrink-0" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-600">예상 구매 비용</p>
                      <p className="text-2xl font-bold text-blue-600 tabular-nums truncate">₩{totalEstimatedCost.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-500 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="부품명, 부품코드, 장비명으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="장비 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 장비</SelectItem>
                      <SelectItem value="ENG-001">주엔진</SelectItem>
                      <SelectItem value="ENG-002">보조엔진</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="우선순위" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="높음">높음</SelectItem>
                      <SelectItem value="중간">중간</SelectItem>
                      <SelectItem value="낮음">낮음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Shortage List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  부족 부품 목록
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3">장비명</th>
                        <th className="text-left py-3">부품명</th>
                        <th className="text-left py-3">부품코드</th>
                        <th className="text-center py-3">현재재고</th>
                        <th className="text-center py-3">최소재고</th>
                        <th className="text-center py-3">부족수량</th>
                        <th className="text-center py-3">단위</th>
                        <th className="text-center py-3">우선순위</th>
                        <th className="text-left py-3">공급업체</th>
                        <th className="text-right py-3">예상비용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShortageData.map((item) => (
                        <tr key={`${item.shipId}-${item.partId}`} className="border-b hover:bg-gray-50">
                          <td className="py-3 font-medium">{item.equipmentName}</td>
                          <td className="py-3">{item.partName}</td>
                          <td className="py-3 text-gray-600">{item.partCode}</td>
                          <td className="py-3 text-center font-medium text-red-600">{item.currentStock}</td>
                          <td className="py-3 text-center">{item.minStock}</td>
                          <td className="py-3 text-center font-bold text-red-600">{item.shortage}</td>
                          <td className="py-3 text-center">{item.unit}</td>
                          <td className="py-3 text-center">{getPriorityBadge(item.priority)}</td>
                          <td className="py-3">{item.supplier}</td>
                          <td className="py-3 text-right font-medium">
                            ₩{(item.estimatedCost * item.shortage).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredShortageData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm">조건에 맞는 부족 부품이 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
