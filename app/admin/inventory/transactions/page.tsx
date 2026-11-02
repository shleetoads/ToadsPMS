"use client"

import { useEffect, useState } from "react"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Search,
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  Edit,
  Filter,
} from "lucide-react"
import { Vessel as VesselCode } from '@/types/common/vessel'; // ✅ interface import
import { Transactions } from '@/types/inventory/transactions/transactions'; // ✅ interface import

const getTodayDate = () => {
  const today = new Date()
  return today.toISOString().split("T")[0]
}

const getWeekAgoDate = () => {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return weekAgo.toISOString().split("T")[0]
}

export default function InventoryTransactionsPage() {
  const initialTransaction : Transactions = {
    vessel_no: "",
    vessel_name: "",
    date: "",
    type: "",
    no: "",
    material_code: "",
    material_name: "",
    machine_name: "",
    location: "",
    unit: "",
    qty: 0,
    reason: "",
    regist_user: "",
    registrant: "",
    start_date: "",
    end_date: "",
  }
  const [userInfo, setUserInfo] = useState<any>(null)
  const [vesselCodes, setVesselCodes] = useState<VesselCode[]>([])
  const [selectedVesselCode, setSelectedVesselCode] = useState<VesselCode>()

  const [transactionsData, setTransactionsData] = useState<Transactions[]>([]);
  const [filteredData, setFilteredData] = useState<Transactions[]>(transactionsData)

  const [searchData, setSearchData] = useState<Transactions>(initialTransaction);
  const [hasSearched, setHasSearched] = useState(false)

  const [typeFilter, setTypeFilter] = useState("all")
  const [machineFilter, setMachineFilter] = useState("")
  const [machineTerm, setMachineTerm] = useState("")
  const [materialFilter, setMaterialFilter] = useState("")
  const [materialTerm, setMaterialTerm] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState("")
  const [warehouseTerm, setWarehouseTerm] = useState("")
  
  const fetchVesselCodes = () => {
    fetch(`/api/common/vessel/code`)
      .then(res => res.json())
      .then(data => setVesselCodes(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth()
      setUserInfo(user)
      
      fetchVesselCodes()

      setSearchData((prev: any) => ({ ...prev, start_date: getWeekAgoDate() }))
      setSearchData((prev: any) => ({ ...prev, end_date: getTodayDate() }))

    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = transactionsData

    if (typeFilter !== "all") {
      filtered = filtered.filter((txn) => txn.type === typeFilter)
    }

    if (machineTerm) {
      filtered = filtered.filter((txn) => txn.machine_name.toLowerCase().includes(machineTerm.toLowerCase()))
    }

    if (materialTerm) {
      filtered = filtered.filter(
        (txn) =>
          txn.material_name.toLowerCase().includes(materialTerm.toLowerCase()) ||
          txn.material_code.toLowerCase().includes(materialTerm.toLowerCase()),
      )
    }

    if (warehouseTerm) {
      filtered = filtered.filter((txn) => txn.location.toLowerCase().includes(warehouseTerm.toLowerCase()))
    }

    setFilteredData(filtered);

  }, [transactionsData, typeFilter, machineTerm, materialTerm, warehouseTerm])

  if (!userInfo) return null

  const handleSearch = async () => {
    const res = await fetch(`/api/admin/inventory/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchData),
    });

    const data = await res.json();
    setTransactionsData(data);

    setHasSearched(true)
  }

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case "I0":
        return (
          <Badge className="bg-green-100 text-green-800">
            <TrendingUp className="w-3 h-3 mr-1" />
            입고
          </Badge>
        )
      case "O0":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <TrendingDown className="w-3 h-3 mr-1" />
            출고
          </Badge>
        )
      case "AI":
      case "AO":
        return (
          <Badge className="bg-orange-100 text-orange-800">
            <Edit className="w-3 h-3 mr-1" />
            재고조정
          </Badge>
        )
      case "L0":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            손망실
          </Badge>
        )
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const getTransactionType = (type: string) => {
    switch (type) {
      case "I0":
        return '정상입고'
      case "O0":
        return '정상출고'
      case "AI":
        return '재고조정 - 입고'
      case "AO":
        return '재고조정 - 출고'
      case "L0":
        return '손망실'
    }
  }

  const getQuantityDisplay = (type: string, quantity: number) => {
    const isNegative = type === 'AO' || type === 'O0' || type === 'L0'
    const displayQuantity = Math.abs(quantity)

    return (
      <span className={isNegative ? "text-red-600" : "text-green-600"}>
        {isNegative ? "-" : "+"}
        {displayQuantity}
      </span>
    )
  }

  const vesselChanged = (vesselNo: string) => {
    setSearchData((prev: any) => ({ ...prev, vessel_no: vesselNo }))
    setSelectedVesselCode(vesselCodes.find(vessel => vessel.vessel_no === vesselNo))
  }

  const getUniqueTypes = () => [...new Set(transactionsData.map((txn) => txn.type))]

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
                  <h2 className="text-xl font-bold text-gray-900">입출고 내역</h2>
                  <p className="text-gray-600">부품의 입고, 출고, 재고조정, 손망실 내역을 조회합니다</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    조회 조건
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex flex-row gap-4">
                        <div className="space-y-2">
                          <Label>시작일자 *</Label>
                          <Input 
                            type="date" 
                            className='sm:w-40 md:w-36'
                            value={searchData.start_date} 
                            onChange={(e) => setSearchData((prev: any) => ({ ...prev, start_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex flex-row gap-4">
                        <div className="space-y-2">
                          <Label>종료일자 *</Label>
                          <Input 
                            type="date" 
                            className='sm:w-40 md:w-36'
                            value={searchData.end_date} 
                            onChange={(e) => setSearchData((prev: any) => ({ ...prev, end_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>구분</Label>
                        <Select 
                          value={searchData.type} 
                          onValueChange={(value) => setSearchData((prev: any) => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="전체" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="I">입고</SelectItem>
                            <SelectItem value="O">출고</SelectItem>
                            <SelectItem value="A">재고조정</SelectItem>
                            <SelectItem value="L">손망실</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>선박</Label>
                        <Select 
                          value={searchData.vessel_no} 
                          onValueChange={(value) => vesselChanged(value)}
                        >
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
                      <div className="space-y-2">
                        <Label>장비</Label>
                        <Select 
                          value={searchData.machine_name} 
                          onValueChange={(value) => setSearchData((prev: any) => ({ ...prev, machine_name: value }))}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="전체" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {selectedVesselCode?.machines.map((machine) => (
                              <SelectItem key={machine.machine_name} value={machine.machine_name}>
                                {machine.machine_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>창고</Label>
                        <Select 
                          value={searchData.location} 
                          onValueChange={(value) => setSearchData((prev: any) => ({ ...prev, location: value }))}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="전체" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {selectedVesselCode?.warehouses.map((warehouse) => (
                              <SelectItem key={warehouse.warehouse_no} value={warehouse.warehouse_no}>
                                {warehouse.warehouse_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleSearch} className="w-full" style={{cursor: 'pointer'}}>
                        <Search className="w-4 h-4 mr-2" />
                        조회
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {hasSearched && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      입출고 내역 ({filteredData.length}건)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transactionsData.length > 0 && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Filter className="w-4 h-4" />
                          <span className="text-sm font-medium">테이블 필터</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">구분</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                              <SelectTrigger className="h-8 w-full sm:w-40">
                                <SelectValue placeholder="전체" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">전체</SelectItem>
                                {getUniqueTypes().map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {getTransactionType(type)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">장비</Label>
                            <Input
                              placeholder="장비명 검색"
                              value={machineFilter}
                              onChange={(e) => setMachineFilter(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' ? setMachineTerm(machineFilter) : ""}
                              className="h-8 w-full sm:w-40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">부품</Label>
                            <Input
                              placeholder="부품명/코드 검색"
                              value={materialFilter}
                              onChange={(e) => setMaterialFilter(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' ? setMaterialTerm(materialFilter) : ""}
                              className="h-8 w-full sm:w-40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">창고</Label>
                            <Input
                              placeholder="창고명 검색"
                              value={warehouseFilter}
                              onChange={(e) => setWarehouseFilter(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' ? setWarehouseTerm(warehouseFilter) : ""}
                              className="h-8 w-full sm:w-40"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {transactionsData.length > 0 ? (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b">
                            <tr>
                              <th className="text-left py-3 px-2">선박</th>
                              <th className="text-left py-3 px-2">일자</th>
                              <th className="text-left py-3 px-2">구분</th>
                              <th className="text-left py-3 px-2">장비</th>
                              <th className="text-left py-3 px-2">부품명</th>
                              <th className="text-left py-3 px-2">부품코드</th>
                              <th className="text-left py-3 px-2">창고</th>
                              <th className="text-center py-3 px-2">수량</th>
                              <th className="text-left py-3 px-2">사유</th>
                              <th className="text-left py-3 px-2">등록자</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredData.map((transaction) => (
                              <tr key={transaction.no} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-2">{transaction.vessel_name}</td>
                                <td className="py-3 px-2">{transaction.date}</td>
                                <td className="py-3 px-2">{getTransactionTypeBadge(transaction.type)}</td>
                                <td className="py-3 px-2">{transaction.machine_name}</td>
                                <td className="py-3 px-2 font-medium">{transaction.material_name}</td>
                                <td className="py-3 px-2 text-gray-600">{transaction.material_code}</td>
                                <td className="py-3 px-2">{transaction.location}</td>
                                <td className="py-3 px-2 text-center font-medium">
                                  {getQuantityDisplay(transaction.type, transaction.qty)} {transaction.unit}
                                </td>
                                <td className="py-3 px-2">{transaction.reason}</td>
                                <td className="py-3 px-2">{transaction.registrant}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {filteredData.length === 0
                          ? "조회 조건에 맞는 내역이 없습니다."
                          : "필터 조건에 맞는 내역이 없습니다."}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
