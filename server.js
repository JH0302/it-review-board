const path = require('path');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

require('./src/store'); // ensures data 폴더/파일 초기화 및 최초 관리자 계정 시드

const authRoutes = require('./src/routes/auth');
const requestRoutes = require('./src/routes/requests');
const userRoutes = require('./src/routes/users');
const { FILE_CATEGORIES, PURCHASE_TYPES } = require('./src/constants');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new FileStore({ path: path.join(__dirname, 'data', 'sessions'), logFn: () => {} }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12시간
    httpOnly: true,
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);

app.get('/api/meta', (req, res) => {
  res.json({ fileCategories: FILE_CATEGORIES, purchaseTypes: PURCHASE_TYPES });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.message && err.message.includes('File too large')) {
    return res.status(413).json({ error: '파일 용량이 너무 큽니다. (최대 50MB)' });
  }
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`IT선정 도입의뢰 사전검토 시스템이 http://localhost:${PORT} 에서 실행 중입니다.`);
});
