/**
 * BIO ARCADE 랭킹 · 입력 기록 요약 — 구글 Apps Script 웹 앱
 *
 * 설치
 *  1) 구글 시트 → 확장 프로그램 → Apps Script 에 이 파일 전체를 붙여 넣기
 *  2) 왼쪽 ⚙️ 프로젝트 설정 → 스크립트 속성 → 속성 추가
 *       ADMIN_PASS = (새 관리자 비밀번호)   ← 예전 비밀번호(1211)는 이미 공개되었으니 꼭 새로 정하세요
 *  3) 배포 → 새 배포 → 유형: 웹 앱, 실행: 나, 액세스: 모든 사용자 → 배포한 /exec 주소를 메인 화면 관리자 모드에 입력
 *
 * 관리자 비밀번호는 이 서버에서만 확인합니다. 웹 페이지 소스에는 들어 있지 않습니다.
 */
const SHEET_RANK = 'ranking';
const SHEET_LOG = 'input_log';
const RANK_HEAD = ['uid', 'stId', 'name', 'env', 'totalScore', 'playedCount', 'updatedAt', 'json'];
const LOG_HEAD = ['time', 'uid', 'stId', 'name', 'device', 'game', 'runs', 'userInputs', 'gameInputs', 'results', 'gapNoAction', 'gapNoResult'];

function sheet_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function adminOk_(p) {
  const pass = PropertiesService.getScriptProperties().getProperty('ADMIN_PASS');
  if (!pass || !p || typeof p.adminPass !== 'string') return false;
  // 같은 길이 비교 (시간차로 비밀번호를 추측하기 어렵게)
  const a = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p.adminPass), b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pass);
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function readRank_() {
  const sh = sheet_(SHEET_RANK, RANK_HEAD), v = sh.getDataRange().getValues(); v.shift();
  return v.filter(r => r[0]).map(r => { try { return JSON.parse(r[7]); } catch (e) { return {uid: r[0], stId: r[1], name: r[2], env: r[3], totalScore: r[4], playedCount: r[5], updatedAt: r[6]}; } });
}
function findRow_(sh, uid) {
  const ids = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(uid)) return i + 1;
  return 0;
}
function writeRec_(rec) {
  const sh = sheet_(SHEET_RANK, RANK_HEAD), uid = String(rec.uid || ''); if (!uid) return;
  const clean = {uid, stId: String(rec.stId || '').slice(0, 20), name: String(rec.name || '').slice(0, 30), env: String(rec.env || '').slice(0, 60),
    totalScore: Number(rec.totalScore) || 0, playedCount: Number(rec.playedCount) || 0, games: rec.games || {}, updatedAt: rec.updatedAt || new Date().toISOString()};
  const row = [uid, clean.stId, clean.name, clean.env, clean.totalScore, clean.playedCount, clean.updatedAt, JSON.stringify(clean)];
  const r = findRow_(sh, uid);
  if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
}

function doGet(e) { return out_({records: readRank_()}); }

function doPost(e) {
  let p = {}; try { p = JSON.parse(e.postData.contents); } catch (err) { return out_({ok: false, error: 'bad json'}); }
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    switch (p.action) {
      case 'auth': return out_({auth: adminOk_(p)});
      case 'upsert': writeRec_(p); return out_({ok: true});
      case 'logsum': {   // 입력 기록 요약 (판 수 · 단계별 끊김 횟수만, 입력 내용 자체는 올리지 않음)
        const sh = sheet_(SHEET_LOG, LOG_HEAD);
        (p.rows || []).slice(0, 50).forEach(r => sh.appendRow([new Date(), p.uid || '', p.stId || '', p.name || '', p.device || '', r.game || '', r.runs || 0, r.user || 0, r.game_ || 0, r.result || 0, r.gapNoAction || 0, r.gapNoResult || 0]));
        return out_({ok: true});
      }
      case 'update': if (!adminOk_(p)) return out_({ok: false, auth: false}); writeRec_(p); return out_({ok: true});
      case 'delete': {
        if (!adminOk_(p)) return out_({ok: false, auth: false});
        const sh = sheet_(SHEET_RANK, RANK_HEAD), r = findRow_(sh, p.uid); if (r) sh.deleteRow(r);
        return out_({ok: true});
      }
      case 'clear': {
        if (!adminOk_(p)) return out_({ok: false, auth: false});
        const sh = sheet_(SHEET_RANK, RANK_HEAD); if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
        return out_({ok: true});
      }
      default: return out_({ok: false, error: 'unknown action'});
    }
  } finally { lock.releaseLock(); }
}
