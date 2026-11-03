"use client"

import { useEffect, useState } from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Ship, Plus, Search, Edit, Users } from "lucide-react"
import { Vessel } from '@/types/vessel/vessel'; // ✅ interface import
import { Position } from '@/types/position'; // ✅ interface import
import { User } from '@/types/user'; // ✅ interface import

export default function ShipManagementPage() {
  const initialUser: User = {
    account_no: '',
    user_name: '',
    user_ename: '',
    email: '',
    password: '',
    password_check: '',
    position: '',
    user_auth: '',
    ship_no: '',
    ship_name: '',
    use_yn: '',
    regist_date: '',
    regist_user: '',
    modify_date: '',
    modify_user: ''
  };

  const [userInfo, setUserInfo] = useState<any>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState(users)
  const [searchTerm, setSearchTerm] = useState("")
  const [addUser, setAddUser] = useState<User>(initialUser)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  
  const [isEditPasswordDialogOpen, setIsEditPasswordDialogOpen] = useState(false)
  const [selectedUserPassword, setSelectedUserPassword] = useState<User>(initialUser)

  const fetchVessels = () => {
    fetch('/api/common/ships/all')
      .then(res => res.json())
      .then(data => setVessels(data))
      .catch(err => console.error(err));
  };

  const fetchPositions = () => {
    fetch('/api/common/position/all')
      .then(res => res.json())
      .then(data => setPositions(data))
      .catch(err => console.error(err));
  };

  const fetchUsers = () => {
    fetch('/api/admin/users/all')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    try {
      const user = requireAuth();
      setUserInfo(user);

      fetchVessels();
      fetchPositions();
      fetchUsers();
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        (user: { user_name: string; user_ename: string; ship_no: string }) =>
          user.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.user_ename.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.ship_no.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm])

  if (!userInfo) return null

  const addUsers = (item: any) => {
    const updatedUsers = [...users, item];

    // 1. setUsers 함수를 사용하여 상태를 새로운 배열로 업데이트합니다.
    setUsers(updatedUsers);
  }

  const updateUsers = (item: any) => {
    // 1. map()을 사용하여 새로운 배열을 생성합니다.
    const updatedUsers = users.map((user) => {
      // 2. 변경할 항목을 찾습니다.
      if (user.account_no === item.account_no) {
        // 3. 스프레드 연산자로 기존 속성을 복사하고 name만 변경한 새로운 객체를 반환합니다.
        return { ...user, 
          account_no: item.account_no,
          user_name: item.user_name,
          user_ename: item.user_ename,
          email: item.email,
          password: item.password,
          position: item.position,
          user_auth: item.user_auth,
          ship_no: item.ship_no,
          use_yn: item.use_yn
        };
      }
      // 4. 변경하지 않을 항목은 그대로 반환합니다.
      return user;
    });

    // 5. setUsers 함수로 상태를 업데이트합니다.
    setUsers(updatedUsers);
  }

  const handleInsert = async () => {
    const insertedData = {
      ...addUser,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };

    const res = await fetch('/api/admin/users/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsAddDialogOpen(false);
      addUsers(addUser);

      setAddUser(initialUser);
    } else {
      alert(data.message);
    }
  }

  const handleEditDialogOpen = (item: any) => {
    setSelectedUser(item);
    setIsEditDialogOpen(true);
  }

  const handleUpdate = async () => {
    const updatedData = {
      ...selectedUser,
      regist_user: userInfo.account_no,
      modify_user: userInfo.account_no,
    };
    
    const res = await fetch('/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsEditDialogOpen(false);
      updateUsers(selectedUser);
    } else {
      alert(data.message);
    }
  }

  const handleEditPassword = () => {
    setSelectedUserPassword((prev: any) => ({ ...prev, account_no: selectedUser.account_no }));

    setIsEditPasswordDialogOpen(true);
  }

  const handleUpdatePassword = async () => {
    const res = await fetch('/api/admin/users/changePassword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedUserPassword),
    });

    const data = await res.json();

    if (data.success) {
      alert("저장이 완료되었습니다.");

      setIsEditPasswordDialogOpen(false);
      setSelectedUserPassword(initialUser);
    } else {
      alert(data.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 min-w-0 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
                <p className="text-gray-600">전체 사용자 정보와 상태를 관리하세요</p>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700" 
                    style={{cursor: 'pointer'}}
                  >
                    <Plus className="w-4 h-4 mr-2" />새 사용자 등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>새 사용자 등록</DialogTitle>
                    <DialogDescription>새로운 사용자의 정보를 입력하세요</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">사용자 ID</Label>
                      <Input 
                        id="email" 
                        placeholder="사용자 ID를 입력하세요"
                        onChange={(e) => setAddUser((prev: any) => ({ ...prev, email: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2"></div>
                    <div className="space-y-2">
                      <Label htmlFor="user_name">사용자명</Label>
                      <Input 
                        id="user_name" 
                        placeholder="사용자명를 입력하세요" 
                        onChange={(e) => setAddUser((prev: any) => ({ ...prev, user_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user_ename">사용자 영문명</Label>
                      <Input 
                        id="user_ename" 
                        placeholder="사용자 영문명을 입력하세요"
                        onChange={(e) => setAddUser((prev: any) => ({ ...prev, user_ename: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">비밀번호</Label>
                      <Input 
                        id="password" 
                        placeholder="비밀번호를 입력하세요"
                        type="password"
                        onChange={(e) => setAddUser((prev: any) => ({ ...prev, password: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password_check">비밀번호 확인</Label>
                      <Input 
                        id="password_check" 
                        placeholder="비밀번호 확인을 입력하세요"
                        type="password"
                        onChange={(e) => setAddUser((prev: any) => ({ ...prev, password_check: e.target.value }))}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">직책</Label>
                      <Select
                        onValueChange={(value) => setAddUser((prev: any) => ({ ...prev, position: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="직책 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.map(pos => (
                            <SelectItem key={pos.pos_no} value={pos.pos_no}>{pos.pos_code} - {pos.pos_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ship_no">선박</Label>
                      <Select
                        onValueChange={(value) => setAddUser((prev: any) => ({ ...prev, ship_no: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="선박 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {vessels.map(vessel => (
                            <SelectItem key={vessel.vessel_no} value={vessel.vessel_no}>{vessel.vessel_short_name} - {vessel.vessel_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user_auth">사용자 권한</Label>
                      <Select
                        onValueChange={(value) => setAddUser((prev: any) => ({ ...prev, user_auth: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="사용자 권한 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">육상 관리자</SelectItem>
                          <SelectItem value="USER">육상 사용자</SelectItem>
                          <SelectItem value="VADMIN">선박 관리자</SelectItem>
                          <SelectItem value="VESSEL">선박 사용자</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="use_yn">사용여부</Label>
                      <Select
                        onValueChange={(value) => setAddUser((prev: any) => ({ ...prev, use_yn: value }))}>
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
                      disabled={!addUser?.user_name || 
                        !addUser?.email || 
                        !addUser?.password || 
                        !addUser?.password_check || 
                        !addUser?.user_auth ||
                        !addUser?.use_yn}
                      style={{cursor: 'pointer'}}
                    >등록</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate min-w-0">총 사용자 수</CardTitle>
                <Ship className="h-4 w-4 text-blue-600 shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums truncate">{users.length}</div>
                <p className="text-xs text-muted-foreground">등록된 사용자</p>
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
                      placeholder="사용자명, 사용자 영문명, 선박번호로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 사용자 목록 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredUsers.map((item) => (
              <Card key={item.account_no} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-xl truncate">{item.user_name}</CardTitle>
                        <CardDescription className="truncate">
                          {item.account_no} • {item.email}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditDialogOpen(item)} 
                        style={{cursor: 'pointer'}}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center min-w-0">
                        <div className="text-lg font-bold text-blue-600 tabular-nums truncate">{item.ship_no}&nbsp;</div>
                        <div className="text-xs text-gray-500 truncate">선박 번호</div>
                      </div>
                      <div className="text-center min-w-0">
                        <div className="text-lg font-bold text-orange-600 truncate">{item.use_yn}</div>
                        <div className="text-xs text-gray-500 truncate">사용여부</div>
                      </div>
                      <div className="text-center min-w-0">
                        <div className="text-lg font-bold text-green-600 truncate">{item.user_ename}&nbsp;</div>
                        <div className="text-xs text-gray-500 truncate">영문명</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">조건에 맞는 사용자가 없습니다.</p>
              </CardContent>
            </Card>
          )}

          {/* 사용자 수정 다이얼로그 */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>사용자 정보 수정</DialogTitle>
                <DialogDescription>사용자의 정보를 수정하세요</DialogDescription>
              </DialogHeader>
              {selectedUser && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_no">계정번호</Label>
                    <Input 
                      id="account_no" 
                      value={selectedUser.account_no}
                      placeholder="계정번호를 입력하세요"
                      onChange={(e) => setSelectedUser((prev: any) => ({ ...prev, account_no: e.target.value }))}
                      disabled
                      />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">사용자 ID</Label>
                    <Input 
                      id="email" 
                      value={selectedUser.email}
                      placeholder="사용자 ID를 입력하세요"
                      onChange={(e) => setSelectedUser((prev: any) => ({ ...prev, email: e.target.value }))}
                      disabled
                      />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user_name">사용자명</Label>
                    <Input 
                      id="user_name" 
                      value={selectedUser.user_name}
                      placeholder="사용자명를 입력하세요" 
                      onChange={(e) => setSelectedUser((prev: any) => ({ ...prev, user_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user_ename">사용자 영문명</Label>
                    <Input 
                      id="user_ename" 
                      value={selectedUser.user_ename}
                      placeholder="사용자 영문명을 입력하세요"
                      onChange={(e) => setSelectedUser((prev: any) => ({ ...prev, user_ename: e.target.value }))}
                      />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">비밀번호</Label>
                    <Input 
                      id="password" 
                      value={selectedUser.password}
                      placeholder="비밀번호를 입력하세요"
                      type="password"
                      onChange={(e) => setSelectedUser((prev: any) => ({ ...prev, password: e.target.value }))}
                      disabled
                      />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="change_password">&nbsp;</Label>
                    <Button onClick={handleEditPassword} style={{cursor: 'pointer'}}>비밀번호변경</Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">직책</Label>
                    <Select
                      value={selectedUser.position}
                      onValueChange={(value) => setSelectedUser((prev: any) => ({ ...prev, position: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="직책 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map(pos => (
                          <SelectItem key={pos.pos_no} value={pos.pos_no}>{pos.pos_code} - {pos.pos_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ship_no">선박</Label>
                    <Select
                      value={selectedUser.ship_no}
                      onValueChange={(value) => setSelectedUser((prev: any) => ({ ...prev, ship_no: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="선박 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key=' ' value=' '>선박 선택</SelectItem>
                        {vessels.map(vessel => (
                          <SelectItem key={vessel.vessel_no} value={vessel.vessel_no}>{vessel.vessel_short_name} - {vessel.vessel_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user_auth">사용자 권한</Label>
                    <Select
                      value={selectedUser.user_auth}
                      onValueChange={(value) => setSelectedUser((prev: any) => ({ ...prev, user_auth: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="사용자 권한 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">본사 관리자</SelectItem>
                        <SelectItem value="USER">본사 사용자</SelectItem>
                        <SelectItem value="VADMIN">선박 관리자</SelectItem>
                        <SelectItem value="VESSEL">선박 사용자</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="use_yn">사용여부</Label>
                    <Select
                      value={selectedUser.use_yn}
                      onValueChange={(value) => setSelectedUser((prev: any) => ({ ...prev, use_yn: value }))}>
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
                  disabled={!selectedUser?.user_name || 
                    !selectedUser?.user_auth || 
                    !selectedUser?.use_yn}
                  style={{cursor: 'pointer'}}
                >저장</Button>
              </div>
            </DialogContent>
          </Dialog>
          

          {/* 사용자 비밀번호변경 다이얼로그 */}
          <Dialog open={isEditPasswordDialogOpen} onOpenChange={setIsEditPasswordDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>사용자 비밀번호변경</DialogTitle>
                <DialogDescription>사용자의 비밀번호 정보를 변경하세요</DialogDescription>
              </DialogHeader>
              {selectedUser && (
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">신규 비밀번호</Label>
                    <Input 
                      id="password" 
                      placeholder="신규비밀번호를 입력하세요"
                      type="password"
                      onChange={(e) => setSelectedUserPassword((prev: any) => ({ ...prev, password: e.target.value }))}
                      />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password_check">신규 비밀번호 확인</Label>
                    <Input 
                      id="password_check" 
                      placeholder="신규 비밀번호 확인을 입력하세요"
                      type="password"
                      onChange={(e) => setSelectedUserPassword((prev: any) => ({ ...prev, password_check: e.target.value }))}
                      />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditPasswordDialogOpen(false)}>
                  취소
                </Button>
                <Button 
                  onClick={handleUpdatePassword}
                  disabled={!selectedUserPassword?.password || 
                    !selectedUserPassword?.password_check ||
                    selectedUserPassword?.password != selectedUserPassword?.password_check}
                  style={{cursor: 'pointer'}}
                >저장</Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
