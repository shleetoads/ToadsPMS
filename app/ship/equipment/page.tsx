"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Edit, Settings, Wrench, Calendar } from "lucide-react"
import { Machine } from '@/types/common/machine'; // ✅ interface import
import { Equipment } from '@/types/vessel/equipment'; // ✅ interface import

export default function ShipEquipmentPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [filteredEquipment, setFilteredEquipment] = useState(equipments)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState("ALL")
  const [addEquipment, setAddEquipment] = useState<Equipment>()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null)

  const fetchMachines = (vesselNo: string) => {
    fetch(`/api/common/machine/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  }
  
  const fetchEquipments = (vesselNo: string) => {
    fetch(`/api/ship/equipment/all?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = vesselRequireAuth();
      setUserInfo(user);
      
      fetchMachines(user.ship_no);
      fetchEquipments(user.ship_no);
      setAddEquipment((prev: any) => ({ ...prev, vessel_no: user.ship_no }));
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = equipments

    if (searchTerm) {
      filtered = filtered.filter(eq =>
        eq.equip_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (machineFilter !== "ALL") {
      filtered = filtered.filter(eq => eq.machine_name === machineFilter)
    }

    setFilteredEquipment(filtered)
  }, [equipments, searchTerm, machineFilter])

  if (!userInfo) return null

  const addEquipments = (item: any) => {
    const updatedEquipments = [...equipments, item];

    // 1. setEquipments 함수를 사용하여 상태를 새로운 배열로 업데이트합니다.
    setEquipments(updatedEquipments);
  }

  const updateEquipments = (item: any) => {
    // 1. map()을 사용하여 새로운 배열을 생성합니다.
    const updatedEquipments = equipments.map((eq) => {
      // 2. 변경할 항목을 찾습니다.
      if (eq.vessel_no === item.vessel_no && eq.equip_no === item.equip_no) {
        // 3. 스프레드 연산자로 기존 속성을 복사하고 name만 변경한 새로운 객체를 반환합니다.
        return { ...eq, 
          vessel_no: item.vessel_no,
          equip_no: item.equip_no,
          equip_name: item.equip_name,
          manufacturer: item.manufacturer,
          category: item.category,
          model: item.model,
          specifications: item.specifications,
          description: item.description,
          lastest_date: item.lastest_date,
          due_date: item.due_date
        };
      }
      // 4. 변경하지 않을 항목은 그대로 반환합니다.
      return eq;
    });

    // 5. setEquipments 함수로 상태를 업데이트합니다.
    setEquipments(updatedEquipments);
  }

  const handleInsert = async () => {
    const insertedData = {
      ...addEquipment,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/equipment/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsAddDialogOpen(false);
      addEquipments(addEquipment);
    } else {
      alert(data.message);
    }
  }

  const handleEditDialogOpen = (item: any) => {
    setSelectedEquipment(item);
    setIsEditDialogOpen(true);
  }

  const handleUpdate = async () => {
    const updatedData = {
      ...selectedEquipment,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/ship/equipment/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsEditDialogOpen(false);
      updateEquipments(selectedEquipment);
    } else {
      alert(data.message);
    }
  }
  
  // Function to handle history button click
  const handleDetailsClick = (vesselNo: string, equipNo: string) => {
    const encodedParam = encodeURIComponent(equipNo);
    
    window.location.href = `/ship/execution?equipNo=${encodedParam}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{userInfo.ship_name} - 장비 관리</h1>
                <p className="text-gray-600">{userInfo.ship_no} 선박의 모든 장비를 관리하세요</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700" 
                    style={{cursor: 'pointer'}}
                    disabled={userInfo.user_auth !== 'VADMIN'}
                  >
                    <Plus className="w-4 h-4 mr-2" />새 장비 등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>새 장비 등록</DialogTitle>
                    <DialogDescription>새로운 장비의 정보를 입력하세요</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="equip_no">장비번호</Label>
                      <Input 
                        id="equip_no" 
                        placeholder="장비 ID를 입력하세요" 
                        onChange={(e) => setAddEquipment((prev: any) => ({ ...prev, equip_no: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equip_name">장비명</Label>
                      <Input 
                        id="equip_name" 
                        placeholder="장비명을 입력하세요" 
                        onChange={(e) => setAddEquipment((prev: any) => ({ ...prev, equip_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">카테고리</Label>
                      <Select
                        onValueChange={(value) => setAddEquipment((prev: any) => ({ ...prev, category: value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENGINE">Engine</SelectItem>
                          <SelectItem value="DECK">Deck</SelectItem>
                          <SelectItem value="ETC">Etc</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">제조사</Label>
                      <Input 
                        id="manufacturer" 
                        placeholder="제조사를 입력하세요" 
                        onChange={(e) => setAddEquipment((prev: any) => ({ ...prev, manufacturer: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="model">모델명</Label>
                      <Input 
                        id="model" 
                        placeholder="모델명을 입력하세요" 
                        onChange={(e) => setAddEquipment((prev: any) => ({ ...prev, model: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="description">설명</Label>
                      <Textarea 
                        id="description" 
                        placeholder="장비에 대한 설명을 입력하세요" 
                        onChange={(e) => setAddEquipment((prev: any) => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} style={{cursor: 'pointer'}}>
                      취소
                    </Button>
                    <Button 
                      onClick={handleInsert}
                      disabled={!addEquipment?.vessel_no || 
                        !addEquipment?.equip_no || 
                        !addEquipment?.equip_name || 
                        !addEquipment?.category || 
                        !addEquipment?.manufacturer}
                      style={{cursor: 'pointer'}}
                    >등록</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 장비 수</CardTitle>
                <Settings className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{equipments.length}</div>
                <p className="text-xs text-muted-foreground">등록된 장비</p>
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
                      placeholder="장비명으로 검색..."
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

          {/* 장비 목록 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEquipment.map((item) => (
              <Card key={item.equip_no} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Settings className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{item.machine_name}</CardTitle>
                        <CardDescription>
                          {item.equip_no} • {item.equip_name}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditDialogOpen(item)} style={{cursor: 'pointer'}}
                        disabled={userInfo.user_auth !== 'VADMIN'}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">모델:</span>
                        <p className="font-medium">{item.model}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">제조사:</span>
                        <p className="font-medium">{item.manufacturer}</p>
                      </div>
                      {/* <div>
                        <span className="text-gray-500">최근 정비:</span>
                        <p className="font-medium">{item.lastest_date}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">주요 사양:</span>
                        <p className="font-medium">{item.specifications}</p>
                      </div> */}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-orange-600" />
                          <span className="text-sm">{item.maintenance_count} 개 작업</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">다음: {item.due_date}</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDetailsClick(item.vessel_no, item.equip_no)
                        }}
                        style={{cursor: 'pointer'}}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        상세보기
                      </Button>
                    </div>

                    <p className="text-sm text-gray-600 pt-2 border-t"></p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEquipment.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">조건에 맞는 장비가 없습니다.</p>
              </CardContent>
            </Card>
          )}
          
          {/* 장비 수정 다이얼로그 */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>장비 정보 수정</DialogTitle>
                <DialogDescription>장비의 정보를 수정하세요</DialogDescription>
              </DialogHeader>
              {selectedEquipment && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="equip_no">장비번호</Label>
                    <Input 
                      id="equip_no" 
                      value={selectedEquipment.equip_no} 
                      onChange={(e) => setSelectedEquipment((prev: any) => ({ ...prev, equip_no: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equip_name">장비명</Label>
                    <Input 
                      id="equip_name" 
                      value={selectedEquipment.equip_name} 
                      onChange={(e) => setSelectedEquipment((prev: any) => ({ ...prev, equip_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">카테고리</Label>
                    <Select
                      value={selectedEquipment.category} 
                      onValueChange={(value) => setSelectedEquipment((prev: any) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENGINE">Engine</SelectItem>
                        <SelectItem value="DECK">Deck</SelectItem>
                        <SelectItem value="ETC">Etc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">제조사</Label>
                    <Input 
                      id="manufacturer" 
                      value={selectedEquipment.manufacturer} 
                      onChange={(e) => setSelectedEquipment((prev: any) => ({ ...prev, manufacturer: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="model">모델명</Label>
                    <Input 
                      id="model" 
                      value={selectedEquipment.model} 
                      onChange={(e) => setSelectedEquipment((prev: any) => ({ ...prev, model: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Textarea 
                      id="description" 
                      value={selectedEquipment.description} 
                      onChange={(e) => setSelectedEquipment((prev: any) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleUpdate}
                  disabled={!selectedEquipment?.vessel_no || 
                    !selectedEquipment?.equip_no || 
                    !selectedEquipment?.equip_name || 
                    !selectedEquipment?.category || 
                    !selectedEquipment?.manufacturer}
                  style={{cursor: 'pointer'}}
                >수정</Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
