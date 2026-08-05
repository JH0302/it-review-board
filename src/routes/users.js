const express = require('express');
const { state, save } = require('../store');
const { requireAdmin } = require('../auth');

const router = express.Router();

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    emp_no: u.emp_no,
    department: u.department,
    role: u.role,
    created_at: u.created_at,
  };
}

// 사용자 목록 (관리자 전용). role/emp_no 쿼리로 필터링 가능
// - role=admin : 현재 관리자 목록 (사용자 권한 관리 화면 기본 목록)
// - emp_no=xxx : 사번으로 검색 (관리자 추가 시 검색용, 전체 인원이 노출되지 않도록 검색어 필수)
router.get('/', requireAdmin, (req, res) => {
  const { role, emp_no } = req.query;
  let users = state.users.slice();
  if (role && ['admin', 'requester'].includes(role)) {
    users = users.filter((u) => u.role === role);
  }
  if (emp_no) {
    const needle = String(emp_no).trim().toLowerCase();
    users = users.filter((u) => u.emp_no.toLowerCase().includes(needle));
  }
  users.sort((a, b) => a.id - b.id);
  res.json({ users: users.map(toPublicUser) });
});

// 권한 변경 (관리자 전용, 본인 권한은 변경 불가)
router.patch('/:id/role', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { role } = req.body || {};
  if (!['admin', 'requester'].includes(role)) {
    return res.status(400).json({ error: '권한 값이 올바르지 않습니다.' });
  }
  if (id === req.session.user.id) {
    return res.status(400).json({ error: '본인의 권한은 변경할 수 없습니다.' });
  }
  const user = state.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: '해당 사용자를 찾을 수 없습니다.' });
  user.role = role;
  save();
  res.json({ user: toPublicUser(user) });
});

module.exports = router;
