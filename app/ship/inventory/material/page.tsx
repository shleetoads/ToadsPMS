"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Package,
  Search,
  Upload,
  Download,
  Plus,
  Edit,
} from "lucide-react"
import * as XLSX from 'xlsx';
import { MaterialType } from '@/types/common/material_type'; // ✅ interface import
import { MaterialUnit } from '@/types/common/material_unit'; // ✅ interface import
import { Warehouse } from '@/types/common/warehouse'; // ✅ interface import
import { Machine } from '@/types/inventory/material/machine'; // ✅ interface import
import { Material } from '@/types/inventory/material/material'; // ✅ interface import


export default function InitialStockPage() {
  const initialMaterial: Material = {
    vessel_no: "",
    vessel_name: "",
    machine_name: "",
    material_code: "",
    material_name: "",
    material_group: "",
    material_spec: "",
    material_type: "",
    material_unit: "",
    drawing_no: "",
    warehouse_no: "",
    warehouse_name: "",
    standard_qty: 0,
    initial_stock: 0,
    receive_count: 0,
    release_count: 0,
    regist_date: "",
    regist_user: "",
    modify_date: "",
    modify_user: ""
  }

  interface ExcelData {
    [key: string]: any;
  }
  const [userInfo, setUserInfo] = useState<any>(null)
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([])
  const [materialUnits, setMaterialUnits] = useState<MaterialUnit[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMachine, setSelectedMachine] = useState<string>("")
  const [selectedMachineData, setSelectedMachineData] = useState<Machine>()
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([])

  const [addMaterial, setAddMaterial] = useState(initialMaterial)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const [editMaterial, setEditMaterial] = useState<Material>(initialMaterial)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [excelData, setExcelData] = useState<ExcelData[]>([]);

  const fetchMaterialTypes = () => {
    fetch(`/api/common/material_type/code`)
      .then(res => res.json())
      .then(data => setMaterialTypes(data))
      .catch(err => console.error(err));
  };
  
  const fetchMaterialUnits = () => {
    fetch(`/api/common/material_unit/code`)
      .then(res => res.json())
      .then(data => setMaterialUnits(data))
      .catch(err => console.error(err));
  };
  
  const fetchWarehouses = (vesselNo: string) => {
    fetch(`/api/common/warehouse/code?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setWarehouses(data))
      .catch(err => console.error(err));
  };

  const fetchMaterials = (vesselNo: string) => {
    fetch(`/api/ship/inventory/material/?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)

      fetchMaterialTypes()
      fetchMaterialUnits()
      fetchWarehouses(user.ship_no)
      fetchMaterials(user.ship_no)
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = machines

    if (!selectedMachine) {
      setSelectedMachine(machines[0]?.machine_name)
      return;
    }

    if (selectedMachine) {
      const selectedMachineData = filtered.find((machine) => machine.machine_name === selectedMachine)
      const filteredMaterials =
        selectedMachineData?.children.filter(
          (stock) =>
            stock.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.material_name.toLowerCase().includes(searchTerm.toLowerCase()),
        ) || []

      setSelectedMachineData(selectedMachineData)
      setFilteredMaterials(filteredMaterials)
    }
  }, [machines, searchTerm, selectedMachine])

  if (!userInfo) return null

  const addMaterials = (item: any) => {
    return machines.map((machine) => {
      if (machine.vessel_no === item.vessel_no) {
        const updatedMaterials = [...machine.children, item];
        return {...machine, children: updatedMaterials }
      }

      return machine;
    });
  }

  const handleAddMaterial = () => {
    if (selectedMachineData) {
      const addMaterial:Material = {
        ...initialMaterial,
        vessel_no: selectedMachineData.vessel_no,
        vessel_name: selectedMachineData.vessel_name,
        machine_name: selectedMachineData.machine_name,
        regist_user: userInfo.account_no,
        modify_user: userInfo.account_no,
      }

      setAddMaterial(addMaterial)
      setIsAddDialogOpen(true)
    }
  }

  const handleInsertMaterial = async () => {
    const insertedData = {
      ...addMaterial,
      vessel_no: selectedMachineData?.vessel_no,
      machine_name: selectedMachineData?.machine_name,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch(`/api/ship/inventory/material/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const result = await res.json();

    if (result.success) {
      alert("저장이 완료되었습니다.");

      setMachines(addMaterials({
        ...addMaterial,
        material_code: result.data.material_code
      }));
      setIsAddDialogOpen(false);
    } else {
      alert(result.message);
    }
  }

  const updateMaterials = (item: any) => {
    return machines.map((machine) => {
      if (machine.machine_name === item.machine_name) {
        const updatedMaterials = machine.children.map((material) => {
          if (material.material_code === item.material_code) {
            return { ...material,  
              vessel_no: item.vessel_no,
              machine_name: item.machine_name,
              material_code: item.material_code,
              material_name: item.material_name,
              material_unit: item.material_unit,
              warehouse_no: item.warehouse_no,
              warehouse_name: item.warehouse_name,
              standard_qty: item.standard_qty,
              initial_stock: item.initial_stock
            };
          }

          return material;
        });

        return {...machine, children: updatedMaterials }
      }

      return machine;
    });
  }

  const handleEditMaterial = (part: any) => {
    setEditMaterial(part);
    setIsEditDialogOpen(true);
  }

  const handleUpdateMaterial = async () => {
    const updatedData = {
      ...editMaterial,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch(`/api/ship/inventory/material/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setMachines(updateMaterials(editMaterial));
      setIsEditDialogOpen(false);
    } else {
      alert(data.message);
    }
  }

  const sendDataToServer = async (excelData: ExcelData[]) => {
    try {
      const vesselNo = userInfo.ship_no;
      const sendData = {
        'vesselNo': vesselNo,
        'registUser': userInfo.account_no,
        'modifyUser': userInfo.account_no,
        'excelData': excelData
      }

      const res = await fetch(`/api/ship/inventory/material/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendData),
      });

      const data = await res.json();

      if (data.success) {
        alert('데이터가 성공적으로 전송되었습니다.');
        setIsUploadDialogOpen(false);

        fetchMaterials(vesselNo)
      } else {
        alert('데이터 전송 실패');
      }
    } catch (error) {
      alert(`네트워크 에러: ${error}`);
    }
  };
  
  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const headerMapping = [
          "CallSign",
          "Machine", 
          "MaterialGroup", 
          "MaterialName", 
          "Type", 
          "Unit", 
          "Warehouse", 
          "DrawingNo", 
          "StandardQty", 
          "InitialStock"
        ]

        const jsonData: ExcelData[] = XLSX.utils.sheet_to_json(worksheet, {header: headerMapping});
        
        setExcelData(jsonData);
        
        // 서버로 데이터 전송
        sendDataToServer(jsonData);
      };
      
      reader.readAsArrayBuffer(file);
    }
        
    if (event.target) {
        event.target.value = '';
    }
  };

  const warehouseChanged = (mode: string, value: string) => {
    const foundWarehouse = warehouses.find(warehouse => warehouse.warehouse_no === value)

    if (foundWarehouse) {
      if (mode === 'add') {
        setAddMaterial({ ...addMaterial, warehouse_no: foundWarehouse.warehouse_no, warehouse_name: foundWarehouse.warehouse_name})
      } else {
        setEditMaterial({ ...editMaterial, warehouse_no: foundWarehouse.warehouse_no, warehouse_name: foundWarehouse.warehouse_name })
      }
    }
    else {
      if (mode === 'add') {
        setAddMaterial({ ...addMaterial, warehouse_no: value })
      } else {
        setEditMaterial({ ...editMaterial, warehouse_no: value })
      }
    }
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />

        <main className="flex-1 min-w-0 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">기초재고 등록</h1>
                <p className="text-gray-600">{userInfo.ship_name}의 장비별 부품 기초재고를 등록합니다</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  <a href="/template/PMS Material Upload Template.xlsx">
                    템플릿 다운로드
                  </a>
                </Button>
                <Button onClick={() => setIsUploadDialogOpen(true)} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  엑셀 업로드
                </Button>
                <Button 
                  onClick={handleAddMaterial}
                  disabled={selectedMachineData ? false : true }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  부품 추가
                </Button>
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
                            <th className="text-left py-3 px-2">부품명</th>
                            <th className="text-left py-3 px-2">부품코드</th>
                            <th className="text-left py-3 px-2">창고</th>
                            <th className="text-center py-3 px-2">기초재고</th>
                            <th className="text-center py-3 px-2">최소재고</th>
                            <th className="text-center py-3 px-2">단위</th>
                            <th className="text-center py-3 px-2">작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMaterials.map((material, index) => (
                            <tr key={`${material.material_code}`} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-2 font-medium">{material.material_name}</td>
                              <td className="py-3 px-2 text-gray-600">{material.material_code}</td>
                              <td className="py-3 px-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                  {material.warehouse_name}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center">{material.initial_stock}</td>
                              <td className="py-3 px-2 text-center">{material.standard_qty}</td>
                              <td className="py-3 px-2 text-center">{material.material_unit}</td>
                              <td className="py-3 px-2 text-center">
                                <Button size="sm" variant="outline" onClick={() => handleEditMaterial(material)} style={{cursor: 'pointer'}}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </td>
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

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>부품 추가</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>장비</Label>
                    <Input value={selectedMachineData?.machine_name || ""} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label htmlFor="material_group">부품구분</Label>
                    <Input
                      id="material_group"
                      onChange={(e) => setAddMaterial((prev: any) => ({ ...prev, material_group: e.target.value }))}
                      placeholder="부품구분을 입력하세요"
                    />
                  </div>
                  <div>
                    <Label>부품명 *</Label>
                    <Input
                      value={addMaterial.material_name}
                      onChange={(e) => setAddMaterial({ ...addMaterial, material_name: e.target.value })}
                      placeholder="부품명을 입력하세요"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="material_type">부품유형 *</Label>
                      <Select 
                        onValueChange={(value) => setAddMaterial((prev: any) => ({ ...prev, material_type: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="부품유형을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialTypes?.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>창고 *</Label>
                      <Select
                        value={addMaterial.warehouse_no}
                        onValueChange={(value) => warehouseChanged('add', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="창고를 선택하세요" />
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>기초재고 *</Label>
                      <Input
                        type="number"
                        value={addMaterial.initial_stock}
                        onChange={(e) => setAddMaterial({ ...addMaterial, initial_stock: Number.parseInt(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>최소재고 *</Label>
                      <Input
                        type="number"
                        value={addMaterial.standard_qty}
                        onChange={(e) => setAddMaterial({ ...addMaterial, standard_qty: Number.parseInt(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>단위</Label>
                      <Select 
                        onValueChange={(value) => setAddMaterial((prev: any) => ({ ...prev, material_unit: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="자재타입을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialUnits?.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>도변번호</Label>
                      <Input
                        value={addMaterial.drawing_no}
                        onChange={(e) => setAddMaterial({ ...addMaterial, drawing_no: e.target.value })}
                        placeholder="부품명을 입력하세요"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} style={{cursor:'pointer'}}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleInsertMaterial}
                    style={{cursor:'pointer'}}
                    disabled={!addMaterial?.machine_name || 
                      !addMaterial?.material_name || 
                      !addMaterial?.material_type || 
                      !addMaterial?.warehouse_no ||
                      !addMaterial?.material_unit ||
                      !addMaterial?.initial_stock ||
                      !addMaterial?.standard_qty}
                  >추가</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>부품 수정</DialogTitle>
                  <DialogDescription>선택한 부품의 정보를 수정합니다.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit_machine_name">장비</Label>
                    <Input value={selectedMachineData?.machine_name || ""} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label htmlFor="edit_material_code">부품코드</Label>
                    <Input
                      id="edit_material_code"
                      value={editMaterial?.material_code}
                      onChange={(e) => setEditMaterial((prev: any) => ({ ...prev, material_code: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_material_group">부품구분</Label>
                    <Input
                      id="edit_material_group"
                      value={editMaterial?.material_group}
                      onChange={(e) => setEditMaterial((prev: any) => ({ ...prev, material_group: e.target.value }))}
                      placeholder="부품구분을 입력하세요"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_material_name">부품명</Label>
                    <Input
                      id="edit_material_name"
                      value={editMaterial?.material_name}
                      onChange={(e) => setEditMaterial((prev: any) => ({ ...prev, material_name: e.target.value }))}
                      placeholder="부품명을 입력하세요"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_material_type">부품유형</Label>
                      <Select 
                        value={editMaterial?.material_type}
                        onValueChange={(value) => setEditMaterial((prev: any) => ({ ...prev, material_type: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="부품유형을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialTypes?.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_warehouse_no">창고 *</Label>
                      <Select
                        value={editMaterial.warehouse_no}
                        onValueChange={(value) => warehouseChanged('edit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="창고를 선택하세요" />
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_initial_stock">기초 재고</Label>
                      <Input
                        id="edit_initial_stock"
                        type="number"
                        value={editMaterial.initial_stock}
                        onChange={(e) => setEditMaterial((prev: any) => ({ ...prev, initial_stock: e.target.value }))}
                        placeholder="기초 재고를 입력하세요"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_standard_qty">최소재고</Label>
                      <Input
                        id="edit_standard_qty"
                        type="number"
                        value={editMaterial.standard_qty}
                        onChange={(e) => setEditMaterial((prev: any) => ({ ...prev, standard_qty: e.target.value }))}
                        placeholder="최소 보유재고를 입력하세요"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_material_unit">단위</Label>
                      <Select 
                        value={editMaterial?.material_unit}
                        onValueChange={(value) => setEditMaterial((prev: any) => ({ ...prev, material_unit: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="단위을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialUnits?.map((type) => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_drawing_no">도면번호</Label>
                      <Input
                        id="edit_drawing_no"
                        value={editMaterial?.drawing_no}
                        onChange={(e) => setEditMaterial((prev: any) => ({ ...prev, drawing_no: e.target.value }))}
                        placeholder="DWG No를 입력하세요"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} style={{cursor: 'pointer'}}>
                    취소
                  </Button>
                  <Button 
                    onClick={handleUpdateMaterial}
                    disabled={!editMaterial?.vessel_no || 
                      !editMaterial?.machine_name || 
                      !editMaterial?.material_name || 
                      !editMaterial?.material_type || 
                      !editMaterial?.warehouse_no ||
                      !editMaterial?.material_unit ||
                      !editMaterial?.initial_stock ||
                      !editMaterial?.standard_qty}
                    style={{cursor: 'pointer'}}
                  >수정</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>엑셀 파일 업로드</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>• 먼저 템플릿을 다운로드하여 양식에 맞게 작성해주세요.</p>
                    <p>• 엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.</p>
                    <p>• 기존 부품 정보와 중복되는 내용은 업데이트됩니다.</p>
                  </div>
                  <div>
                    <Label>파일 선택</Label>
                    <Input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="cursor-pointer" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                    취소
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  )
}
