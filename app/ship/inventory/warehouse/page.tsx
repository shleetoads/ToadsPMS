"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Search,
  Edit,
  Warehouse as WarehouseIcon,
  Plus,
  Trash2,
} from "lucide-react"
import { Warehouse } from '@/types/inventory/warehouse/warehouse'; // ✅ interface import

export default function ShipWarehouseManagementPage() {
  const initialWarehouse : Warehouse = {
    vessel_no: "",
    vessel_name: "",
    warehouse_no: "",
    warehouse_name: "",
    warehouse_location: "",
    warehouse_desc: "",
    use_yn: "",
    receiving_count: 0,
    releasing_count: 0,
    regist_date: "",
    regist_user: "",
    modify_date: "",
    modify_user: ""
  }

  const [userInfo, setUserInfo] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [filteredData, setFilteredData] = useState<Warehouse[]>(warehouses)

  const [addWarehouse, setAddWarehouse] = useState<Warehouse>(initialWarehouse)
  const [isAddWarehouseDialogOpen, setIsAddWarehouseDialogOpen] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse>(initialWarehouse)
  const [isEditWarehouseDialogOpen, setIsEditWarehouseDialogOpen] = useState(false)

  const fetchWarehouses = (vesselNo: string) => {
    fetch(`/api/ship/inventory/warehouse?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setWarehouses(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)

      fetchWarehouses(user.ship_no)
      
      initialWarehouse.vessel_no = user.ship_no;
      setAddWarehouse(initialWarehouse);
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = warehouses

    if (searchTerm) {
      filtered = filtered.filter(
        (warehouse) =>
          warehouse.warehouse_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
          warehouse.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          warehouse.warehouse_location.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredData(filtered)
  }, [warehouses, searchTerm])

  if (!userInfo) return null

  const checkWarehouseUsage = (warehouse: any) => {
    return {
      isUsed: warehouse.receiving_count > 0 || warehouse.releasing_count > 0,
      receivingCount: warehouse.receiving_count,
      outgoingCount: warehouse.releasing_count,
    }
  }

  const handleInsert = async () => {
    const insertedData = {
      ...addWarehouse,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/inventory/warehouse/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const result = await res.json();

    if (result.success) {
      alert("저장이 완료되었습니다.");

      setWarehouses([...warehouses, result.data])
      
      initialWarehouse.vessel_no = userInfo.ship_no;
      setAddWarehouse(initialWarehouse)
      setIsAddWarehouseDialogOpen(false)
    } else {
      alert(result.message);
    }
  }

  const handleEditWarehouse = (warehouse: any) => {
    setSelectedWarehouse(warehouse)
    setIsEditWarehouseDialogOpen(true)
  }

  const updatedWarehouse = (item: any) => {
      const updatedWarehouses = warehouses.map((warehouse) =>
        warehouse.warehouse_no === item.warehouse_no
          ? {
              ...warehouse,
              warehouse_no: item.warehouse_no,
              warehouse_name: item.warehouse_name,
              warehouse_location: item.warehouse_location,
              modify_date: new Date().toISOString().split("T")[0].toString(),
            }
          : warehouse,
      )

      return updatedWarehouses;
  }

  const handleUpdate = async () => {
    const updatedData = {
      ...selectedWarehouse,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/inventory/warehouse/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setWarehouses(updatedWarehouse(selectedWarehouse))
      setIsEditWarehouseDialogOpen(false)
      setSelectedWarehouse(initialWarehouse)
    } else {
      alert(data.message);
    }
  }

  const handleDelete = async (warehouse: any) => {
    const usage = checkWarehouseUsage(warehouse)

    if (usage.isUsed) {
      let message = "이 창고는 다음과 같은 데이터에서 사용 중이므로 삭제할 수 없습니다:\n\n"

      if (usage.receivingCount > 0) {
        message += `• 입고 내역: ${usage.receivingCount}건\n`
      }
      if (usage.outgoingCount > 0) {
        message += `• 출고 내역: ${usage.outgoingCount}건\n`
      }

      message += "\n먼저 관련 데이터를 정리한 후 삭제해주세요."
      alert(message)
      return
    }

    if (confirm("창고를 삭제하시겠습니까?")) {
      const res = await fetch('/api/ship/inventory/warehouse/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warehouse),
      });

      const data = await res.json();

      if (data.success) {
        alert("삭제가 완료되었습니다.");

        setWarehouses(warehouses.filter((item) => item.warehouse_no !== warehouse.warehouse_no))
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
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">창고관리</h1>
                <p className="text-gray-600">선박 내 창고 정보를 등록하고 관리합니다</p>
              </div>
              <Button onClick={() => setIsAddWarehouseDialogOpen(true)} className="flex items-center gap-2" style={{cursor:"pointer"}}>
                <Plus className="w-4 h-4" />
                창고 추가
              </Button>
            </div>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <WarehouseIcon className="w-5 h-5" />
                    창고 목록
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="창고코드, 창고명, 위치로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-2">창고코드</th>
                        <th className="text-left py-3 px-2">창고명</th>
                        <th className="text-left py-3 px-2">창고위치</th>
                        <th className="text-center py-3 px-2">등록일</th>
                        <th className="text-center py-3 px-2">수정일</th>
                        <th className="text-center py-3 px-2">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((warehouse) => {
                        const usage = checkWarehouseUsage(warehouse)
                        return (
                          <tr key={warehouse.warehouse_no} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2 font-medium">{warehouse.warehouse_no}</td>
                            <td className="py-3 px-2">
                              {warehouse.warehouse_name}
                              {usage.isUsed && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                  사용중
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-gray-600">{warehouse.warehouse_location}</td>
                            <td className="py-3 px-2 text-center text-gray-500">{warehouse.regist_date}</td>
                            <td className="py-3 px-2 text-center text-gray-500">{warehouse.modify_date}</td>
                            <td className="py-3 px-2 text-center">
                              <div className="flex justify-center gap-2">
                                <Button onClick={() => handleEditWarehouse(warehouse)} size="sm" variant="ghost" style={{cursor:"pointer"}}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDelete(warehouse)}
                                  size="sm"
                                  variant="ghost"
                                  className={`${usage.isUsed ? "text-gray-400 cursor-not-allowed" : "text-red-600 hover:text-red-700"}`}
                                  style={{cursor:"pointer"}}
                                  disabled={usage.isUsed}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {filteredData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 창고가 없습니다."}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add Warehouse Dialog */}
            <Dialog open={isAddWarehouseDialogOpen} onOpenChange={setIsAddWarehouseDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>창고 추가</DialogTitle>
                  <DialogDescription>새로운 창고 정보를 입력해주세요.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="warehouseName">창고명 *</Label>
                    <Input
                      id="warehouseName"
                      placeholder="예: 주엔진 부품창고"
                      defaultValue={addWarehouse.warehouse_name}
                      onChange={(e) => setAddWarehouse({ ...addWarehouse, warehouse_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">창고위치 *</Label>
                    <Input
                      id="location"
                      placeholder="예: 선수 1층"
                      defaultValue={addWarehouse.warehouse_location}
                      onChange={(e) => setAddWarehouse({ ...addWarehouse, warehouse_location: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddWarehouseDialogOpen(false)} style={{cursor:"pointer"}}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleInsert} 
                    style={{cursor:"pointer"}}
                    disabled={!addWarehouse.vessel_no || 
                      !addWarehouse.warehouse_name || 
                      !addWarehouse.warehouse_location}
                  >추가</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Warehouse Dialog */}
            <Dialog open={isEditWarehouseDialogOpen} onOpenChange={setIsEditWarehouseDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>창고 수정</DialogTitle>
                  <DialogDescription>창고 정보를 수정해주세요.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="editWarehouseCode">창고코드 *</Label>
                    <Input
                      id="editWarehouseCode"
                      value={selectedWarehouse.warehouse_no}
                      onChange={(e) => setSelectedWarehouse({ ...selectedWarehouse, warehouse_no: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editWarehouseName">창고명 *</Label>
                    <Input
                      id="editWarehouseName"
                      value={selectedWarehouse.warehouse_name}
                      onChange={(e) => setSelectedWarehouse({ ...selectedWarehouse, warehouse_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editLocation">창고위치 *</Label>
                    <Input
                      id="editLocation"
                      value={selectedWarehouse.warehouse_location}
                      onChange={(e) => setSelectedWarehouse({ ...selectedWarehouse, warehouse_location: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditWarehouseDialogOpen(false)} style={{cursor:"pointer"}}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleUpdate} 
                    style={{cursor:"pointer"}}
                    disabled={!selectedWarehouse?.vessel_no || 
                      !selectedWarehouse?.warehouse_no || 
                      !selectedWarehouse?.warehouse_name || 
                      !selectedWarehouse?.warehouse_location}
                  >수정</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  )
}
