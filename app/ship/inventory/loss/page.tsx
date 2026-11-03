"use client"

import { useEffect, useState } from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/inventory/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  Package,
  Search,
  Plus,
  Trash2,
} from "lucide-react"
import { Stock } from '@/types/inventory/loss/stock'; // ✅ interface import
import { Loss } from '@/types/inventory/loss/loss'; // ✅ interface import

export default function ShipInventoryLossPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [filteredData, setFilteredData] = useState<Stock[]>(stocks)
  const [lossDate, setLossDate] = useState(new Date().toISOString().split("T")[0])
  const [registrant, setRegistrant] = useState("")
  const [reason, setReason] = useState("")
  const [lossItems, setLossItems] = useState<Loss[]>([])
  const [isPartSearchDialogOpen, setIsPartSearchDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)

  const fetchStock = (vesselNo: string) => {
    fetch(`/api/ship/inventory/loss/stock/?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setStocks(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth()
      setUserInfo(user)
      setRegistrant(user.user_name || "")

      fetchStock(user.ship_no)
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = stocks

    if (searchTerm) {
      filtered = filtered.filter(
        (stock) =>
          stock.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.machine_name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredData(filtered)
  }, [stocks, searchTerm])

  if (!userInfo) return null

  const handleAddPart = (item: any) => {
    const lossItem = {
      vessel_no: item.vessel_no,
      vessel_name: "",
      loss_no: "",
      machine_name: item.machine_name,
      material_code: item.material_code,
      material_name: item.material_name,
      loss_date: lossDate,
      loss_type: "",
      loss_unit: item.material_unit,
      loss_qty: 0,
      stock_qty: item.stock_qty,
      loss_location: item.location,
      loss_location_name: item.location_name,
      loss_reason: reason,
      loss_remark: "",
      registrant: registrant,
      regist_date: "",
      regist_user: userInfo.regist_user,
      modify_date: "",
      modify_user: ""
    }

    lossItems.push(lossItem)
    setIsPartSearchDialogOpen(false)
    setSearchTerm("")
  }

  const handleRemovePart = (material_code: string) => {
    setLossItems(lossItems.filter((item) => item.material_code !== material_code))
  }

  const handleQuantityChange = (material_code: string, quantity: string) => {
    setLossItems(lossItems.map((item) => (item.material_code === material_code ? { ...item, loss_qty: Number.parseInt(quantity) } : item)))
  }

  const isFormValid = () => {
    const completeItems = lossItems.filter((item) => item.loss_qty && item.loss_qty > 0)
    return lossDate && registrant.trim() && reason.trim() && completeItems.length > 0
  }

  const updatedStocks = (lossItems: any[]) => {
    const updatedStocks = stocks.map(stock => {
      const loss = lossItems.find(loss => loss.material_code === stock.material_code);

      if (loss) {
        return {
          ...stock,
          stock_qty: stock.stock_qty - loss.loss_qty
        }
      }
      return stock;
    }).filter(stock => stock.stock_qty > 0);

    setStocks(updatedStocks)
  }

  const handleSubmit = async () => {
    if (!isFormValid()) return
    
    const insertedData = lossItems.map(item => ({
      ...item, 
      loss_date: lossDate,
      loss_reason: reason,
      regist_user: userInfo.account_no, 
      modify_user: userInfo.account_no
    }));

    const res = await fetch('/api/ship/inventory/loss/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const result = await res.json();

    if (result.success) {
      updatedStocks(insertedData)
      setIsSuccessDialogOpen(true)
    } else {
      alert(result.message);
    }
  }

  const handleSuccessConfirm = () => {
    setIsSuccessDialogOpen(false)
    // Reset form
    setLossDate(new Date().toISOString().split("T")[0])
    setReason("")
    setLossItems([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />

        <main className="flex-1 min-w-0 p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">손망실 처리</h1>
              <p className="text-gray-600">부품의 손망실을 등록하고 재고를 조정합니다</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  손망실 등록 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-row gap-4">
                  <div>
                    <Label htmlFor="lossDate">손망실 등록 일자</Label>
                    <Input id="lossDate" type="date" value={lossDate} onChange={(e) => setLossDate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="registrant">등록자</Label>
                    <Input id="registrant" value={registrant} onChange={(e) => setRegistrant(e.target.value)} disabled/>
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason">손망실 사유 *</Label>
                  <Textarea
                    id="reason"
                    placeholder="손망실 사유를 입력해주세요... (필수)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className={!reason.trim() && lossItems.length > 0 ? "border-red-300 focus:border-red-500" : ""}
                  />
                  {!reason.trim() && lossItems.length > 0 && (
                    <p className="text-sm text-red-600 mt-1">손망실 사유는 필수 입력 항목입니다.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    손망실 부품 목록
                  </CardTitle>
                  <Button onClick={() => setIsPartSearchDialogOpen(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    부품 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lossItems.length > 0 ? (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-3 px-2">장비명</th>
                          <th className="text-left py-3 px-2">부품명</th>
                          <th className="text-left py-3 px-2">부품코드</th>
                          <th className="text-center py-3 px-2">현재재고</th>
                          <th className="text-center py-3 px-2">손망실 수량</th>
                          <th className="text-center py-3 px-2">단위</th>
                          <th className="text-center py-3 px-2">창고</th>
                          <th className="text-center py-3 px-2">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lossItems.map((item) => (
                          <tr key={item.material_code} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2">{item.machine_name}</td>
                            <td className="py-3 px-2 font-medium">{item.material_name}</td>
                            <td className="py-3 px-2 text-gray-600">{item.material_code}</td>
                            <td className="py-3 px-2 text-center">{item.stock_qty}</td>
                            <td className="py-3 px-2 flex items-center justify-center">
                              <Input
                                type="number"
                                min="1"
                                max={item.stock_qty}
                                value={item.loss_qty}
                                onChange={(e) => handleQuantityChange(item.material_code, e.target.value)}
                                className="w-20 text-center"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">{item.loss_unit}</td>
                            <td className="py-3 px-2 text-center">{item.loss_location_name}</td>
                            <td className="py-3 px-2 text-center">
                              <Button
                                onClick={() => handleRemovePart(item.material_code)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    손망실 처리할 부품을 추가해주세요.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!isFormValid()} className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                손망실 등록
                {!isFormValid() && (
                  <span className="sr-only">
                    {!reason.trim() ? "등록 사유를 입력해주세요" : "모든 필수 정보를 입력해주세요"}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* Part Search Dialog */}
      <Dialog open={isPartSearchDialogOpen} onOpenChange={setIsPartSearchDialogOpen}>
        <DialogContent className="sm:max-w-[820px] max-h-[620px]">
          <DialogHeader>
            <DialogTitle>부품 검색</DialogTitle>
            <DialogDescription>손망실 처리할 부품을 검색하여 선택해주세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="부품명, 부품코드, 장비명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="text-left py-2 px-2">장비명</th>
                    <th className="text-left py-2 px-2">부품명</th>
                    <th className="text-left py-2 px-2">부품코드</th>
                    <th className="text-center py-2 px-2">현재재고</th>
                    <th className="text-center py-2 px-2">단위</th>
                    <th className="text-center py-3 px-2">창고</th>
                    <th className="text-center py-2 px-2">선택</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={`${item.machine_name}-${item.material_code}-${item.location}`} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{item.machine_name}</td>
                      <td className="py-2 px-2 font-medium">{item.material_name}</td>
                      <td className="py-2 px-2 text-gray-600">{item.material_code}</td>
                      <td className="py-2 px-2 text-center">{item.stock_qty}</td>
                      <td className="py-2 px-2 text-center">{item.material_unit}</td>
                      <td className="py-2 px-2 text-center">{item.location_name}</td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          onClick={() => handleAddPart(item)}
                          size="sm"
                          disabled={lossItems.some((loss) => loss.material_code === item.material_code)}
                        >
                          {lossItems.some((loss) => loss.material_code === item.material_code) ? "추가됨" : "선택"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length === 0 && (
                <div className="text-center py-8 text-gray-500">검색 결과가 없습니다.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              손망실 등록 완료
            </DialogTitle>
            <DialogDescription>손망실 처리가 성공적으로 등록되었습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">등록 일자: {lossDate}</p>
            <p className="text-sm text-gray-600">등록자: {registrant}</p>
            <p className="text-sm text-gray-600">처리된 부품: {lossItems.length}개</p>
          </div>
          <DialogFooter>
            <Button onClick={handleSuccessConfirm}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
