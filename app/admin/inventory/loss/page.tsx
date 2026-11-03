"use client"

import { useEffect, useState } from "react"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Search  } from "lucide-react"
import { Vessel as VesselCode } from '@/types/common/vessel'; // ✅ interface import
import { Loss } from '@/types/inventory/loss/loss'; // ✅ interface import

export default function AdminInventoryLossPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const [lossData, setLossData] = useState<Loss[]>([]);
  const [filteredData, setFilteredData] = useState<Loss[]>(lossData)
  const [vesselCodes, setVesselCodes] = useState<VesselCode[]>([])
  const [selectedVessel, setSelectedVessel] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  
  const fetchVesselCodes = () => {
    fetch(`/api/common/vessel/code`)
      .then(res => res.json())
      .then(data => setVesselCodes(data))
      .catch(err => console.error(err));
  };

  const fetchLoss = () => {
    fetch(`/api/admin/inventory/loss`)
      .then(res => res.json())
      .then(data => {
        setLossData(data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth()
      setUserInfo(user)

      fetchVesselCodes();
      fetchLoss();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    const filtered = lossData.filter((item) => {
      const lossDate = new Date(item.loss_date)
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      const dateMatch = lossDate >= start && lossDate <= end
      const shipMatch = selectedVessel === "all" || item.vessel_no === selectedVessel
      const searchMatch =
        searchTerm === "" ||
        item.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.machine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.loss_reason.toLowerCase().includes(searchTerm.toLowerCase())

      return dateMatch && shipMatch && searchMatch
    })

    setFilteredData(filtered)
  }, [startDate, endDate, selectedVessel, searchTerm])

  if (!userInfo) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />

        <main className="flex-1 min-w-0 p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">손망실 부품 조회</h1>
              <p className="text-gray-600">선박별 부품 손망실 내역을 조회합니다</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  조회 조건
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div>
                    <Label htmlFor="startDate">시작일</Label>
                    <Input
                      id="startDate"
                      type="date"
                      className='sm:w-40 md:w-36'
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">종료일</Label>
                    <Input 
                      id="endDate" 
                      type="date" 
                      className='sm:w-40 md:w-36'
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ship">선박</Label>
                    <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="선박 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {vesselCodes.map((vessel) => (
                          <SelectItem key={vessel.vessel_no} value={vessel.vessel_no}>
                            {vessel.vessel_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <Label htmlFor="search">검색</Label>
                      <Input
                        id="search"
                        placeholder="부품명, 부품코드, 손망실 사유..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  손망실 내역 ({filteredData.length}건)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredData.length > 0 ? (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-3 px-2">선박</th>
                          <th className="text-left py-3 px-2">일자</th>
                          <th className="text-left py-3 px-2">장비명</th>
                          <th className="text-left py-3 px-2">부품명</th>
                          <th className="text-left py-3 px-2">부품코드</th>
                          <th className="text-center py-3 px-2">손망실 수량</th>
                          <th className="text-center py-3 px-2">단위</th>
                          <th className="text-left py-3 px-2">등록자</th>
                          <th className="text-left py-3 px-2">사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item) => (
                          <tr key={item.loss_no} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2 font-medium">{item.vessel_name}</td>
                            <td className="py-3 px-2">{item.loss_date}</td>
                            <td className="py-3 px-2">{item.machine_name}</td>
                            <td className="py-3 px-2 font-medium">{item.material_name}</td>
                            <td className="py-3 px-2 text-gray-600">{item.material_code}</td>
                            <td className="py-3 px-2 text-center font-bold text-orange-600">{item.loss_qty}</td>
                            <td className="py-3 px-2 text-center">{item.loss_unit}</td>
                            <td className="py-3 px-2">{item.registrant}</td>
                            <td className="py-3 px-2 text-gray-600">{item.loss_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">조회 조건에 맞는 손망실 내역이 없습니다.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
