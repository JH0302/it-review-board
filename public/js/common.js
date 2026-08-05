const API = {
  async get(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    return API._handle(res);
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
    return API._handle(res);
  },
  async postForm(url, formData) {
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', body: formData });
    return API._handle(res);
  },
  async patch(url, body) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
    return API._handle(res);
  },
  async patchForm(url, formData) {
    const res = await fetch(url, { method: 'PATCH', credentials: 'same-origin', body: formData });
    return API._handle(res);
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    return API._handle(res);
  },
  async _handle(res) {
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `요청 실패 (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
};

function showToast(message, isError) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2600);
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('ko-KR') + '원';
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

const STATUS_LABEL = { reviewing: '검토중', completed: '검토완료' };
const REQUEST_CATEGORY_LABEL = { purchase: '구매', maintenance: '유지보수' };
const PURCHASE_TYPE_LABEL = { hw: 'H/W', sw: 'S/W', si: '개발용역', lease_sw: '임차 S/W', etc: '기타' };

// 첨부파일 카테고리: 공통(맨 앞) + 구매/유지보수 전용 + 공통(맨 뒤) (신규 등록 폼에서 구분에 따라 다른 목록을 보여줌)
const COMMON_FILE_CATEGORY_LABEL_FIRST = {
  pre_estimate: '사전견적서',
};
const PURCHASE_FILE_CATEGORY_LABEL = {
  purchase_introduction_request: '도입의뢰 문서',
  purchase_detail: '세부구매내역',
  disposal_detail: '불용매각 상세',
  build_requirements: '구축요건정의서',
  tech_review: '기술검토 결과서',
  security_review: '보안성검토결과서',
  biz_proposal: '사업추진안(부의자료)',
  biz_approval: '사업승인문서',
  budget_allocation: '예산배정문서',
};
const MAINTENANCE_FILE_CATEGORY_LABEL = {
  biz_budget_request: '사업추진의뢰 및 예산배정 요청 문서',
  proposal_doc: '추진(안)',
  introduction_request: '도입의뢰',
  auto_renewal_checklist: '자동연장체크리스트',
};
const COMMON_FILE_CATEGORY_LABEL_LAST = {
  etc_required_doc: '기타 필요 문서',
};
// 상세페이지 등에서 카테고리 키 -> 라벨 조회용 통합 맵
const FILE_CATEGORY_LABEL = {
  ...COMMON_FILE_CATEGORY_LABEL_FIRST,
  ...PURCHASE_FILE_CATEGORY_LABEL,
  ...MAINTENANCE_FILE_CATEGORY_LABEL,
  ...COMMON_FILE_CATEGORY_LABEL_LAST,
};

// Guards current page & renders sidebar nav/user info for the given nav key. Returns the current user or null (redirects to login).
async function requireAuth(activeNavKey) {
  try {
    const { user } = await API.get('/api/auth/me');
    renderSidebarUser(user);
    renderSidebarNav(user, activeNavKey);
    return user;
  } catch (e) {
    window.location.href = '/login.html';
    return null;
  }
}

function renderSidebarUser(user) {
  const el = document.getElementById('sidebarUser');
  if (!el) return;
  el.innerHTML = `
    <div class="name">${escapeHtml(user.name)} (${escapeHtml(user.department)})</div>
    <div>${escapeHtml(user.emp_no)}</div>
    <span class="role-badge">${user.role === 'admin' ? '관리자' : '의뢰자'}</span>
    <button id="logoutBtn" type="button">로그아웃</button>
  `;
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await API.post('/api/auth/logout');
    window.location.href = '/login.html';
  });
}

// 사전검토 목록은 의뢰자/관리자 공용 화면(같은 index.html, 관리자는 전체건/의뢰자는 본인건만 조회).
// 검토 대기·사용자 관리는 선정담당자(관리자)만 쓰는 메뉴라 의뢰자에게는 아예 노출하지 않음.
function renderSidebarNav(user, activeKey) {
  const el = document.getElementById('sidebarNav');
  if (!el) return;
  const items = [{ key: 'list', href: '/index.html', label: '사전검토 목록' }];
  if (user.role === 'admin') {
    items.push({ key: 'pending', href: '/admin.html', label: '검토 대기' });
    items.push({ key: 'users', href: '/admin-users.html', label: '사용자 권한 관리' });
  }
  el.innerHTML = items.map((it) => `<a href="${it.href}" class="${it.key === activeKey ? 'active' : ''}">${escapeHtml(it.label)}</a>`).join('');
}

// 관리자 전용 페이지에 의뢰자가 URL을 직접 입력해 들어온 경우를 대비한 방어용 안내
function renderAccessDenied() {
  const el = document.querySelector('.content');
  if (el) {
    el.innerHTML = '<div class="panel" style="text-align:center;color:var(--text-muted);padding:60px 20px;font-size:14px;">권한이 없습니다.<br>이 페이지는 관리자만 접근할 수 있습니다.</div>';
  }
}
