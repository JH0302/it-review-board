const express = require('express');
const bcrypt = require('bcryptjs');
const { state, save, nextId, nowStr } = require('../store');
const { requireLogin } = require('../auth');

const router = express.Router();

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    emp_no: u.emp_no,
    department: u.department,
    role: u.role,
  };
}

router.post('/register', (req, res) => {
  const { username, password, name, emp_no, department } = req.body || {};
  if (!username || !password || !name || !emp_no || !department) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
  }
  const existing = state.users.find((u) => u.username === username);
  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }
  const passwordHash = bcrypt.hashSync(String(password), 10);
  const user = {
    id: nextId('users'),
    username,
    password_hash: passwordHash,
    name,
    emp_no,
    department,
    role: 'requester',
    created_at: nowStr(),
  };
  state.users.push(user);
  save();
  req.session.user = toPublicUser(user);
  res.json({ user: toPublicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }
  const user = state.users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  req.session.user = toPublicUser(user);
  res.json({ user: toPublicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.json({ user: req.session.user });
});

router.post('/change-password', requireLogin, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
  }
  if (String(new_password).length < 4) {
    return res.status(400).json({ error: '새 비밀번호는 4자 이상이어야 합니다.' });
  }
  const user = state.users.find((u) => u.id === req.session.user.id);
  if (!bcrypt.compareSync(String(current_password), user.password_hash)) {
    return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  }
  user.password_hash = bcrypt.hashSync(String(new_password), 10);
  save();
  res.json({ ok: true });
});

module.exports = router;
