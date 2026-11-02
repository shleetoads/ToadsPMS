"use client"

import { useEffect, useState } from "react"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Search, Package, Calendar } from "lucide-react"
import { Vessel as VesselCode } from '@/types/common/vessel'; // ✅ interface import
import { Inventory } from '@/types/inventory/status/inventory'; // ✅ interface import

export default function ShortagePage() {
  const [userInfo, setUserInfo] = useState<any>(null);  
  const [vesselCodes, setVesselCodes] = useState<VesselCode[]>([])
  const [shortageData, setShortageData] = useState<Inventory[]>([]);
  const [filteredData, setFilteredData] = useState<Inventory[]>(shortageData)
  const [selectedVessel, setSelectedVessel] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  
  const fetchVesselCodes = () => {
    fetch(`/api/common/vessel/code`)
      .then(res => res.json())
      .then(data => setVesselCodes(data))
      .catch(err => console.error(err));
  };

  const fetchShortage = () => {
    fetch(`/api/admin/inventory/shortage`)
      .then(res => res.json())
      .then(data => {
        setShortageData(data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchVesselCodes();
      fetchShortage();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = shortageData

    if (selectedVessel) {
      filtered = filtered.filter(item => 
        (selectedVessel === "all" || item.vessel_no === selectedVessel) && 
        (item.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.material_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.material_name?.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    setFilteredData(filtered)
  }, [shortageData, selectedVessel, searchTerm])

  if (!userInfo) return null

  const totalShortage = filteredData.reduce((sum, item) => sum + item.shortage_qty, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">부족 부품 현황</h1>
                <p className="text-gray-600">최소 보유 수량 미달 부품을 관리합니다</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="transition-shadow border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-600">총 부족 부품</p>
                        <p className="text-2xl font-bold text-red-600 tabular-nums truncate">{filteredData.length}개</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="transition-shadow border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-600">총 부족 수량</p>
                        <p className="text-2xl font-bold text-orange-600 tabular-nums truncate">{totalShortage}개</p>
                      </div>
                      <Package className="w-8 h-8 text-orange-500 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">필터 및 검색</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4">
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
                    <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="전체 선박" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 선박</SelectItem>
                        {vesselCodes.map((vessel) => (
                          <SelectItem key={vessel.vessel_no} value={vessel.vessel_no}>
                            {vessel.vessel_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

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
                          <th className="text-left py-3">선박</th>
                          <th className="text-left py-3">장비</th>
                          <th className="text-left py-3">부품명</th>
                          <th className="text-left py-3">부품코드</th>
                          <th className="text-center py-3">현재재고</th>
                          <th className="text-center py-3">최소수량</th>
                          <th className="text-center py-3">부족수량</th>
                          <th className="text-center py-3">단위</th>
                          <th className="text-left py-3">최종사용일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item) => (
                          <tr key={item.material_code} className="border-b hover:bg-gray-50">
                            <td className="py-3 font-medium text-blue-600">{item.vessel_name}</td>
                            <td className="py-3 text-gray-600">{item.machine_name}</td>
                            <td className="py-3 font-medium">{item.material_name}</td>
                            <td className="py-3 text-gray-600">{item.material_code}</td>
                            <td className="py-3 text-center font-bold text-red-600">{item.stock_qty}</td>
                            <td className="py-3 text-center text-gray-600">{item.standard_qty}</td>
                            <td className="py-3 text-center font-bold text-orange-600">{item.standard_qty - item.stock_qty}</td>
                            <td className="py-3 text-center">{item.material_unit}</td>
                            <td className="py-3 text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.last_used).toLocaleDateString("ko-KR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>검색 조건에 맞는 부족 부품이 없습니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
