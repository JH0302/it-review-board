// 순수 JS 기반의 파일(JSON) 저장소.
// better-sqlite3 같은 네이티브 모듈을 쓰지 않아 사내망/오프라인 환경에서도
// npm install / docker build 가 항상 안정적으로 됩니다.
// Node.js는 싱글 스레드로 요청을 순차 처리하고 모든 쓰기가 동기(synchronous)로
// 이루어지므로, 여러 사람이 동시에 접속해도 데이터가 꼬이지 않습니다.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function emptyState() {
  return {
    users: [],
    requests: [],
    requestFiles: [],
    comments: [],
    commentFiles: [],
    seq: { users: 0, requests: 0, requestFiles: 0, comments: 0, commentFiles: 0 },
  };
}

let state;
if (fs.existsSync(DB_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('[store] db.json 파싱 실패, 새로 시작합니다:', e.message);
    state = emptyState();
  }
} else {
  state = emptyState();
}
// 이전 버전 파일과의 호환을 위해 누락된 키 보정
const defaults = emptyState();
for (const k of Object.keys(defaults)) {
  if (!(k in state)) state[k] = defaults[k];
}
for (const k of Object.keys(defaults.seq)) {
  if (!(k in state.seq)) state.seq[k] = 0;
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DB_FILE);
}

function nextId(table) {
  state.seq[table] = (state.seq[table] || 0) + 1;
  return state.seq[table];
}

function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 최초 관리자 계정 시드
if (state.users.length === 0) {
  const passwordHash = bcrypt.hashSync('admin1234', 10);
  const id = nextId('users');
  state.users.push({
    id,
    username: 'admin',
    password_hash: passwordHash,
    name: '관리자',
    emp_no: '00000',
    department: '선정관리팀',
    role: 'admin',
    created_at: nowStr(),
  });
  save();
  console.log('[seed] 초기 관리자 계정 생성: username=admin / password=admin1234 (반드시 로그인 후 비밀번호를 변경하세요)');
}

module.exports = { state, save, nextId, nowStr, todayStr, UPLOAD_DIR, DATA_DIR };
