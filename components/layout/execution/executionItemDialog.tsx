// import { Maintenance } from '@/types/dashboard/maintenance';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
// import { useState , useEffect } from 'react';
// import { Label } from "@/components/ui/label"
// import EquipmentRuntimeInput from "@/components/layout/equipmentRuntime/equipmentRuntimeInput"
// import { Input } from "@/components/ui/input"
// import { Button } from "@/components/ui/button"
// import { Textarea } from "@/components/ui/textarea"




// interface Props {
//   isDialogOpen: boolean,
//   maintenanceItem: Maintenance,
//   handleRuntimeChanged: (runtime: number) => void
// }

// export default function ExecutionItemDialog({ isDialogOpen ,maintenanceItem, handleRuntimeChanged }: Props) {
//   const [isOpen, setIsOpen] = useState(true)
//   const [item, setItem] = useState<Maintenance>()

//   useEffect(()=>(
//     setIsOpen(isDialogOpen)
//   ),[isDialogOpen])

  
//   useEffect(()=>(
//     setItem(maintenanceItem)
//   ),[maintenanceItem])
  
// return(
//   <Dialog open={isOpen} onOpenChange={setIsOpen}>
//     <DialogContent>
//       <DialogHeader>
//         <DialogTitle>작업 실행 등록</DialogTitle>
//       </DialogHeader>
//       <div className="space-y-4">
//         <div className="grid grid-cols-2 gap-2">
//           <div>
//             <Label className="text-xs">실제 소요시간</Label>
//             <Input
//               type="number"
//               placeholder="시간"
//               value={item?.work_hours}
//               onChange={(e) => updateTaskData(selectedWork.equip_no, selectedWork.section_code, selectedWork.plan_code, "work_hours", e.target.value)}
//               className="text-sm"
//             />
//           </div>
//           <div>
//             <Label className="text-xs">다음 정비일자</Label>
//             <Input
//               type="date"
//               placeholder="정비일자"
//               value={item?.next_due_date}
//               className='text-sm sm:w-40 md:w-36'
//               disabled
//             />
//           </div>
//         </div>

//         {item?.interval_term === 'HOURS' && (
//           <EquipmentRuntimeInput
//             equip_name={item?.equip_name}
//             machine_name={item?.machine_name}
//             handleRuntimeChanged={(runtime) => updateTaskData(selectedWork.equip_no, selectedWork.section_code, selectedWork.plan_code, "lastest_run_time", String(runtime))}
//             />
//         )}

//         <div>
//           <Label htmlFor="parts-used">사용 부품</Label>
//           <div className="flex flex-row gap-4">
//             <Input
//               id="parts-used"
//               placeholder="부품명"
//               value={item?.used_partnanes}
//               disabled
//               />
//             <Button
//               id="parts-select"
//               onClick={() => handleInventoryOpen(item?, true)}>...</Button>
//           </div>
//         </div>
//         <div>
//           <Label htmlFor="notes">작업 내용</Label>
//           <Textarea
//             id="notes"
//             placeholder="이 작업에 대한 내용을 입력하세요..."
//             value={executionResult.work_details}
//             onChange={(e) => setExecutionResult((prev) => ({ ...prev, work_details: e.target.value }))}
//             rows={3}
//             />
//         </div>
//         {selectedWork.status === "DELAYED" && (
//           <div>
//             <Label className="text-xs">지연 사유</Label>
//             <Textarea
//               placeholder="이 작업에 대한 지연 사유..."
//               value={executionResult.delay_reason}
//               onChange={(e) => setExecutionResult((prev) => ({ ...prev, delay_reason: e.target.value }))}
//               rows={2}
//               className="text-sm"
//             />
//           </div>
//         )}
//       </div>
//       <DialogFooter>
//         <Button variant="outline" onClick={() => setIsExecutionDialogOpen(false)}>
//           취소
//         </Button>
//         <Button 
//           onClick={handleInsertExecution} 
//           className="bg-blue-600 hover:bg-blue-700"
//           disabled={!executionResult.work_details || (executionResult.status === "DELAYED" && !executionResult.delay_reason) }
//           style={{cursor: 'pointer'}}
//         >
//           등록 완료
//         </Button>
//       </DialogFooter>
//     </DialogContent>
//   </Dialog>
//   )
// }