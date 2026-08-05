const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const archiver = require('archiver');
const { state, save, nextId, nowStr, todayStr, UPLOAD_DIR } = require('../store');
const { requireLogin, requireAdmin } = require('../auth');
const { FILE_CATEGORY_KEYS, PURCHASE_TYPE_KEYS, REQUEST_CATEGORY_KEYS } = require('../constants');

const router = express.Router();

const tempUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safeExt = path.extname(file.originalname).slice(0, 20);
      const rand = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${rand}${safeExt}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 60 },
});

const uploadFields = FILE_CATEGORY_KEYS.map((k) => ({ name: k, maxCount: 10 }));

// multer/busboy는 멀티파트 파일명을 기본적으로 latin1로 디코딩하므로,
// 브라우저가 UTF-8로 보낸 한글 파일명은 latin1 -> utf8 재해석으로 복원해야 함.
function fixFilename(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

function findUser(id) {
  return state.users.find((u) => u.id === id);
}

function serializeRequest(r) {
  const requester = findUser(r.requester_user_id);
  const reviewer = r.reviewed_by_user_id ? findUser(r.reviewed_by_user_id) : null;
  return {
    id: r.id,
    request_category: r.request_category || 'purchase',
    request_date: r.request_date,
    project_name: r.project_name,
    purchase_types: r.purchase_types,
    budget: r.budget,
    vat_refund_target: !!r.vat_refund_target,
    biz_plan_no: r.biz_plan_no,
    disposal_sale: !!r.disposal_sale,
    pre_budget_consult: !!r.pre_budget_consult,
    group_joint_business: !!r.group_joint_business,
    special_notes: r.special_notes,
    status: r.status,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    requester: requester ? {
      id: requester.id, name: requester.name, emp_no: requester.emp_no, department: requester.department,
    } : null,
    reviewer: reviewer ? { name: reviewer.name } : null,
  };
}

// LIST
router.get('/', requireLogin, (req, res) => {
  const user = req.session.user;
  const { status, purchase_type, year, q, category } = req.query;

  let rows = state.requests.slice();
  if (user.role !== 'admin') {
    rows = rows.filter((r) => r.requester_user_id === user.id);
  }
  if (category && REQUEST_CATEGORY_KEYS.includes(category)) {
    rows = rows.filter((r) => (r.request_category || 'purchase') === category);
  }
  if (status && ['reviewing', 'completed'].includes(status)) {
    rows = rows.filter((r) => r.status === status);
  }
  if (year) {
    rows = rows.filter((r) => String(r.request_date || '').slice(0, 4) === String(year));
  }
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter((r) => r.project_name.toLowerCase().includes(needle));
  }
  if (purchase_type) {
    rows = rows.filter((r) => (r.purchase_types || []).includes(purchase_type));
  }
  rows.sort((a, b) => b.id - a.id);

  res.json({ requests: rows.map(serializeRequest) });
});

// CREATE
router.post('/', requireLogin, tempUpload.fields(uploadFields), (req, res) => {
  const user = req.session.user;
  const body = req.body || {};
  const { project_name, budget, biz_plan_no, special_notes, request_date } = body;

  if (!project_name || !String(project_name).trim()) {
    return res.status(400).json({ error: '사업명을 입력해주세요.' });
  }

  const requestCategory = REQUEST_CATEGORY_KEYS.includes(body.request_category) ? body.request_category : 'purchase';
  const isPurchase = requestCategory === 'purchase';

  let purchaseTypes = [];
  if (isPurchase) {
    try {
      purchaseTypes = JSON.parse(body.purchase_types || '[]');
      if (!Array.isArray(purchaseTypes)) throw new Error('bad');
    } catch {
      return res.status(400).json({ error: '구매대상 형식이 올바르지 않습니다.' });
    }
    purchaseTypes = purchaseTypes.filter((t) => PURCHASE_TYPE_KEYS.includes(t));
    if (purchaseTypes.length === 0) {
      return res.status(400).json({ error: '구매대상을 1개 이상 선택해주세요.' });
    }
  }

  const vatRefundTarget = body.vat_refund_target === 'true' || body.vat_refund_target === '1';
  const disposalSale = isPurchase && (body.disposal_sale === 'true' || body.disposal_sale === '1');
  const preBudgetConsult = !isPurchase && (body.pre_budget_consult === 'true' || body.pre_budget_consult === '1');
  const groupJointBusiness = body.group_joint_business === 'true' || body.group_joint_business === '1';
  const budgetNum = Math.max(0, parseInt(budget, 10) || 0);
  const reqDate = request_date && /^\d{4}-\d{2}-\d{2}$/.test(request_date) ? request_date : todayStr();

  const now = nowStr();
  const newRequest = {
    id: nextId('requests'),
    request_category: requestCategory,
    request_date: reqDate,
    project_name: String(project_name).trim(),
    requester_user_id: user.id,
    purchase_types: purchaseTypes,
    budget: budgetNum,
    vat_refund_target: vatRefundTarget,
    biz_plan_no: isPurchase ? (biz_plan_no || '').trim() : '',
    disposal_sale: disposalSale,
    pre_budget_consult: preBudgetConsult,
    group_joint_business: groupJointBusiness,
    special_notes: (special_notes || '').trim(),
    status: 'reviewing',
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };
  state.requests.push(newRequest);

  const files = req.files || {};
  const destDir = path.join(UPLOAD_DIR, 'requests', String(newRequest.id));
  for (const category of Object.keys(files)) {
    if (!FILE_CATEGORY_KEYS.includes(category)) continue;
    for (const f of files[category]) {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const finalPath = path.join(destDir, f.filename);
      fs.renameSync(f.path, finalPath);
      state.requestFiles.push({
        id: nextId('requestFiles'),
        request_id: newRequest.id,
        category,
        original_name: fixFilename(f.originalname),
        stored_name: path.join('requests', String(newRequest.id), f.filename),
        size: f.size,
        uploaded_by_user_id: user.id,
        uploaded_at: now,
      });
    }
  }

  save();
  res.status(201).json({ id: newRequest.id });
});

function loadRequestOr404(req, res) {
  const id = parseInt(req.params.id, 10);
  const row = state.requests.find((r) => r.id === id);
  if (!row) {
    res.status(404).json({ error: '해당 건을 찾을 수 없습니다.' });
    return null;
  }
  const user = req.session.user;
  if (user.role !== 'admin' && row.requester_user_id !== user.id) {
    res.status(403).json({ error: '조회 권한이 없습니다.' });
    return null;
  }
  return row;
}

// DETAIL
router.get('/:id', requireLogin, (req, res) => {
  const row = loadRequestOr404(req, res);
  if (!row) return;

  const files = state.requestFiles.filter((f) => f.request_id === row.id).sort((a, b) => a.id - b.id);
  const comments = state.comments.filter((c) => c.request_id === row.id).sort((a, b) => a.id - b.id);

  const data = serializeRequest(row);
  data.files = files.map((f) => ({
    id: f.id, category: f.category, original_name: f.original_name, size: f.size, uploaded_at: f.uploaded_at,
  }));
  data.comments = comments.map((c) => {
    const author = findUser(c.author_user_id);
    const cFiles = state.commentFiles.filter((cf) => cf.comment_id === c.id);
    return {
      id: c.id,
      author_name: author ? author.name : '(알 수 없음)',
      author_role: author ? author.role : 'requester',
      comment_text: c.comment_text,
      created_at: c.created_at,
      updated_at: c.updated_at || null,
      files: cFiles.map((cf) => ({ id: cf.id, original_name: cf.original_name, size: cf.size })),
    };
  });
  res.json({ request: data });
});

// 의뢰자 본인이, 검토중 상태일 때만 수정 가능 (검토완료 후에는 내용 고정)
function canEdit(row, user) {
  return !!row && row.requester_user_id === user.id && row.status === 'reviewing';
}

// EDIT (내용 수정 + 새 첨부파일 추가) - 의뢰자 본인, 검토중 상태만
router.patch('/:id', requireLogin, tempUpload.fields(uploadFields), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = state.requests.find((r) => r.id === id);
  if (!row) return res.status(404).json({ error: '해당 건을 찾을 수 없습니다.' });
  if (!canEdit(row, req.session.user)) {
    return res.status(403).json({ error: '수정 권한이 없거나, 이미 검토완료된 건은 수정할 수 없습니다.' });
  }

  const body = req.body || {};
  const { project_name, budget, biz_plan_no, special_notes, request_date } = body;
  if (!project_name || !String(project_name).trim()) {
    return res.status(400).json({ error: '사업명을 입력해주세요.' });
  }

  // 구분(구매/유지보수)은 등록 후 변경 불가 - 기존 값 그대로 사용
  const isPurchase = (row.request_category || 'purchase') !== 'maintenance';

  if (isPurchase) {
    let purchaseTypes;
    try {
      purchaseTypes = JSON.parse(body.purchase_types || '[]');
      if (!Array.isArray(purchaseTypes)) throw new Error('bad');
    } catch {
      return res.status(400).json({ error: '구매대상 형식이 올바르지 않습니다.' });
    }
    purchaseTypes = purchaseTypes.filter((t) => PURCHASE_TYPE_KEYS.includes(t));
    if (purchaseTypes.length === 0) {
      return res.status(400).json({ error: '구매대상을 1개 이상 선택해주세요.' });
    }
    row.purchase_types = purchaseTypes;
    row.biz_plan_no = (biz_plan_no || '').trim();
    row.disposal_sale = body.disposal_sale === 'true' || body.disposal_sale === '1';
  } else {
    row.pre_budget_consult = body.pre_budget_consult === 'true' || body.pre_budget_consult === '1';
  }

  row.project_name = String(project_name).trim();
  row.budget = Math.max(0, parseInt(budget, 10) || 0);
  row.vat_refund_target = body.vat_refund_target === 'true' || body.vat_refund_target === '1';
  row.group_joint_business = body.group_joint_business === 'true' || body.group_joint_business === '1';
  row.special_notes = (special_notes || '').trim();
  if (request_date && /^\d{4}-\d{2}-\d{2}$/.test(request_date)) row.request_date = request_date;

  const now = nowStr();
  row.updated_at = now;

  // 새로 첨부한 파일 추가 (기존 파일은 별도 삭제 API로 제거)
  const user = req.session.user;
  const files = req.files || {};
  const destDir = path.join(UPLOAD_DIR, 'requests', String(row.id));
  for (const category of Object.keys(files)) {
    if (!FILE_CATEGORY_KEYS.includes(category)) continue;
    for (const f of files[category]) {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const finalPath = path.join(destDir, f.filename);
      fs.renameSync(f.path, finalPath);
      state.requestFiles.push({
        id: nextId('requestFiles'),
        request_id: row.id,
        category,
        original_name: fixFilename(f.originalname),
        stored_name: path.join('requests', String(row.id), f.filename),
        size: f.size,
        uploaded_by_user_id: user.id,
        uploaded_at: now,
      });
    }
  }

  save();
  res.json({ ok: true });
});

// 첨부파일 삭제 - 의뢰자 본인, 검토중 상태만
router.delete('/files/:fileId', requireLogin, (req, res) => {
  const fileId = parseInt(req.params.fileId, 10);
  const file = state.requestFiles.find((f) => f.id === fileId);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  const row = state.requests.find((r) => r.id === file.request_id);
  if (!canEdit(row, req.session.user)) {
    return res.status(403).json({ error: '삭제 권한이 없거나, 이미 검토완료된 건은 수정할 수 없습니다.' });
  }
  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  state.requestFiles = state.requestFiles.filter((f) => f.id !== fileId);
  row.updated_at = nowStr();
  save();
  res.json({ ok: true });
});

// 관리자 검토완료 처리
router.patch('/:id/complete', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = state.requests.find((r) => r.id === id);
  if (!row) return res.status(404).json({ error: '해당 건을 찾을 수 없습니다.' });
  row.status = 'completed';
  row.reviewed_by_user_id = req.session.user.id;
  row.reviewed_at = nowStr();
  row.updated_at = nowStr();
  save();
  res.json({ ok: true });
});

// 검토완료 취소(다시 검토중으로) - 관리자 실수 정정용
router.patch('/:id/reopen', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = state.requests.find((r) => r.id === id);
  if (!row) return res.status(404).json({ error: '해당 건을 찾을 수 없습니다.' });
  row.status = 'reviewing';
  row.reviewed_by_user_id = null;
  row.reviewed_at = null;
  row.updated_at = nowStr();
  save();
  res.json({ ok: true });
});

// 코멘트(의견) 작성 - 관리자만, 파일첨부 가능
const commentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safeExt = path.extname(file.originalname).slice(0, 20);
      const rand = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${rand}${safeExt}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

router.post('/:id/comments', requireAdmin, commentUpload.array('files', 10), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = state.requests.find((r) => r.id === id);
  if (!row) return res.status(404).json({ error: '해당 건을 찾을 수 없습니다.' });

  const text = (req.body.comment_text || '').trim();
  if (!text && (!req.files || req.files.length === 0)) {
    return res.status(400).json({ error: '의견 내용 또는 첨부파일을 입력해주세요.' });
  }

  const comment = {
    id: nextId('comments'),
    request_id: id,
    author_user_id: req.session.user.id,
    comment_text: text,
    created_at: nowStr(),
  };
  state.comments.push(comment);

  const destDir = path.join(UPLOAD_DIR, 'comments', String(comment.id));
  for (const f of req.files || []) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const finalPath = path.join(destDir, f.filename);
    fs.renameSync(f.path, finalPath);
    state.commentFiles.push({
      id: nextId('commentFiles'),
      comment_id: comment.id,
      original_name: fixFilename(f.originalname),
      stored_name: path.join('comments', String(comment.id), f.filename),
      size: f.size,
    });
  }

  save();
  res.status(201).json({ id: comment.id });
});

// 검토의견 내용 수정 (관리자 전용)
router.patch('/comments/:commentId', requireAdmin, (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const comment = state.comments.find((c) => c.id === commentId);
  if (!comment) return res.status(404).json({ error: '해당 의견을 찾을 수 없습니다.' });

  const text = (req.body.comment_text || '').trim();
  const hasFiles = state.commentFiles.some((f) => f.comment_id === commentId);
  if (!text && !hasFiles) {
    return res.status(400).json({ error: '의견 내용을 입력해주세요.' });
  }

  comment.comment_text = text;
  comment.updated_at = nowStr();
  save();
  res.json({ ok: true });
});

// 검토의견 첨부파일 추가 (관리자 전용) - 기존 의견에 파일을 나중에 더 첨부
router.post('/comments/:commentId/files', requireAdmin, commentUpload.array('files', 10), (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const comment = state.comments.find((c) => c.id === commentId);
  if (!comment) return res.status(404).json({ error: '해당 의견을 찾을 수 없습니다.' });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '추가할 파일을 선택해주세요.' });
  }

  const destDir = path.join(UPLOAD_DIR, 'comments', String(comment.id));
  for (const f of req.files) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const finalPath = path.join(destDir, f.filename);
    fs.renameSync(f.path, finalPath);
    state.commentFiles.push({
      id: nextId('commentFiles'),
      comment_id: comment.id,
      original_name: fixFilename(f.originalname),
      stored_name: path.join('comments', String(comment.id), f.filename),
      size: f.size,
    });
  }

  save();
  res.json({ ok: true });
});

// 검토의견 첨부파일 삭제 (관리자 전용)
router.delete('/comment-files/:fileId', requireAdmin, (req, res) => {
  const fileId = parseInt(req.params.fileId, 10);
  const file = state.commentFiles.find((f) => f.id === fileId);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  state.commentFiles = state.commentFiles.filter((f) => f.id !== fileId);
  save();
  res.json({ ok: true });
});

// 첨부파일 일괄 다운로드 (zip, 관리자 전용)
router.get('/:id/files/download-all', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = state.requests.find((r) => r.id === id);
  if (!row) return res.status(404).json({ error: '해당 건을 찾을 수 없습니다.' });

  const files = state.requestFiles.filter((f) => f.request_id === id);
  if (files.length === 0) return res.status(404).json({ error: '첨부된 파일이 없습니다.' });

  res.attachment(`${row.project_name}_첨부파일.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('[zip download]', err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  const usedNames = new Set();
  files.forEach((f) => {
    const filePath = path.join(UPLOAD_DIR, f.stored_name);
    if (!fs.existsSync(filePath)) return;
    let entryName = f.original_name;
    let n = 2;
    while (usedNames.has(entryName)) {
      const ext = path.extname(f.original_name);
      const base = f.original_name.slice(0, f.original_name.length - ext.length);
      entryName = `${base}(${n})${ext}`;
      n += 1;
    }
    usedNames.add(entryName);
    archive.file(filePath, { name: entryName });
  });

  archive.finalize();
});

// 파일 다운로드 (요청 첨부파일)
router.get('/files/:fileId/download', requireLogin, (req, res) => {
  const fileId = parseInt(req.params.fileId, 10);
  const file = state.requestFiles.find((f) => f.id === fileId);
  if (!file) return res.status(404).send('파일을 찾을 수 없습니다.');
  const reqRow = state.requests.find((r) => r.id === file.request_id);
  const user = req.session.user;
  if (!reqRow || (user.role !== 'admin' && reqRow.requester_user_id !== user.id)) {
    return res.status(403).send('다운로드 권한이 없습니다.');
  }
  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).send('파일이 존재하지 않습니다.');
  res.download(filePath, file.original_name);
});

// 파일 다운로드 (코멘트 첨부파일)
router.get('/comment-files/:fileId/download', requireLogin, (req, res) => {
  const fileId = parseInt(req.params.fileId, 10);
  const file = state.commentFiles.find((f) => f.id === fileId);
  if (!file) return res.status(404).send('파일을 찾을 수 없습니다.');
  const comment = state.comments.find((c) => c.id === file.comment_id);
  const reqRow = comment ? state.requests.find((r) => r.id === comment.request_id) : null;
  const user = req.session.user;
  if (!reqRow || (user.role !== 'admin' && reqRow.requester_user_id !== user.id)) {
    return res.status(403).send('다운로드 권한이 없습니다.');
  }
  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).send('파일이 존재하지 않습니다.');
  res.download(filePath, file.original_name);
});

module.exports = router;
