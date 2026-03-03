"use client"

import { useEffect, useState, useRef } from "react"
import { requireAuth } from "@/lib/auth"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Ship, Plus, Search, Edit, Settings, Wrench, Upload, Download, Trash2, Loader } from "lucide-react"
import * as XLSX from 'xlsx';
import { Vessel } from '@/types/vessel/vessel'; // ✅ interface import
import { json } from "stream/consumers"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ExcelData {
  [key: string]: any;
}

export default function ShipManagementPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [filteredShips, setFilteredShips] = useState(vessels);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFilter, setSearchFilter] = useState('');
  const [addVessel, setAddVessel] = useState<Vessel>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<any>(null);
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploadaResultDialogOpen, setIsUploadResultDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadaResult, setUploadResult] = useState(false);

  const fetchVessels = () => {
    fetch('/api/admin/ships/all')
      .then(res => res.json())
      .then(data => setVessels(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchVessels();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = vessels;

    if (searchTerm) {
      filtered = filtered.filter(
        vessel =>
          vessel.vessel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vessel.vessel_no?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredShips(filtered);
  }, [vessels, searchTerm])

  if (!userInfo) return null

  const addVessels = (item: any) => {
    const updatedVessels = [...vessels, item];

    // 1. setVessels 함수를 사용하여 상태를 새로운 배열로 업데이트합니다.
    setVessels(updatedVessels);
  }

  const updateVessels = (item: any) => {
    // 1. map()을 사용하여 새로운 배열을 생성합니다.
    const updatedVessels = vessels.map((vessel) => {
      // 2. 변경할 항목을 찾습니다.
      if (vessel.vessel_no === item.vessel_no) {
        // 3. 스프레드 연산자로 기존 속성을 복사하고 name만 변경한 새로운 객체를 반환합니다.
        return { ...vessel, 
          vessel_name: item.vessel_name, 
          vessel_short_name: item.vessel_short_name, 
          imo_no: item.imo_no, 
          use_yn: item.use_yn
        };
      }
      // 4. 변경하지 않을 항목은 그대로 반환합니다.
      return vessel;
    });

    // 5. setVessels 함수로 상태를 업데이트합니다.
    setVessels(updatedVessels);
  }

  const handleInsert = async () => {
    const insertedData = {
      ...addVessel,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/admin/ships/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsAddDialogOpen(false);
      addVessels(addVessel);
    } else {
      alert(data.message);
    }
  }

  const handleExcelUploadButton = (item: any) => {
    setSelectedVessel(item);

    setIsUploadDialogOpen(true);
  }

  const sendDataToServer = async (excelData: ExcelData[]) => {
    try {
      const vesselNo = selectedVessel.vessel_no;
      const sendData = {
        'vesselNo': vesselNo,
        'registUser': userInfo.account_no,
        'modifyUser': userInfo.account_no,
        'excelData': excelData
      }
      
      const res = await fetch(`/api/admin/ships/${vesselNo}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendData),
      });

      const data = await res.json();
      
      setIsUploading(false);
      setUploadResult(data.success);
      if(data.success){
        fetchVessels();
      }

      setIsUploadResultDialogOpen(true);

      // if (data.success) {
      //   alert('데이터가 성공적으로 전송되었습니다.');
      //   fetchVessels();
      // } else {
      //   alert('데이터 전송에 실패하였습니다.\n업로드 파일 양식 확인 후 다시 진행하세요.');
      // }
      // setIsUploadDialogOpen(false);

    } catch (error) {
      alert(`네트워크 에러: ${error}`);
    }
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsUploading(true)

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
          "Equipment", 
          "Machine", 
          "Category", 
          "Maker", 
          "Type", 
          "Section", 
          "MaintenanceName", 
          "Manufacturer", 
          "Model", 
          "Specifications", 
          "Workers", 
          "WorkHours", 
          "IntervalTerm", 
          "Interval", 
          "Location", 
          "SelfMaintenace", 
          "PIC", 
          "Critical", 
          "LastestDate", 
          "Instructions",
          "PrevPMSCode",
        ];
        
        const jsonData: ExcelData[] = XLSX.utils.sheet_to_json(worksheet, {header: headerMapping, range: 1});
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

  const handleDelete = async (item: any) => {
    if (confirm("석박("+ item.vessel_no +")을 삭제하시겠습니까?")) {
      const res = await fetch('/api/admin/ships/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });

      const data = await res.json();

      if (data.success) {
        alert("삭제가 완료되었습니다.");
        fetchVessels();
      } else {
        alert(data.message);
      }
    }
  }

  const handleEditDialogOpen = (item: any) => {
    setSelectedVessel(item);
    setIsEditDialogOpen(true);
  }

  const handleUpdate = async () => {
    const updatedData = {
      ...selectedVessel,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/admin/ships/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsEditDialogOpen(false);
      updateVessels(selectedVessel);
    } else {
      alert(data.message);
    }
  }

  const handleViewEquipment = (vesselNo?: string, vesselName?: string) => {
    const params = new URLSearchParams()
    if (vesselName) params.append("vesselName", vesselName)

    window.location.href = `/admin/ships/${vesselNo}/equipment?${params.toString()}`
  }

  const handleViewMaintenance = (vesselNo?: string, vesselName?: string) => {
    const params = new URLSearchParams()
    if (vesselName) params.append("vesselName", vesselName)

    window.location.href = `/admin/ships/${vesselNo}/maintenance?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">선박 관리</h1>
                <p className="text-gray-600">전체 선박의 정보와 상태를 관리하세요</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" style={{cursor: 'pointer'}}>
                  <Download className="w-4 h-4 mr-2" />
                  <a href="/template/PMS Maintenance Upload Template.xlsx">
                    템플릿 다운로드
                  </a>
                </Button>
                <Button 
                  onClick={() => setIsAddDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700" 
                  style={{cursor: 'pointer'}}
                >
                  <Plus className="w-4 h-4 mr-2" />새 선박 등록
                </Button>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>새 선박 등록</DialogTitle>
                    <DialogDescription>새로운 선박의 정보를 입력하세요</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="vessel_no">선박번호</Label>
                      <Input 
                        id="vessel_no" 
                        placeholder="선박 번호를 입력하세요" 
                        onChange={(e) => setAddVessel((prev: any) => ({ ...prev, vessel_no: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel_name">선박명</Label>
                      <Input 
                        id="vessel_name" 
                        placeholder="선박명을 입력하세요"
                        onChange={(e) => setAddVessel((prev: any) => ({ ...prev, vessel_name: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel_short_name">선박명(약어)</Label>
                      <Input 
                        id="vessel_short_name" 
                        placeholder="선박명(약어)를 입력하세요"
                        onChange={(e) => setAddVessel((prev: any) => ({ ...prev, vessel_short_name: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imo_no">IMO No</Label>
                      <Input 
                        id="imo_no" 
                        placeholder="IMO No를 입력하세요"
                        onChange={(e) => setAddVessel((prev: any) => ({ ...prev, imo_no: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="use_yn">사용여부</Label>
                      <Select
                        onValueChange={(value) => setAddVessel((prev: any) => ({ ...prev, use_yn: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="사용여부 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Y">사용</SelectItem>
                          <SelectItem value="N">미사용</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} style={{cursor: 'pointer'}}>
                      취소
                    </Button>
                    <Button 
                      onClick={handleInsert}
                      disabled={!addVessel?.vessel_no || 
                        !addVessel?.vessel_name || 
                        !addVessel?.use_yn}
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
                <CardTitle className="text-sm font-medium">총 선박 수</CardTitle>
                <Ship className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vessels.length}</div>
                <p className="text-xs text-muted-foreground">등록된 선박</p>
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
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="선박번호, 선박명으로 검색..."
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

          {/* 선박 목록 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredShips.map((item) => (
              <Card key={item.vessel_no} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Ship className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{item.vessel_name}</CardTitle>
                        <CardDescription>
                          {item.vessel_no} • 
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleExcelUploadButton(item)} 
                        style={{cursor: 'pointer'}} 
                        title="엑셀 파일 업로드"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditDialogOpen(item)} 
                        style={{cursor: 'pointer'}} 
                        title="선박 수정"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(item)} 
                        style={{cursor: 'pointer'}} 
                        title="선박 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{item.machine_count}</div>
                        <div className="text-xs text-gray-500">장비 수</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600">{item.maintenance_count}</div>
                        <div className="text-xs text-gray-500">정비 작업</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{item.crew}</div>
                        <div className="text-xs text-gray-500">승무원</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => handleViewEquipment(item.vessel_no, item.vessel_name)}
                        style={{cursor: 'pointer'}}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        장비 관리
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => handleViewMaintenance(item.vessel_no, item.vessel_name)}
                        style={{cursor: 'pointer'}}
                      >
                        <Wrench className="w-4 h-4 mr-2" />
                        정비 관리
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredShips.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Ship className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">조건에 맞는 선박이 없습니다.</p>
              </CardContent>
            </Card>
          )}

          {/* 선박 수정 다이얼로그 */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>선박 정보 수정</DialogTitle>
                <DialogDescription>선박의 정보를 수정하세요</DialogDescription>
              </DialogHeader>
              {selectedVessel && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="editVesselNo">선박번호</Label>
                    <Input 
                      id="editVesselNo" 
                      value={selectedVessel.vessel_no} 
                      disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editVesselName">선박명</Label>
                    <Input 
                      id="editVesselName" 
                      value={selectedVessel.vessel_name} 
                      onChange={(e) => setSelectedVessel((prev: any) => ({ ...prev, vessel_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editVesselShortName">선박명(약어)</Label>
                    <Input 
                      id="editVesselShortName" 
                      value={selectedVessel.vessel_short_name} 
                      onChange={(e) => setSelectedVessel((prev: any) => ({ ...prev, vessel_short_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editImoNo">IMO No</Label>
                    <Input 
                      id="editImoNo" 
                      value={selectedVessel.imo_no} 
                      onChange={(e) => setSelectedVessel((prev: any) => ({ ...prev, imo_no: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editShipType">사용여부</Label>
                    <Select 
                      value={selectedVessel.use_yn}
                      onValueChange={(value) => setSelectedVessel((prev: any) => ({ ...prev, use_yn: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="사용여부 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Y">사용</SelectItem>
                        <SelectItem value="N">미사용</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} style={{cursor: 'pointer'}}>
                  취소
                </Button>
                <Button 
                  onClick={handleUpdate}
                  disabled={!selectedVessel?.vessel_no || 
                    !selectedVessel?.vessel_name || 
                    !selectedVessel?.use_yn}
                >저장</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {isUploading?(<Loader color="#808080"></Loader>) : (<Upload></Upload>)}
                  <DialogTitle>엑셀 파일 업로드</DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>• 먼저 템플릿을 다운로드하여 양식에 맞게 작성해주세요.</p>
                  <p>• 엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.</p>
                  <p>• 기존 정비 정보와 중복되는 내용은 업데이트됩니다.</p>
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
              <Dialog open={isUploadaResultDialogOpen} onOpenChange={setIsUploadResultDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <DialogTitle>{uploadaResult?('성공'):('실패')}</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>{uploadaResult?('데이터가 성공적으로 전송되었습니다.'):('데이터 전송에 실패하였습니다.\n업로드 파일 양식 확인 후 다시 진행하세요.')}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsUploadResultDialogOpen(false);
                    setIsUploadDialogOpen(false);
                  }}>
                    확인
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isUploading}>
              <DialogContent
                className="w-fit max-w-none p-6 [&>button]:hidden"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
              >
                <VisuallyHidden>
                  <DialogTitle></DialogTitle>
                </VisuallyHidden>
                <div className="flex flex-col items-center gap-3">
                  <img src="/Loading.gif" alt="loading" className="w-44" />
                </div>
              </DialogContent>
            </Dialog>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
