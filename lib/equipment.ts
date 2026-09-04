/**
 * 비상 발전기(Emergency Generator) 판별.
 *
 * 비상 발전기는 상시 운전하지 않고 점검·비상 시에만 가동하므로 운전시간을 누적 관리하지 않는다.
 * 따라서 정비 기록 기입 시 운전시간을 입력받지 않고, 저장도 하지 않는다.
 *
 * 선박마다 표기가 달라 다음 형태를 모두 인식한다.
 *   EM'CY GENERATOR ENGINE / EMERGENCY GENERATOR / EM'CY G/E / EMG'Y GENERATOR ...
 */
export function isEmergencyGenerator(equipName?: string | null, machineName?: string | null) {
  const raw = `${equipName ?? ""} ${machineName ?? ""}`.toUpperCase()

  // 작은따옴표·공백·마침표·슬래시·하이픈을 제거해 EM'CY / EM.C.Y / EMCY 표기 차이를 흡수한다.
  const compact = raw.replace(/['’\s./-]/g, "")
  const isEmergency = ["EMCY", "EMGY", "EMERGENCY"].some((mark) => compact.includes(mark))
  if (!isEmergency) return false

  // 발전기 계열 표기만 인정한다.
  // EMERGENCY 라는 단어 자체에 GE 가 들어 있으므로, 붙여쓴 문자열이 아닌 원문에서 단어 단위로 찾는다.
  // (그렇지 않으면 EMERGENCY FIRE PUMP 같은 비발전기 장비까지 걸린다)
  return /GENERATOR/.test(raw) || /\bG\s*\/\s*E\b/.test(raw) || /\bGE\b/.test(raw)
}
