"use client"

import { useRef, useEffect, useState} from "react"
import { vesselRequireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings } from "lucide-react"
import { addDays, format } from 'date-fns';
import { Equipment } from '@/types/calendar/equipment';
import { Maintenance } from '@/types/calendar/maintenance';
import { Tooltip } from 'react-tooltip';
import '@/styles/styles.css'

export default function ShipCalendarPage() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [currentDate, setCurrentDate] = useState(new Date(2024, 0, 1)) // January 2024
  const [calendarEquipments, setCalendarEquipments] = useState<Equipment[]>([])
  const [selectedTasks, setSelectedTasks] = useState<any[]>([])
  
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rightItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dayWidth = 42;

  const fetchMaintenances = (vesselNo: string) => {
    fetch(`/api/ship/calendar?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setCalendarEquipments(data))
      .catch(err => console.error(err));
  }

  useEffect(() => {
    try {
      const user = vesselRequireAuth();
      setUserInfo(user);

      fetchMaintenances(user.ship_no);
      const now = new Date();
      setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    } catch (error) {
      // Redirect handled by requireAuth
    }
  }, [])

  useEffect(() => {
    // 아이템들의 높이를 동기화하는 함수
    const syncHeights = () => {
      leftItemRefs.current.forEach((leftItem, index) => {
        const rightItem = rightItemRefs.current[index];

        if (leftItem && rightItem) {
          // 두 아이템 중 더 큰 높이를 계산
          const height = Math.max(leftItem.offsetHeight, rightItem.offsetHeight);

          // 높이를 동기화
          leftItem.style.height = `${height}px`;
          rightItem.style.height = `${height}px`;
        }
      });
    };

    // 데이터가 변경될 때마다 높이 동기화
    syncHeights();

    // 윈도우 리사이즈 시 높이 동기화 (throttle 적용 권장)
    window.addEventListener('resize', syncHeights);

    return () => {
      window.removeEventListener('resize', syncHeights);
    };
  }, [calendarEquipments]);

  useEffect(() => {
  if (selectedTasks.length > 0) {
    const element = findElementById("main_task");

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } else {
      console.log("경고: main_task 요소를 찾을 수 없습니다.");
    }
  }
}, [selectedTasks]);

  if (!userInfo) return null

  interface MonthHeader {
    month: string;
    span: number;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELAYED":
        return <Badge variant="destructive">지연</Badge>
      case "EXTENSION":
        return <Badge variant="outline">연장</Badge>
      case "NORMAL":
        return <Badge variant="secondary">예정</Badge>
      case "COMPLATE":
        return <Badge variant="default">완료</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }
  
  const getCriticalBadge = (critical: string) => {
    switch (critical) {
      case "NORMAL":
        return <Badge variant="outline" className="text-xs">일상정비</Badge>
      case "CRITICAL":
        return <Badge variant="destructive" className="text-xs">Critical</Badge>
      case "DOCK":
        return <Badge variant="secondary" className="text-xs">Dock</Badge>
      case "CMS":
        return <Badge variant="default" className="text-xs">CMS</Badge>
      default:
        return ''
    }
  }

  function findElementById(id: string): HTMLElement | null {
    // id를 사용하여 요소를 찾습니다.
    const element = document.getElementById(id); 
    
    // HTML 요소이거나 null일 수 있습니다.
    return element;
  }

  const handleCalendarClick = (calendar: any) => {
    let items: Maintenance[] = []
    calendar.children.map((task: Maintenance) => {
      items = [...items, task];
    })

    setSelectedTasks(items);
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { currentTarget } = e;
    if (leftRef.current && rightRef.current) {
      if (currentTarget === leftRef.current) {
        // 좌측에서 스크롤이 발생하면 우측의 스크롤 위치를 동기화
        rightRef.current.scrollTop = currentTarget.scrollTop;
      } else if (currentTarget === rightRef.current) {
        // 우측에서 스크롤이 발생하면 좌측의 스크롤 위치를 동기화
        leftRef.current.scrollTop = currentTarget.scrollTop;
      }
    }
  };

  const generateDateAndMonthHeaders = (startDate: Date, days: number) => {
    const dates: Date[] = [];
    const monthHeaders: MonthHeader[] = [];
    let currentMonth = '';
    let currentMonthSpan = 0;

    for (let i = 0; i < days; i++) {
      const date = addDays(startDate, i);
      dates.push(date);

      const month = format(date, 'yyyy-MM');
      if (month !== currentMonth) {
        // 새로운 월이 시작될 때 이전 월 정보 저장
        if (currentMonth !== '') {
          monthHeaders.push({ month: currentMonth, span: currentMonthSpan });
        }
        // 새로운 월 시작
        currentMonth = month;
        currentMonthSpan = 1;
      } else {
        currentMonthSpan++;
      }
    }
    // 마지막 월 정보 저장
    monthHeaders.push({ month: currentMonth, span: currentMonthSpan });
    
    return { dates, monthHeaders };
  };

  const { dates: dateRange, monthHeaders } = generateDateAndMonthHeaders(currentDate, 90);

  const getTaskPosition = (startDate: string) => {
    const start = new Date(startDate)
    const end = new Date(startDate)
    const rangeStart = dateRange[0]

    let startDay = Math.floor((start.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
    let duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    if (startDay < 0) {
      startDay = 0;
      duration = startDay + 1;
    }

    return {
      startDay: startDay,
      position: {
        left: `${(startDay) * dayWidth}px`,
        width: `${(duration) * dayWidth}px`, 
      }
    }
  }

  const getPriorityColor = (dueDate: Date | string) => {
    const date = new Date(dueDate);
    const diffInMs = date.getTime() - currentDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) {
      return "bg-red-500"
    }
    else if (diffInDays >= 0 && diffInDays <= 30) {
      return "bg-yellow-500"
    }
    else if (diffInDays >= 31 && diffInDays <= 60) {
      return "bg-green-500"
    }
    else if (diffInDays >= 61 && diffInDays <= 90) {
      return "bg-blue-500"
    }
  }

  const getRowHeight = (taskCount: number) => {
    const taskHeightWithMargin = 28; // h-6 (24px) + top (4px) + bottom (4px) or similar
    const minHeight = 80; // min-h-[80px]에 해당하는 값

    if (taskCount === 0) {
      return minHeight;
    }

    // (태스크 수 * 태스크 높이) + 상단/하단 여백
    const calculatedHeight = taskCount * taskHeightWithMargin + 8; // 예시: 상단 8px
    return Math.max(calculatedHeight, minHeight);
  };

  const getRowWidth = () => {
    const totalDateHeaderWidth = dateRange.length * dayWidth;

    return totalDateHeaderWidth;
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  // 최상위 overflow-hidden 제거: overflow 가 있으면 사이드바 sticky 가 window 스크롤에 반응하지 않음.
  // 간트 영역은 내부(scrollable-data-section)에서 자체 스크롤하므로 최상위 제한 불필요.
  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType={userInfo.user_auth} />
      <div className="flex">
        <Sidebar userType={userInfo.user_auth} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{userInfo.ship_name} - Equipment Maintenance Gantt Chart</h1>
            <p className="text-gray-600">Ship : {userInfo.ship_no}</p>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    기간: {dateRange.length > 0 ? `${format(dateRange[0], 'yyyy-MM-dd')} ~ ${format(dateRange[dateRange.length - 1], 'yyyy-MM-dd')}` : `${format(currentDate, 'yyyy-MM>-dd')}`}
                  </CardTitle>
                  <div className="flex gap-2">
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span className="text-sm">Delay</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-sm">High Priority</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-sm">Medium Priority</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-sm">Low Priority</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`gantt-container flex border min-h-[500px]`}>
                  {/* 좌측 고정 영역 */}
                  <div
                    ref={leftRef}
                    className="fixed-title-section w-64 bg-gray-50 overflow-y-auto"
                    onScroll={handleScroll}
                  >
                    <div className="flex border-b min-h-[91px]" style={{ height: "91px" }}>
                      <div className="w-64 p-2 font-medium bg-gray-50 border-r">Equipment</div>
                    </div>
                    
                    {/* 장비 목록 (세로 스크롤됨) */}
                    {calendarEquipments.map((equipment, equipIndex) => (
                    <div 
                      key={equipment.equip_no} 
                      className="border-b"
                      ref={(el: HTMLDivElement | null) => {
                        leftItemRefs.current[equipIndex] = el;
                      }}
                    >
                      <div className="flex items-center min-h-[80px]">
                        <div className="w-64 p-4 border-r bg-gray-50">
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            <span className="font-medium">{equipment.equip_name}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {equipment.children?.length} task{equipment.children?.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>

                  {/* Date Header */}
                  <div
                    ref={rightRef}
                    className="scrollable-data-section flex-1 overflow-x-auto overflow-y-auto"
                    onScroll={handleScroll}
                  >

                    {/* 1. 월 헤더 */}
                    <div className="flex border-b w-max max-h-[41px]">
                      {monthHeaders.map((header, index) => (
                        <div 
                          key={index}
                          className="p-2 text-center bg-gray-50 font-medium border-l"
                          style={{ width: `${header.span * dayWidth}px` }}
                        >
                          {format(new Date(header.month), 'yy-MM')}
                        </div>
                      ))}
                    </div>
                    <div className="flex border-b w-max max-h-[50px]" style={{ height: "50px" }}> {/* w-max로 내용이 넘치도록 설정 */}
                      {/* 2. 날짜 헤더 */}
                      {dateRange.map((date, index) => (
                        <div
                          key={index}
                          className='flex-1 p-2 text-xs text-center border-l bg-gray-50'
                        >
                          <div className={`font-medium w-[25px] ${date.toLocaleDateString("en", { weekday: "short" }) === 'Sat' ? 'text-blue-500' : date.toLocaleDateString("en", { weekday: "short" }) === 'Sun' ? 'text-red-500' : 'text-Black-500'}`}>{date.getDate()}</div>
                          <div className={date.toLocaleDateString("en", { weekday: "short" }) === 'Sat' ? 'text-blue-500' : date.toLocaleDateString("en", { weekday: "short" }) === 'Sun' ? 'text-red-500' : 'text-gray-500'}>{date.toLocaleDateString("en", { weekday: "short" })}</div>
                        </div>
                      ))}
                    </div>
                    {/* Equipment Rows with Tasks */}
                    {calendarEquipments.map((equipment, equipIndex) => {
                      let index: number = -1;
                      let currentDay: number = -1;

                      return (
                      <div 
                        key={equipment.equip_no} 
                        className="border-b"
                        ref={(el: HTMLDivElement | null) => {
                          rightItemRefs.current[equipIndex] = el;
                        }}
                        style={{ height: `${getRowHeight(equipment.children.length)}px`, width: `${getRowWidth()}px` }}
                      >
                        <div className="flex items-center">
                          <div className="flex-1 relative p-2">
                            {equipment.children.map((calendar, taskIndex) => {
                              const position = getTaskPosition(calendar.calendar_date)

                              if (currentDay !== position.startDay) {
                                index = -1;
                                currentDay = position.startDay
                              }
                              
                              index++;
                              
                              return (
                                <div
                                  key={`${equipment.equip_no}-${calendar.calendar_date}-${taskIndex}`}
                                  className={`absolute h-6 rounded cursor-pointer transition-all text-center hover:opacity-80 ${getPriorityColor(calendar.calendar_date)}`}
                                  style={{
                                    ...position.position,
                                    top: `${index * 28 + 15}px`,
                                    zIndex: 10,
                                  }}
                                  onClick={() => handleCalendarClick(calendar)}
                                  data-tooltip-id="calendar-tooltip"
                                  data-tooltip-content={`${calendar.children.length} 건`} // 툴팁에 표시할 내용
                                  data-tooltip-place="top"
                                >
                                  <div className="px-2 py-1 text-xs text-white font-medium truncate">{calendar.children.length} 건</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )})}
                    <Tooltip id="calendar-tooltip" />
                  </div>
                </div>                
              </CardContent>
            </Card>
            {selectedTasks.length > 0 && (
              <Card id="main_task">
                <CardContent>
                  <div className="p-2">
                    <div className="flex items-center gap-3 text-xl">
                      <h3 className="font-medium text-lg">Task Details</h3>
                    </div>
                  </div>
                  {selectedTasks.map((task) => (
                    <div key={`${task.equip_no}-${task.section_code}-${task.plan_code}`} className="p-2">
                      <Card>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center gap-3 text-xl">
                                <h3 className="font-medium text-lg">{task.plan_name}</h3>
                                <div className="flex items-center gap-2 mt-2 text-sm">
                                  <span className="text-gray-500">({`${task.equip_no}-${task.section_code}-${task.plan_code}`})</span>
                                </div>
                                {task.critical && getCriticalBadge(task.critical)}
                                {task.self_maintenance && task.self_maintenance === 'Y' && (
                                  <Badge variant="default" className="text-xs px-1 py-0">
                                    Self Maintenance
                                  </Badge>
                                )}
                                {getStatusBadge(task.status)}
                              </div>
                            </div>

                            <div className="grid grid-cols-5 gap-5 text-sm">
                              <div className="flex gap-2">
                                <span className="text-gray-600">담당자</span>
                                <div className="font-medium">{task.manager}</div>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-600">작업 위치</span>
                                <div className="font-medium capitalize">{task.location}</div>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-600">최근 정비</span>
                                <div className="font-medium">{task.lastest_date}</div>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-600">{task.extension_date ? '이전 예정일' : '예정일'}</span>
                                <div className="font-medium">{task.due_date}</div>
                              </div>
                              {task.extension_date && (
                                <div className="flex gap-2">
                                  <span className="text-gray-600">연장일</span>
                                  <div className="font-medium">{task.extension_date}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-4">
                    <Button size="sm" variant="outline" onClick={() => setSelectedTasks([])} style={{cursor: 'pointer'}}>
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
